const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const { LocalIndex } = require('vectra');
const OpenAI = require('openai');

class EmbeddingsEvaluator {
  constructor(project = 'courses-en') {
    // Check if API key is provided before initializing OpenAI
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required. Please set it in a .env file.');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.project = project;
    this.projectPath = path.join(__dirname, project);
    this.indexPath = path.join(__dirname, `embeddings-index-${project}`);
    this.index = null;
  }

  async initialize() {
    // Create or load the vector index
    this.index = new LocalIndex(this.indexPath);
    
    // Check if index exists, if not create it
    const indexExists = await this.index.isIndexCreated();
    if (!indexExists) {
      await this.index.createIndex();
    }
  }

  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error.message);
      throw error;
    }
  }

  async loadContent() {
    try {
      const contentPath = path.join(this.projectPath, 'content.json');
      const contentData = await fs.readFile(contentPath, 'utf8');
      return JSON.parse(contentData);
    } catch (error) {
      console.error(`Error loading content.json from project ${this.project}:`, error.message);
      throw error;
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

  async buildIndex() {
    console.log(`Loading content from project '${this.project}' and building index...`);
    const content = await this.loadContent();
    
    for (let i = 0; i < content.length; i++) {
      const item = content[i];
      const text = `${item.title} ${item.description}`;
      
      console.log(`Processing item ${i + 1}/${content.length}: ${item.title}`);
      
      try {
        const embedding = await this.generateEmbedding(text);
        
        await this.index.insertItem({
          vector: embedding,
          metadata: {
            id: item.id, // Use the id from the content item
            title: item.title,
            description: item.description,
            text: text
          }
        });
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing item ${i + 1}:`, error.message);
        throw error;
      }
    }
    
    console.log('Index built successfully!');
  }

  validateResults(foundIds, expectedIds) {
    // Check if found results start with expected results in order
    if (expectedIds.length === 0) {
      return { isValid: true, message: 'No expectations to validate' };
    }
    
    if (foundIds.length < expectedIds.length) {
      return { 
        isValid: false, 
        message: `Expected ${expectedIds.length} results but found only ${foundIds.length}` 
      };
    }
    
    for (let i = 0; i < expectedIds.length; i++) {
      if (foundIds[i] !== expectedIds[i]) {
        return { 
          isValid: false, 
          message: `Expected ID ${expectedIds[i]} at position ${i + 1}, but found ID ${foundIds[i]}` 
        };
      }
    }
    
    return { isValid: true, message: `All ${expectedIds.length} expected results match` };
  }

  async search(query, topK = 3) {
    try {
      console.log(`Searching for: "${query}"`);
      
      // Generate embedding for the search query
      const queryEmbedding = await this.generateEmbedding(query);
      
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
      const validation = this.validateResults(foundIds, expectedIds);
      
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
      
      await this.initialize();
      
      // Always rebuild the index when explicitly generating
      console.log('Building fresh vector index...');
      
      // Clear existing index if it exists
      const stats = await this.index.getIndexStats();
      if (stats.items > 0) {
        console.log(`Clearing existing index with ${stats.items} items...`);
        // Delete and recreate the index directory
        await this.index.deleteIndex();
        await this.index.createIndex();
      }
      
      await this.buildIndex();
      console.log('✅ Embeddings generated and stored successfully!\n');
      
      const finalStats = await this.index.getIndexStats();
      console.log(`📊 Index contains ${finalStats.items} embedded items.`);
      
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
        console.log('💡 Usage: npm run generate -- --project courses-de  # Then: npm run evaluate -- --project courses-de');
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
        await this.buildIndex();
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
    let project = 'courses-en'; // default project
    
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
    
    // Validate project
    const validProjects = ['courses-en', 'courses-de'];
    if (!validProjects.includes(project)) {
      console.error(`❌ Error: Invalid project '${project}'. Valid projects are: ${validProjects.join(', ')}`);
      console.log('💡 Usage examples:');
      console.log('   npm start -- --project courses-en');
      console.log('   npm start -- --project courses-de');
      console.log('   npm run generate -- --project courses-de');
      console.log('   npm run evaluate -- --project courses-en');
      console.log('');
      console.log('   Or run directly:');
      console.log('   node index.js --project courses-en');
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