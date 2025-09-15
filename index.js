const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const { LocalIndex } = require('vectra');
const EmbeddingService = require('./lib/embedding');
const Generator = require('./lib/generate');
const Validator = require('./lib/validate');

class EmbeddingsEvaluator {
  constructor(project = 'default') {
    // Check if API key is provided before initializing
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required. Please set it in a .env file.');
    }
    
    this.apiKey = process.env.OPENAI_API_KEY;
    this.project = project;
    this.projectPath = path.join(__dirname, project);
    this.indexPath = path.join(this.projectPath, 'embeddings-index');
    this.embeddingService = new EmbeddingService(this.apiKey);
    this.index = null;
  }

  async initialize() {
    // Create or load the vector index from project folder
    this.index = new LocalIndex(this.indexPath);
    
    // Check if index exists
    const indexExists = await this.index.isIndexCreated();
    if (!indexExists) {
      throw new Error(`No embeddings index found for project '${this.project}'. Please run generate first.`);
    }
  }

  async loadEvalData() {
    try {
      const evalPath = path.join(this.projectPath, 'eval.json');
      const evalData = await fs.readFile(evalPath, 'utf8');
      return JSON.parse(evalData);
    } catch (error) {
      console.error(`Error loading eval.json from project ${this.project}:`, error.message);
      throw error;
    }
  }

  async search(query, topK = 3) {
    try {
      console.log(`Searching for: "${query}"`);
      
      // Generate embedding for the search query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      
      // Search the index
      const results = await this.index.queryItems(queryEmbedding, topK);
      
      return results.map(result => ({
        id: result.item.metadata.id,
        score: result.score,
        title: result.item.metadata.title,
        description: result.item.metadata.description
      }));
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
      const searchResults = await this.search(evalItem.search, 3);
      const foundIds = searchResults.map(result => result.id);
      const expectedIds = evalItem.expected || [];
      
      // Validate results
      const validation = Validator.validateResults(foundIds, expectedIds);
      
      console.log(`Search: "${evalItem.search}"`);
      console.log(`Expected: [${expectedIds.join(', ')}]`);
      console.log(`Found: [${foundIds.join(', ')}]`);
      console.log(`Validation: ${validation.isValid ? '✅' : '❌'} ${validation.message}`);
      console.log('Top 3 results:');
      
      searchResults.forEach((result, index) => {
        console.log(`  ${index + 1}. [ID: ${result.id}, Score: ${result.score.toFixed(4)}] ${result.title}`);
        console.log(`     ${result.description.substring(0, 100)}...`);
      });
      
      console.log('\n' + '-'.repeat(80) + '\n');
      
      results.push({
        search: evalItem.search,
        expected: expectedIds,
        found: foundIds,
        validation: validation,
        results: searchResults
      });
      
      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return results;
  }

  async generateEmbeddingsOnly() {
    try {
      console.log(`🔄 Generating embeddings for project '${this.project}' and storing vectors...\n`);
      
      const generator = new Generator(this.projectPath, this.apiKey);
      await generator.generate();
      
    } catch (error) {
      console.error('❌ Error generating embeddings:', error.message);
      process.exit(1);
    }
  }

  async evaluateOnly() {
    try {
      console.log(`🔍 Running evaluation for project '${this.project}'...\n`);
      
      await this.initialize();
      
      // Check if index exists and has items
      const stats = await this.index.getIndexStats();
      if (stats.items === 0) {
        console.error(`❌ No embeddings found for project '${this.project}'! Please run "npm run generate" first to create embeddings.`);
        console.log(`💡 Usage: npm run generate -- --project ${this.project}  # Then: npm run evaluate -- --project ${this.project}`);
        process.exit(1);
      } else {
        console.log(`📊 Using existing index with ${stats.items} items.\n`);
      }
      
      // Run the evaluation only
      const results = await this.runEvaluation();
      
      // Save results to file with project name
      const resultsFileName = `evaluation-results-${this.project}.json`;
      await fs.writeFile(resultsFileName, JSON.stringify(results, null, 2));
      console.log(`✅ Evaluation results saved to ${resultsFileName}`);
      
      return results;
    } catch (error) {
      console.error('❌ Error running evaluation:', error.message);
      process.exit(1);
    }
  }

  async run() {
    try {
      console.log(`Starting Embeddings Evaluator for project '${this.project}'...\n`);
      
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
      
      // Save results to file with project name
      const resultsFileName = `evaluation-results-${this.project}.json`;
      await fs.writeFile(resultsFileName, JSON.stringify(results, null, 2));
      console.log(`Evaluation results saved to ${resultsFileName}`);
      
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
    let project = 'default'; // default project
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--project' && i + 1 < args.length) {
        project = args[i + 1];
        i++; // skip next argument as it's the project name
      } else if (arg === 'generate' || arg === 'evaluate') {
        command = arg;
      }
    }
    
    // Validate project - check if project folder exists
    const validProjects = ['default', 'courses-de'];
    if (!validProjects.includes(project)) {
      console.error(`❌ Error: Invalid project '${project}'. Valid projects are: ${validProjects.join(', ')}`);
      console.log('💡 Usage examples:');
      console.log('   npm start -- --project default');
      console.log('   npm start -- --project courses-de');
      console.log('   npm run generate -- --project courses-de');
      console.log('   npm run evaluate -- --project default');
      console.log('');
      console.log('   Or run directly:');
      console.log('   node index.js --project default');
      console.log('   node index.js generate --project courses-de');
      process.exit(1);
    }
    
    const evaluator = new EmbeddingsEvaluator(project);
    
    // Handle different commands
    switch (command) {
      case 'generate':
        console.log(`🚀 Command: Generate embeddings and store vectors for project '${project}'\n`);
        evaluator.generateEmbeddingsOnly();
        break;
      case 'evaluate':
        console.log(`🚀 Command: Run evaluation for search terms in project '${project}'\n`); 
        evaluator.evaluateOnly();
        break;
      default:
        console.log(`🚀 Command: Full pipeline (generate + evaluate) for project '${project}'\n`);
        evaluator.run();
        break;
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Please create a .env file with your OpenAI API key:');
    console.error('   OPENAI_API_KEY=your_openai_api_key_here');
    console.error('\n📖 See .env.example for the template.');
    process.exit(1);
  }
}

module.exports = EmbeddingsEvaluator;