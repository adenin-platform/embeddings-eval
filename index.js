import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import 'dotenv/config';
import VectorDB from '@themaximalist/vectordb.js';
import EmbeddingService from './lib/embedding.js';
import Generator from './lib/generate.js';
import Validator from './lib/validate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    this.db = null;
    this.content = [];
  }

  async initialize() {
    // Create vector database with OpenAI embeddings
    this.db = new VectorDB({
      dimensions: 1536, // OpenAI text-embedding-3-small dimensions
      embeddings: {
        service: "openai"
      }
    });
    
    // Load content and check if we have embeddings
    const contentPath = path.join(this.projectPath, 'content.json');
    const contentData = await fs.readFile(contentPath, 'utf8');
    this.content = JSON.parse(contentData);
    
    // Since vectordb.js is in-memory, we need to rebuild the index each time
    // or implement persistence ourselves
    console.log('Loading content into vector database...');
    for (const item of this.content) {
      const text = `${item.title} ${item.description}`;
      await this.db.add(text, {
        id: item.id,
        title: item.title,
        description: item.description
      });
    }
    console.log(`Loaded ${this.content.length} items into vector database.`);
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
      
      // Search using vectordb.js
      const results = await this.db.search(query, topK);
      
      return results.map(result => ({
        id: result.object.id,
        score: 1 - result.distance, // Convert distance to similarity score
        title: result.object.title,
        description: result.object.description
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
      
      console.log(`📊 Using vector database with ${this.content.length} items.\n`);
      
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
      
      console.log(`Using vector database with ${this.content.length} items.\n`);
      
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
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
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

export default EmbeddingsEvaluator;