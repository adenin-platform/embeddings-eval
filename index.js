const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const { LocalIndex } = require('vectra');
const OpenAI = require('openai');

class EmbeddingsEvaluator {
  constructor() {
    // Check if API key is provided before initializing OpenAI
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required. Please set it in a .env file.');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.indexPath = path.join(__dirname, 'embeddings-index');
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
      const contentData = await fs.readFile('content.json', 'utf8');
      return JSON.parse(contentData);
    } catch (error) {
      console.error('Error loading content.json:', error.message);
      throw error;
    }
  }

  async loadEvalData() {
    try {
      const evalData = await fs.readFile('eval.json', 'utf8');
      return JSON.parse(evalData);
    } catch (error) {
      console.error('Error loading eval.json:', error.message);
      throw error;
    }
  }

  async buildIndex() {
    console.log('Loading content and building index...');
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
            id: i,
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

  async search(query, topK = 3) {
    try {
      console.log(`Searching for: "${query}"`);
      
      // Generate embedding for the search query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search the index
      const results = await this.index.queryItems(queryEmbedding, topK);
      
      return results.map(result => ({
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
      
      console.log(`Search: "${evalItem.search}"`);
      console.log('Top 3 results:');
      
      searchResults.forEach((result, index) => {
        console.log(`  ${index + 1}. [Score: ${result.score.toFixed(4)}] ${result.title}`);
        console.log(`     ${result.description.substring(0, 100)}...`);
      });
      
      console.log('\n' + '-'.repeat(80) + '\n');
      
      results.push({
        search: evalItem.search,
        results: searchResults
      });
      
      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return results;
  }

  async run() {
    try {
      console.log('Starting Embeddings Evaluator...\n');
      
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
      
      // Save results to file
      await fs.writeFile('evaluation-results.json', JSON.stringify(results, null, 2));
      console.log('Evaluation results saved to evaluation-results.json');
      
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
    const evaluator = new EmbeddingsEvaluator();
    evaluator.run();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Please create a .env file with your OpenAI API key:');
    console.error('   OPENAI_API_KEY=your_openai_api_key_here');
    console.error('\n📖 See .env.example for the template.');
    process.exit(1);
  }
}

module.exports = EmbeddingsEvaluator;