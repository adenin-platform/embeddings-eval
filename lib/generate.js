import fs from 'fs/promises';
import path from 'path';
import VectorDB from '@themaximalist/vectordb.js';
import EmbeddingService from './embedding.js';

/**
 * Generator service for creating embeddings and building vector index
 */
class Generator {
  constructor(projectPath, apiKey) {
    this.projectPath = projectPath;
    this.indexPath = path.join(projectPath, 'embeddings-index');
    this.embeddingService = new EmbeddingService(apiKey);
    this.db = null;
  }

  /**
   * Initialize the vector database
   */
  async initialize() {
    this.db = new VectorDB({
      dimensions: 1536, // OpenAI text-embedding-3-small dimensions
      embeddings: {
        service: "openai"
      }
    });
    
    console.log('Initialized vector database with OpenAI embeddings.');
  }

  /**
   * Load content from project folder
   * @returns {Promise<Object[]>} - Content items
   */
  async loadContent() {
    const contentPath = path.join(this.projectPath, 'content.json');
    const contentData = await fs.readFile(contentPath, 'utf8');
    return JSON.parse(contentData);
  }

  /**
   * Build the vector index with all content items
   */
  async buildIndex() {
    console.log('Loading content and building index...');
    const content = await this.loadContent();
    
    for (let i = 0; i < content.length; i++) {
      const item = content[i];
      const text = `${item.title} ${item.description}`;
      
      console.log(`Processing item ${i + 1}/${content.length}: ${item.title}`);
      
      try {
        await this.db.add(text, {
          id: item.id,
          title: item.title,
          description: item.description
        });
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing item ${i + 1}:`, error.message);
        throw error;
      }
    }
    
    console.log('Index built successfully!');
    console.log(`📊 Index contains ${content.length} embedded items.`);
    
    return { items: content.length };
  }

  /**
   * Generate embeddings and build index
   */
  async generate() {
    console.log(`🔄 Generating embeddings and storing vectors...`);
    
    await this.initialize();
    await this.buildIndex();
    
    console.log('✅ Embeddings generated and stored successfully!');
  }
}

export default Generator;