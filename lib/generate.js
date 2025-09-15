const fs = require('fs').promises;
const path = require('path');
const { LocalIndex } = require('vectra-enhanced');
const EmbeddingService = require('./embedding');
const WindowsAtomicOperations = require('./windows-fix');

/**
 * Generator service for creating embeddings and building vector index
 */
class Generator {
  constructor(projectPath, apiKey) {
    this.projectPath = projectPath;
    this.indexPath = path.join(projectPath, 'embeddings-index');
    this.embeddingService = new EmbeddingService(apiKey);
    this.index = null;
    
    // Monkey-patch Vectra AtomicOperations for Windows compatibility
    this.patchAtomicOperations();
  }

  /**
   * Patch Vectra's AtomicOperations to work around Windows permission issues
   */
  patchAtomicOperations() {
    try {
      const { AtomicOperations } = require('vectra-enhanced/lib/AtomicOperations');
      console.log('🔧 Applying Windows compatibility patch for Vectra...');
      
      // Replace the writeFile method with our Windows-compatible version
      AtomicOperations.writeFile = WindowsAtomicOperations.writeFile.bind(WindowsAtomicOperations);
      AtomicOperations.performAtomicWrite = WindowsAtomicOperations.performAtomicWrite.bind(WindowsAtomicOperations);
      
      console.log('✅ Windows compatibility patch applied successfully');
    } catch (error) {
      console.warn('⚠️ Could not apply Windows compatibility patch:', error.message);
      console.log('Proceeding with default Vectra operations...');
    }
  }

  /**
   * Initialize the vector index
   */
  async initialize() {
    try {
      this.index = new LocalIndex(this.indexPath);
      
      // Add error event listener as suggested by Vectra warning
      if (this.index.errorHandler && typeof this.index.errorHandler.on === 'function') {
        this.index.errorHandler.on("error", (err) => {
          console.error('Vectra index error:', err);
        });
      }
      
      // Always recreate index for fresh generation
      const indexExists = await this.index.isIndexCreated();
      if (indexExists) {
        console.log('Clearing existing index...');
        await this.index.deleteIndex();
      }
      
      await this.index.createIndex();
      console.log('Created fresh vector index.');
    } catch (error) {
      console.error('Error initializing vector index:', error.message);
      if (error.code === 'EPERM') {
        console.error('');
        console.error('🔒 Permission Error Solutions:');
        console.error('1. Run PowerShell as Administrator');
        console.error('2. Add Windows Defender exclusion for this folder');
        console.error('3. Check if antivirus is blocking temporary file creation');
        console.error('4. Ensure no other process is using the embeddings-index folder');
        console.error('');
        console.error('💡 Try running: Start-Process powershell -Verb RunAs');
      }
      throw error;
    }
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
        const embedding = await this.embeddingService.generateEmbedding(text);
        
        await this.index.insertItem({
          vector: embedding,
          metadata: {
            id: item.id,
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
    
    const stats = await this.index.getIndexStats();
    console.log(`📊 Index contains ${stats.items} embedded items.`);
    
    return stats;
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

module.exports = Generator;