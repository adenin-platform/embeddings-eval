const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const { LocalIndex } = require('vectra');
const EmbeddingService = require('./lib/embedding');
const Generator = require('./lib/generate');
const Validator = require('./lib/validate');
const Metrics = require('./lib/metrics');
const RerankerService = require('./lib/reranker');
const { validateRerankerConfig, calculateRerankerCost, createRerankerMetrics, separateRerankedResults, formatRerankerConfig, isRerankerAvailable, getRerankerConfigHelp, checkRerankerRequirements } = require('./lib/rerank-utils');

class EmbeddingsEvaluator {
  constructor(dataset = 'default', modelName = 'default') {
    this.dataset = dataset;
    this.modelName = modelName;
    this.datasetPath = path.join(__dirname, dataset);
    this.indexPath = path.join(this.datasetPath, 'embeddings'); // Use embeddings as directory
    this.index = null;
    this.modelConfig = null;
    this.rerankerConfig = null;
    this.metrics = new Metrics();
    this.apiKey = null;
    this.embeddingService = null;
  }

  async loadModelConfig() {
    try {
      const modelConfigPath = path.join(__dirname, `${this.modelName}-model.json`);
      const modelConfigData = await fs.readFile(modelConfigPath, 'utf8');
      this.modelConfig = JSON.parse(modelConfigData);
      
      // Check for reranker configuration
      const hasReranker = this.modelConfig['reranker'];
      let rerankerInfo = '';
      
      if (hasReranker) {
        // Load reranker configuration from separate file
        try {
          const rerankerConfigPath = path.join(__dirname, `${this.modelConfig['reranker']}-reranker.json`);
          const rerankerConfigData = await fs.readFile(rerankerConfigPath, 'utf8');
          this.rerankerConfig = JSON.parse(rerankerConfigData);
          rerankerInfo = `, reranker: ${this.rerankerConfig.vendor}/${this.rerankerConfig.model}`;
        } catch (error) {
          throw new Error(`Failed to load reranker configuration from ${this.modelConfig['reranker']}-reranker.json: ${error.message}`);
        }
      }
      
      console.log(`📄 Loaded model '${this.modelName}': ${this.modelConfig.vendor}/${this.modelConfig.model} (cost: $${this.modelConfig.cost}/1M tokens, minSimilarity: ${this.modelConfig.minSimilarity || 0.0}${rerankerInfo})`);
      
      // Check if API key is provided for the vendor
      const apiKeyName = `${this.modelConfig.vendor.toUpperCase()}_API_KEY`;
      if (!process.env[apiKeyName]) {
        throw new Error(`${apiKeyName} environment variable is required. Please set it in a .env file.`);
      }
      
      this.apiKey = process.env[apiKeyName];
      this.embeddingService = new EmbeddingService(this.apiKey, this.modelConfig);
      
      // Initialize reranker service if configured
      if (hasReranker) {
        // Use enhanced requirement checking for better error messages
        const rerankerCheck = checkRerankerRequirements(this.modelConfig);
        
        if (!rerankerCheck.isValid) {
          const errorMessage = [
            'Reranker configuration issues:',
            ...rerankerCheck.messages
          ].join('\n  ');
          throw new Error(errorMessage);
        }
        
        const rerankerApiKey = process.env[`${this.rerankerConfig.vendor.toUpperCase()}_API_KEY`];
        
        this.rerankerService = new RerankerService(rerankerApiKey, this.rerankerConfig);
        console.log(`🔄 Reranker service initialized: ${formatRerankerConfig(this.rerankerConfig)}`);
      }
    } catch (error) {
      console.error(`❌ Error loading model config for '${this.modelName}':`, error.message);
      throw error;
    }
  }

  async initialize() {
    // Load model configuration first
    await this.loadModelConfig();
    
    // Create or load the vector index from dataset folder with model name as filename
    const indexFileName = `${this.modelName}.json`;
    this.index = new LocalIndex(this.indexPath, indexFileName);
    
    // Check if index exists
    const indexExists = await this.index.isIndexCreated();
    if (!indexExists) {
      throw new Error(`No embeddings index found for dataset '${this.dataset}' with model '${this.modelName}'. Please run generate first.`);
    }
  }

  async loadEvalData() {
    try {
      const evalPath = path.join(this.datasetPath, 'eval.json');
      const evalData = await fs.readFile(evalPath, 'utf8');
      return JSON.parse(evalData);
    } catch (error) {
      console.error(`Error loading eval.json from dataset ${this.dataset}:`, error.message);
      throw error;
    }
  }

