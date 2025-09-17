const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const { LocalIndex } = require('vectra');
const EmbeddingService = require('./lib/embedding');
const Generator = require('./lib/generate');
const Validator = require('./lib/validate');
const Metrics = require('./lib/metrics');

class EmbeddingsEvaluator {
  constructor(dataset = 'default', config = 'default', modelName = 'default') {
    this.dataset = dataset;
    this.config = config;
    this.modelName = modelName;
    this.datasetPath = path.join(__dirname, dataset);
    this.indexPath = path.join(this.datasetPath, `embeddings-index-${modelName}`);
    this.index = null;
    this.projectConfig = null;
    this.modelConfig = null;
    this.metrics = new Metrics();
    this.apiKey = null;
    this.embeddingService = null;
  }

  async loadModelConfig() {
    try {
      const modelConfigPath = path.join(__dirname, `${this.modelName}-model.json`);
      const modelConfigData = await fs.readFile(modelConfigPath, 'utf8');
      this.modelConfig = JSON.parse(modelConfigData);
      console.log(`📄 Loaded model '${this.modelName}': ${this.modelConfig.vendor}/${this.modelConfig.model} (cost: $${this.modelConfig.cost}/1M tokens)`);
      
      // Check if API key is provided for the vendor
      const apiKeyName = `${this.modelConfig.vendor.toUpperCase()}_API_KEY`;
      if (!process.env[apiKeyName]) {
        throw new Error(`${apiKeyName} environment variable is required. Please set it in a .env file.`);
      }
      
      this.apiKey = process.env[apiKeyName];
      this.embeddingService = new EmbeddingService(this.apiKey, this.modelConfig);
    } catch (error) {
      console.error(`❌ Error loading model config for '${this.modelName}':`, error.message);
      throw error;
    }
  }

  async loadProjectConfig() {
    try {
      let configPath;
      // First try to find config file in root directory with config name
      configPath = path.join(__dirname, `${this.config}.json`);
      
      // If not found and we're using default config, try inside dataset directory
      try {
        await fs.access(configPath);
      } catch {
        if (this.config === 'default') {
          configPath = path.join(this.datasetPath, 'default.json');
        } else {
          throw new Error(`Config file ${this.config}.json not found`);
        }
      }
      
      const configData = await fs.readFile(configPath, 'utf8');
      this.projectConfig = JSON.parse(configData);
      console.log(`📄 Loaded config '${this.config}': minSimilarity = ${this.projectConfig.minSimilarity}`);
    } catch (error) {
      console.warn(`⚠️  No config found for '${this.config}' (${error.message}), using defaults`);
      this.projectConfig = { minSimilarity: 0.0 }; // Default to no filtering
    }
  }

