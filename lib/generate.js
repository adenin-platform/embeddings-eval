const fs = require('fs').promises;
const path = require('path');
const { LocalIndex } = require('vectra');
const EmbeddingService = require('./embedding');
const Metrics = require('./metrics');

/**
 * Generator service for creating embeddings and building vector index
 */
class Generator {
  constructor(projectPath, apiKey) {
    this.projectPath = projectPath;
    this.indexPath = path.join(projectPath, 'embeddings-index');
    this.embeddingService = new EmbeddingService(apiKey);
    this.index = null;
    this.metrics = new Metrics();
  }

  /**
   * Initialize the vector index
   */
  async initialize() {
    this.index = new LocalIndex(this.indexPath);
    
    // Always recreate index for fresh generation
    const indexExists = await this.index.isIndexCreated();
    if (indexExists) {
      console.log('Clearing existing index...');
      await this.index.deleteIndex();
    }
    
    await this.index.createIndex();
    console.log('Created fresh vector index.');
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
        // Track metrics for each document
        const startTime = Date.now();
        const tokens = Metrics.countTokens(text);
        
        const embedding = await this.embeddingService.generateEmbedding(text);
        
        const endTime = Date.now();
        const runtime = endTime - startTime;
        
        // Add metrics for this document
        this.metrics.addGenerateMetrics({
          id: item.id,
          title: item.title,
          tokens: tokens,
          runtime: runtime
        });
        
        await this.index.insertItem({
          vector: embedding,
          metadata: {
            id: item.id,
            title: item.title,
            description: item.description,
            text: text
          }
        });
        
        console.log(`  ✓ Tokens: ${tokens}, Runtime: ${runtime}ms`);
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing item ${i + 1}:`, error.message);
        throw error;
      }
    }
    
    console.log('Index built successfully!');
    
    const stats = await this.index.getIndexStats();
    console.log(`📊 Index contains ${stats.items} embedded items.`);
    
    // Display generation metrics totals
    const totals = this.metrics.getGenerateTotals();
    console.log('\n📈 Generation Metrics Summary:');
    console.log(`  Total Documents: ${totals.documentCount}`);
    console.log(`  Total Tokens: ${totals.totalTokens}`);
    console.log(`  Total Runtime: ${totals.totalRuntime}ms`);
    console.log(`  Total Cost: $${totals.totalCost.toFixed(2)}`);
    
    return stats;
  }

  /**
   * Generate embeddings and build index
   */
  async generate() {
    console.log(`🔄 Generating embeddings and storing vectors...`);
    
    await this.initialize();
    await this.buildIndex();
    
    // Save metrics to file
    const metricsPath = path.join(this.projectPath, 'generation-metrics.json');
    await fs.writeFile(metricsPath, JSON.stringify(this.metrics.getAllMetrics().generate, null, 2));
    console.log(`📊 Generation metrics saved to ${metricsPath}`);
    
    console.log('✅ Embeddings generated and stored successfully!');
    
    return this.metrics;
  }
}

module.exports = Generator;