  async search(query, topK = 3) {
    try {
      console.log(`Searching for: "${query}"`);
      
      // Track metrics for the entire search operation (embedding + reranking + processing)
      const startTime = Date.now();
      
      // Generate embedding for the search query
      const result = await this.embeddingService.generateEmbedding(query, 'query');
      const queryEmbedding = result.embedding;
      const tokens = result.tokens; // Use API-provided token count
      
      // Search the index - get more results initially to account for filtering and reranking
      const searchLimit = this.rerankerService ? Math.max(topK * 10, 20) : topK * 3; // Get more results for reranking
      const results = await this.index.queryItems(queryEmbedding, searchLimit);
      
      // Filter results based on minSimilarity threshold
      const minSimilarity = this.modelConfig?.minSimilarity || 0.0;
      const filteredResults = results.filter(result => result.score >= minSimilarity);
      const belowThresholdResults = results.filter(result => result.score < minSimilarity);
      
      if (minSimilarity > 0 && filteredResults.length < results.length) {
        console.log(`🔍 Filtered ${results.length - filteredResults.length} results below minSimilarity threshold (${minSimilarity})`);
      }
      
      // Convert all results to searchResults format for potential reranking
      const allResultsFormatted = results.map(result => ({
        id: result.item.metadata.id,
        score: result.score,
        title: result.item.metadata.title,
        description: result.item.metadata.description
      }));
      
      // Convert above-threshold results for non-reranked scenarios
      let candidateResults = filteredResults.map(result => ({
        id: result.item.metadata.id,
        score: result.score,
        title: result.item.metadata.title,
        description: result.item.metadata.description
      }));
      
      let belowThresholdTop3 = belowThresholdResults.slice(0, 3).map(result => ({
        id: result.item.metadata.id,
        score: result.score,
        title: result.item.metadata.title,
        description: result.item.metadata.description
      }));
      
      // Apply reranking if configured
      let rerankerCost = 0;
      let rerankerTokens = 0;
      if (this.rerankerService && allResultsFormatted.length > 0) {
        try {
          // Send all results to reranker to get consistent reranked scores
          const rerankerInput = allResultsFormatted.slice(0, 10); // Take top 10 for reranking
          
          const rerankerStartTime = Date.now();
          const rerankerResponse = await this.rerankerService.rerank(query, rerankerInput, 10);
          const rerankerRuntime = Date.now() - rerankerStartTime;
          
          // Handle different response formats from reranker
          let rerankedResults, apiTokens;
          if (Array.isArray(rerankerResponse)) {
            // Old format: reranker returned array directly
            rerankedResults = rerankerResponse;
            apiTokens = 0;
          } else if (rerankerResponse.results) {
            // New format: reranker returned object with results and tokens
            rerankedResults = rerankerResponse.results;
            apiTokens = rerankerResponse.tokens || 0;
          } else {
            // Fallback
            rerankedResults = rerankerResponse;
            apiTokens = 0;
          }
          
          // Use actual tokens from API if available
          if (apiTokens > 0) {
            // Use real tokens from API response
            rerankerTokens = apiTokens;
          } else {
            // If API doesn't provide tokens, set to 0
            // VoyageAI reranker should provide tokens in the response
            rerankerTokens = 0;
          }
          
          // Calculate reranker cost
          rerankerCost = calculateRerankerCost(
            this.rerankerConfig.vendor, 
            1, 
            rerankerInput.length
          );
          
          const rerankerMetrics = createRerankerMetrics({
            vendor: this.rerankerConfig.vendor,
            model: this.rerankerConfig.model,
            query,
            documentsCount: rerankerInput.length,
            runtime: rerankerRuntime,
            cost: rerankerCost
          });
          
          // Track reranker metrics
          this.metrics.addRerankerMetrics(rerankerMetrics);
          
          // Separate reranked results into above and below threshold based on reranked scores
          const { aboveThreshold: rerankedAboveThreshold, belowThreshold: rerankedBelowThreshold } = 
            separateRerankedResults(rerankedResults, candidateResults, minSimilarity);
          
          // Use reranked results as the main results
          candidateResults = rerankedAboveThreshold;
          belowThresholdTop3 = rerankedBelowThreshold;
          
        } catch (error) {
          console.error('⚠️  Reranking failed, falling back to similarity-based results:', error.message);
          // Continue with original results if reranking fails
          rerankerCost = 0; // Reset cost on failure
        }
      }
      
      // When filtering by minSimilarity, show all reranked results above threshold
      // Otherwise, limit to topK results
      const finalResults = minSimilarity > 0 ? candidateResults : candidateResults.slice(0, topK);
      
      const searchResults = finalResults;
      
      // Calculate embedding cost
      const embeddingCost = this.embeddingService.calculateCost(tokens);
      // rerankerCost is already calculated above during reranking process
      const totalCost = embeddingCost + rerankerCost;
      
      // Calculate total runtime for the entire operation (embedding + reranking + processing)
      const endTime = Date.now();
      const runtime = endTime - startTime;
      
      // Return results with timing and cost information
      return {
        results: searchResults,
        belowThresholdResults: belowThresholdTop3,
        metrics: {
          tokens: tokens,
          rerankerTokens: rerankerTokens,
          runtime: runtime,
          embeddingCost: embeddingCost,
          rerankerCost: rerankerCost,
          totalCost: totalCost
        }
      };
    } catch (error) {
      console.error('Error during search:', error.message);
      throw error;
    }
  }