  async initialize() {
    // Load model configuration first
    await this.loadModelConfig();
    
    // Load project configuration
    await this.loadProjectConfig();
    
    // Create or load the vector index from dataset folder with model-specific filename
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
      
      // Track metrics for the search query
      const startTime = Date.now();
      
      // Generate embedding for the search query
      const result = await this.embeddingService.generateEmbedding(query);
      const queryEmbedding = result.embedding;
      const tokens = result.tokens; // Use API-provided token count
      
      const endTime = Date.now();
      const runtime = endTime - startTime;
      
      // Search the index - get more results initially to account for filtering
      const searchLimit = topK * 3; // Get 3x more results to have enough after filtering
      const results = await this.index.queryItems(queryEmbedding, searchLimit);
      
      // Filter results based on minSimilarity threshold
      const minSimilarity = this.projectConfig?.minSimilarity || 0.0;
      const filteredResults = results.filter(result => result.score >= minSimilarity);
      const belowThresholdResults = results.filter(result => result.score < minSimilarity);
      
      // When filtering by minSimilarity, show all results above threshold
      // Otherwise, limit to topK results
      const finalResults = minSimilarity > 0 ? filteredResults : filteredResults.slice(0, topK);
      
      if (minSimilarity > 0 && filteredResults.length < results.length) {
        console.log(`🔍 Filtered ${results.length - filteredResults.length} results below minSimilarity threshold (${minSimilarity})`);
      }
      
      const searchResults = finalResults.map(result => ({
        id: result.item.metadata.id,
        score: result.score,
        title: result.item.metadata.title,
        description: result.item.metadata.description
      }));
      
      // Get top 3 results below threshold for display
      const belowThresholdTop3 = belowThresholdResults.slice(0, 3).map(result => ({
        id: result.item.metadata.id,
        score: result.score,
        title: result.item.metadata.title,
        description: result.item.metadata.description
      }));
      
      // Return results with timing information
      return {
        results: searchResults,
        belowThresholdResults: belowThresholdTop3,
        metrics: {
          tokens: tokens,
          runtime: runtime
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
      const cost = this.embeddingService.calculateCost(searchMetrics.tokens);
      
      this.metrics.addEvaluateMetrics({
        search: evalItem.search,
        tokens: searchMetrics.tokens,
        runtime: searchMetrics.runtime,
        cost: cost,
        recall: recall,
        precision: precision,
        expectedCount: expectedIds.length,
        foundCount: expectedFound,
        returnedCount: foundIds.length
      });
      
      // Validate results
      const validation = Validator.validateResults(foundIds, expectedIds);
      
      console.log(`Search: "${evalItem.search}"`);
      console.log(`Expected: [${expectedIds.join(', ')}]`);
      console.log(`Found: [${foundIds.join(', ')}]`);
      console.log(`Validation: ${validation.isValid ? '✅' : '❌'} ${validation.message}`);
      console.log(`Metrics: Tokens: ${searchMetrics.tokens}, Runtime: ${searchMetrics.runtime}ms`);
      console.log(`Recall: ${recall.toFixed(1)}%, Precision: ${precision.toFixed(1)}%`);
      console.log(`Results above threshold (${searchResults.length}):`);
      
      searchResults.forEach((result, index) => {
        console.log(`  ${index + 1}. [ID: ${result.id}, Score: ${result.score.toFixed(4)}] ${result.title}`);
        console.log(`     ${result.description.substring(0, 100)}...`);
      });
      
      // Display top 3 results below threshold if they exist
      if (belowThresholdResults && belowThresholdResults.length > 0) {
        console.log(`Next results below threshold:`);
        belowThresholdResults.forEach((result, index) => {
          console.log(`  ${searchResults.length + index + 1}. [ID: ${result.id}, Score: ${result.score.toFixed(4)}] ${result.title}`);
          console.log(`     ${result.description.substring(0, 100)}...`);
        });
      }
      
      console.log('\n' + '-'.repeat(80) + '\n');
      
      results.push({
        search: evalItem.search,
        expected: expectedIds,
        found: foundIds,
        validation: validation,
        results: searchResults,
        metrics: {
          tokens: searchMetrics.tokens,
          runtime: searchMetrics.runtime,
          cost: 0.1,
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
    console.log(`  Total Tokens: ${totals.totalTokens}`);
    console.log(`  Total Runtime: ${totals.totalRuntime}ms`);
    console.log(`  Total Cost: $${totals.totalCost}`);
    console.log('\n📊 Recall & Precision Averages:');
    console.log(`  Micro-averaging: Recall ${totals.microAveraging.recall.toFixed(1)}%, Precision ${totals.microAveraging.precision.toFixed(1)}%`);
    console.log(`  Macro-averaging: Recall ${totals.macroAveraging.recall.toFixed(1)}%, Precision ${totals.macroAveraging.precision.toFixed(1)}%`);
    console.log(`  Weighted-averaging: Recall ${totals.weightedAveraging.recall.toFixed(1)}%, Precision ${totals.weightedAveraging.precision.toFixed(1)}%`);
    
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
      console.log(`🔍 Running evaluation for dataset '${this.dataset}' with config '${this.config}' using model '${this.modelName}'...\n`);
      
      await this.initialize();
      
      // Check if index exists and has items
      const stats = await this.index.getIndexStats();
      if (stats.items === 0) {
        console.error(`❌ No embeddings found for dataset '${this.dataset}'! Please run "npm run generate" first to create embeddings.`);
        console.log(`💡 Usage: npm run generate -- --dataset ${this.dataset}  # Then: npm run evaluate -- --dataset ${this.dataset} --config ${this.config}`);
        process.exit(1);
      } else {
        console.log(`📊 Using existing index with ${stats.items} items.\n`);
      }
      
      // Run the evaluation only
      const results = await this.runEvaluation();
      
      // Prepare complete results with metrics
      const completeResults = {
        results: results,
        metrics: this.metrics.getAllMetrics().evaluate
      };
      
      // Save results to file in dataset folder with config name
      const resultsFileName = `evaluation-results-${this.config}.json`;
      const resultsPath = path.join(this.datasetPath, resultsFileName);
      await fs.writeFile(resultsPath, JSON.stringify(completeResults, null, 2));
      console.log(`✅ Evaluation results saved to ${resultsPath}`);
      
      return results;
    } catch (error) {
      console.error('❌ Error running evaluation:', error.message);
      process.exit(1);
    }
  }

  async run() {
    try {
      console.log(`Starting Embeddings Evaluator for dataset '${this.dataset}' with config '${this.config}' using model '${this.modelName}'...\n`);
      
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
        metrics: this.metrics.getAllMetrics().evaluate
      };
      
      // Save results to file in dataset folder with config name
      const resultsFileName = `evaluation-results-${this.config}.json`;
      const resultsPath = path.join(this.datasetPath, resultsFileName);
      await fs.writeFile(resultsPath, JSON.stringify(completeResults, null, 2));
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
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let command = 'run'; // default command
    let dataset = 'default'; // default dataset
    let config = 'default'; // default config
    let modelName = 'default'; // default model
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--dataset' && i + 1 < args.length) {
        dataset = args[i + 1];
        i++; // skip next argument as it's the dataset name
      } else if (arg === '--config' && i + 1 < args.length) {
        config = args[i + 1];
        i++; // skip next argument as it's the config name
      } else if (arg === '--model' && i + 1 < args.length) {
        modelName = args[i + 1];
        i++; // skip next argument as it's the model name
      } else if (arg === 'generate' || arg === 'evaluate') {
        command = arg;
      }
    }
    
    // Validate dataset - check if dataset folder exists
    const validDatasets = ['default', 'courses-de'];
    if (!validDatasets.includes(dataset)) {
      console.error(`❌ Error: Invalid dataset '${dataset}'. Valid datasets are: ${validDatasets.join(', ')}`);
      console.log('💡 Usage examples:');
      console.log('   npm start -- --dataset default --config default --model default');
      console.log('   npm start -- --dataset courses-de --config test --model oa3large');      
      console.log('   npm run generate -- --dataset courses-de --model default');
      console.log('   npm run evaluate -- --dataset default --config test --model oa3large');
      console.log('');
      console.log('   Or run directly:');
      console.log('   node index.js --dataset default --config default --model default');
      console.log('   node index.js generate --dataset courses-de --model oa3large');
      process.exit(1);
    }
    
    const evaluator = new EmbeddingsEvaluator(dataset, config, modelName);
    
    // Handle different commands
    switch (command) {
      case 'generate':
        console.log(`🚀 Command: Generate embeddings and store vectors for dataset '${dataset}' using model '${modelName}'\n`);
        evaluator.generateEmbeddingsOnly();
        break;
      case 'evaluate':
        console.log(`🚀 Command: Run evaluation for search terms in dataset '${dataset}' with config '${config}' using model '${modelName}'\n`); 
        evaluator.evaluateOnly();
        break;
      default:
        console.log(`🚀 Command: Full pipeline (generate + evaluate) for dataset '${dataset}' with config '${config}' using model '${modelName}'\n`);
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
}

module.exports = EmbeddingsEvaluator;