  async runEvaluation() {
    console.log('Running evaluation...\n');
    const evalData = await this.loadEvalData();
    
    const results = [];
    
    for (const evalItem of evalData) {
      const searchResponse = await this.search(evalItem.search, 3);
      const searchResults = searchResponse.results;
      const belowThresholdResults = searchResponse.belowThresholdResults;
      const searchMetrics = searchResponse.metrics;
      
      const foundIds = searchResults.map(result => result.id);
      const expectedIds = evalItem.expected || [];
      
      // Calculate recall and precision
      const recall = Metrics.calculateRecall(foundIds, expectedIds);
      const precision = Metrics.calculatePrecision(foundIds, expectedIds);
      
      // Track evaluation metrics
      const foundSet = new Set(foundIds);
      const expectedFound = expectedIds.filter(id => foundSet.has(id)).length;
      
      // Use the cost breakdown from search metrics
      const embeddingCost = searchMetrics.embeddingCost;
      const rerankerCost = searchMetrics.rerankerCost;
      const totalCost = searchMetrics.totalCost;
      
      this.metrics.addEvaluateMetrics({
        search: evalItem.search,
        tokens: searchMetrics.tokens,
        rerankerTokens: searchMetrics.rerankerTokens || 0,
        runtime: searchMetrics.runtime,
        cost: totalCost, // Use total cost for metrics tracking
        embeddingCost: embeddingCost,
        rerankerCost: rerankerCost,
        recall: recall,
        precision: precision,
        expectedCount: expectedIds.length,
        foundCount: expectedFound,
        returnedCount: foundIds.length
      });
      
      // Validate results
      const validation = Validator.validateResults(foundIds, expectedIds);
      
      // Display results using the shared method
      this.displaySearchResults(evalItem.search, searchResults, belowThresholdResults, searchMetrics, expectedIds);
      
      console.log('\n' + '-'.repeat(80) + '\n');
      
      results.push({
        search: evalItem.search,
        expected: expectedIds,
        found: foundIds,
        validation: validation,
        results: searchResults,
        metrics: {
          tokens: searchMetrics.tokens,
          rerankerTokens: searchMetrics.rerankerTokens || 0,
          runtime: searchMetrics.runtime,
          cost: totalCost, // Use total cost
          embeddingCost: embeddingCost,
          rerankerCost: rerankerCost,
          recall: recall,
          precision: precision
        }
      });
      
      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Display evaluation metrics totals
    const totals = this.metrics.getEvaluateTotals();
    console.log('\n📈 Evaluation Metrics Summary:');
    console.log(`  Total Queries: ${totals.queryCount}`);
    
    // Display tokens separately when reranker was used
    if (totals.totalRerankerTokens > 0) {
      console.log(`  Total Tokens: ${totals.totalTokens} (Embedding: ${totals.totalTokens}, Reranker: ${totals.totalRerankerTokens})`);
    } else {
      console.log(`  Total Tokens: ${totals.totalTokens}`);
    }
    
    console.log(`  Total Runtime: ${totals.totalRuntime}ms`);
    
    // Display cost breakdown
    if (totals.totalRerankerCost > 0) {
      console.log(`  Total Cost: $${totals.totalCost.toFixed(8)} (Embedding: $${totals.totalEmbeddingCost.toFixed(8)}, Reranker: $${totals.totalRerankerCost.toFixed(8)})`);
    } else {
      console.log(`  Total Cost: $${totals.totalCost.toFixed(8)}`);
    }
    
    console.log('\n📊 Recall & Precision Averages:');
    console.log(`  Micro-averaging: Recall ${totals.microAveraging.recall.toFixed(1)}%, Precision ${totals.microAveraging.precision.toFixed(1)}%`);
    console.log(`  Macro-averaging: Recall ${totals.macroAveraging.recall.toFixed(1)}%, Precision ${totals.macroAveraging.precision.toFixed(1)}%`);
    console.log(`  Weighted-averaging: Recall ${totals.weightedAveraging.recall.toFixed(1)}%, Precision ${totals.weightedAveraging.precision.toFixed(1)}%`);
    
    // Display reranker metrics if available
    if (this.rerankerService && this.metrics.rerankerMetrics.length > 0) {
      const rerankerTotals = this.metrics.getRerankerTotals();
      console.log('\n🔄 Reranker Metrics Summary:');
      console.log(`  Total Queries: ${rerankerTotals.queryCount}`);
      console.log(`  Total Documents: ${rerankerTotals.totalDocuments}`);
      console.log(`  Total Runtime: ${rerankerTotals.totalRuntime}ms`);
      console.log(`  Total Cost: $${rerankerTotals.totalCost.toFixed(8)}`);
      console.log(`  Average Documents per Query: ${rerankerTotals.averageDocumentsPerQuery}`);
      console.log(`  Average Runtime per Query: ${rerankerTotals.averageRuntimePerQuery}ms`);
      console.log(`  Average Cost per Query: $${rerankerTotals.averageCostPerQuery.toFixed(8)}`);
    }
    return results;
  }

  async generateEmbeddingsOnly() {
    try {
      console.log(`🔄 Generating embeddings for dataset '${this.dataset}' using model '${this.modelName}' and storing vectors...\n`);
      
      // Load model configuration first
      await this.loadModelConfig();
      
      const generator = new Generator(this.datasetPath, this.embeddingService, this.indexPath, this.modelName);
      const generatorMetrics = await generator.generate();
      
      // Merge generator metrics into our metrics if needed
      if (generatorMetrics && generatorMetrics.generateMetrics) {
        generatorMetrics.generateMetrics.forEach(metric => {
          this.metrics.addGenerateMetrics(metric);
        });
      }
      
    } catch (error) {
      console.error('❌ Error generating embeddings:', error.message);
      process.exit(1);
    }
  }

  async evaluateOnly() {
    try {
      console.log(`🔍 Running evaluation for dataset '${this.dataset}' using model '${this.modelName}'...\n`);
      
      await this.initialize();
      
      // Check if index exists and has items
      const stats = await this.index.getIndexStats();
      if (stats.items === 0) {
        console.error(`❌ No embeddings found for dataset '${this.dataset}'! Please run "npm run generate" first to create embeddings.`);
        console.log(`💡 Usage: npm run generate -- --dataset ${this.dataset} --model ${this.modelName}  # Then: npm run evaluate -- --dataset ${this.dataset} --model ${this.modelName}`);
        process.exit(1);
      } else {
        console.log(`📊 Using existing index with ${stats.items} items.\n`);
      }
      
      // Run the evaluation only
      const results = await this.runEvaluation();
      
      // Prepare complete results with metrics
      const completeResults = {
        results: results,
        metrics: this.metrics.getAllMetrics()
      };
      
      // Save results to file in dataset folder with model name
      const resultsFileName = `evaluation-results-${this.modelName}.json`;
      const resultsPath = path.join(this.datasetPath, resultsFileName);
      // Custom JSON replacer to prevent scientific notation for cost values
      const jsonReplacer = (key, value) => {
        if (key === 'cost' || key === 'totalCost') {
          return typeof value === 'number' ? value.toFixed(8) : value;
        }
        return value;
      };
      await fs.writeFile(resultsPath, JSON.stringify(completeResults, jsonReplacer, 2));
      console.log(`✅ Evaluation results saved to ${resultsPath}`);
      
      return results;
    } catch (error) {
      console.error('❌ Error running evaluation:', error.message);
      process.exit(1);
    }
  }

  // Helper method to display search results consistently
  displaySearchResults(searchTerm, searchResults, belowThresholdResults, searchMetrics, expectedIds = []) {
    const foundIds = searchResults.map(r => r.id);
    const embeddingCost = searchMetrics.embeddingCost;
    const rerankerCost = searchMetrics.rerankerCost;
    const totalCost = searchMetrics.totalCost;
    
    console.log(`Search: "${searchTerm}"`);
    console.log(`Expected: [${expectedIds.join(', ')}]`);
    console.log(`Found: [${foundIds.join(', ')}]`);
    
    if (expectedIds.length > 0) {
      const validation = Validator.validateResults(foundIds, expectedIds);
      console.log(`Validation: ${validation.isValid ? '✅' : '❌'} ${validation.message}`);
      
      // Calculate recall and precision
      const recall = Metrics.calculateRecall(foundIds, expectedIds);
      const precision = Metrics.calculatePrecision(foundIds, expectedIds);
      console.log(`Recall: ${recall.toFixed(1)}%, Precision: ${precision.toFixed(1)}%`);
    } else {
      console.log(`Validation: ✅ Interactive search - no validation needed`);
      console.log(`Recall: N/A, Precision: N/A`);
    }
    
    // Display metrics
    if (rerankerCost > 0) {
      const rerankerTokens = searchMetrics.rerankerTokens || 0;
      console.log(`Metrics: Tokens: ${searchMetrics.tokens}, Reranker Tokens: ${rerankerTokens}, Runtime: ${searchMetrics.runtime}ms, Cost: $${totalCost.toFixed(8)} (Embedding: $${embeddingCost.toFixed(8)}, Reranker: $${rerankerCost.toFixed(8)})`);
    } else {
      console.log(`Metrics: Tokens: ${searchMetrics.tokens}, Runtime: ${searchMetrics.runtime}ms, Cost: $${totalCost.toFixed(8)}`);
    }
    
    console.log(`Results above threshold (${searchResults.length}):`);
    
    searchResults.forEach((result, index) => {
      const scoreLabel = result.reranked ? 'Relevance' : 'Score';
      const originalScoreInfo = result.reranked && result.originalScore ? ` (orig: ${result.originalScore.toFixed(4)})` : '';
      console.log(`  ${index + 1}. [ID: ${result.id}, ${scoreLabel}: ${result.score.toFixed(4)}${originalScoreInfo}] ${result.title}`);
      console.log(`     ${result.description.substring(0, 100)}...`);
    });
    
    // Display below threshold results if they exist
    if (belowThresholdResults && belowThresholdResults.length > 0) {
      console.log(`Next results below threshold:`);
      belowThresholdResults.forEach((result, index) => {
        const scoreLabel = result.reranked ? 'Relevance' : 'Score';
        const originalScoreInfo = result.reranked && result.originalScore ? ` (orig: ${result.originalScore.toFixed(4)})` : '';
        console.log(`  ${searchResults.length + index + 1}. [ID: ${result.id}, ${scoreLabel}: ${result.score.toFixed(4)}${originalScoreInfo}] ${result.title}`);
        console.log(`     ${result.description.substring(0, 100)}...`);
      });
    }
  }

  async queryMode() {
    try {
      console.log(`🔍 Interactive search mode for dataset '${this.dataset}' using model '${this.modelName}'...\n`);
      
      await this.initialize();
      
      const stats = await this.index.getIndexStats();
      console.log(`📊 Using existing index with ${stats.items} items.\n`);
      
      // Import readline for user input
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      // Prompt user for search term
      rl.question('Enter your search term: ', async (searchTerm) => {
        rl.close();
        
        if (!searchTerm || searchTerm.trim() === '') {
          console.log('❌ No search term provided. Exiting.');
          process.exit(1);
        }
        
        try {
          // Use the same search functionality as evaluate
          const searchResponse = await this.search(searchTerm.trim(), 3);
          const searchResults = searchResponse.results;
          const belowThresholdResults = searchResponse.belowThresholdResults;
          const searchMetrics = searchResponse.metrics;
          
          // Display results using the shared method
          this.displaySearchResults(searchTerm.trim(), searchResults, belowThresholdResults, searchMetrics);
          
        } catch (searchError) {
          console.error('❌ Error during search:', searchError.message);
          process.exit(1);
        }
      });
      
    } catch (error) {
      console.error('❌ Error running query mode:', error.message);
      process.exit(1);
    }
  }

  async run() {
    try {
      console.log(`Starting Embeddings Evaluator for dataset '${this.dataset}' using model '${this.modelName}'...\n`);
      
      await this.initialize();
      
      // Check if index is empty, if so build it
      const stats = await this.index.getIndexStats();
      if (stats.items === 0) {
        console.log('No embeddings found, generating first...');
        await this.generateEmbeddingsOnly();
        await this.initialize(); // Reinitialize after generating
      } else {
        console.log(`Using existing index with ${stats.items} items.\n`);
      }
      
      // Run the evaluation
      const results = await this.runEvaluation();
      
      // Prepare complete results with metrics
      const completeResults = {
        results: results,
        metrics: this.metrics.getAllMetrics()
      };
      
      // Save results to file in dataset folder with model name
      const resultsFileName = `evaluation-results-${this.modelName}.json`;
      const resultsPath = path.join(this.datasetPath, resultsFileName);
      // Custom JSON replacer to prevent scientific notation for cost values
      const jsonReplacer = (key, value) => {
        if (key === 'cost' || key === 'totalCost') {
          return typeof value === 'number' ? value.toFixed(8) : value;
        }
        return value;
      };
      await fs.writeFile(resultsPath, JSON.stringify(completeResults, jsonReplacer, 2));
      console.log(`Evaluation results saved to ${resultsPath}`);
      
      return results;
    } catch (error) {
      console.error('Error running evaluation:', error.message);
      process.exit(1);
    }
  }
}

// Run the evaluator if this file is executed directly
if (require.main === module) {
  (async () => {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let command = 'run'; // default command
    let dataset = 'default'; // default dataset
    let modelName = 'default'; // default model
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--dataset' && i + 1 < args.length) {
        dataset = args[i + 1];
        i++; // skip next argument as it's the dataset name
      } else if (arg === '--model' && i + 1 < args.length) {
        modelName = args[i + 1];
        i++; // skip next argument as it's the model name
      } else if (arg === 'generate' || arg === 'evaluate' || arg === 'query') {
        command = arg;
      }
    }
    
    // Validate dataset - check if dataset folder exists
    const datasetPath = path.join(__dirname, dataset);
    try {
      await fs.access(datasetPath);
      const stats = await fs.stat(datasetPath);
      if (!stats.isDirectory()) {
        throw new Error(`'${dataset}' is not a directory`);
      }
    } catch (error) {
      console.error(`❌ Error: Dataset folder '${dataset}' does not exist.`);
      console.log('💡 Usage examples:');
      console.log('   npm start -- --dataset default --model default');
      console.log('   npm start -- --dataset courses-de --model oa3large');      
      console.log('   npm run generate -- --dataset courses-de --model default');
      console.log('   npm run evaluate -- --dataset default --model oa3large');
      console.log('   npm run query -- --dataset intranet --model voyageai');
      console.log('');
      console.log('   Or run directly:');
      console.log('   node index.js --dataset default --model default');
      console.log('   node index.js generate --dataset courses-de --model oa3large');
      console.log('   node index.js query --dataset intranet --model voyageai');
      process.exit(1);
    }
    
    const evaluator = new EmbeddingsEvaluator(dataset, modelName);
    
    // Handle different commands
    switch (command) {
      case 'generate':
        console.log(`🚀 Command: Generate embeddings and store vectors for dataset '${dataset}' using model '${modelName}'\n`);
        evaluator.generateEmbeddingsOnly();
        break;
      case 'evaluate':
        console.log(`🚀 Command: Run evaluation for search terms in dataset '${dataset}' using model '${modelName}'\n`); 
        evaluator.evaluateOnly();
        break;
      case 'query':
        console.log(`🚀 Command: Interactive search query for dataset '${dataset}' using model '${modelName}'\n`);
        evaluator.queryMode();
        break;
      default:
        console.log(`🚀 Command: Full pipeline (generate + evaluate) for dataset '${dataset}' using model '${modelName}'\n`);
        evaluator.run();
        break;
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Please create a .env file with the required API key for your chosen model:');
    console.error('   For OpenAI models: OPENAI_API_KEY=your_openai_api_key_here');
    console.error('\n📖 See .env.example for the template.');
    process.exit(1);
  }
  })();
}

module.exports = EmbeddingsEvaluator;