const https = require('https');

/**
 * Embedding service that handles REST API calls to multiple vendors
 */
class EmbeddingService {
  constructor(apiKey, modelConfig) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    if (!modelConfig) {
      throw new Error('Model configuration is required');
    }
    if (!modelConfig.vendor) {
      throw new Error('Vendor is required in model configuration');
    }
    
    this.apiKey = apiKey;
    this.model = modelConfig.model;
    this.modelConfig = modelConfig;
    
    // Map vendor to base URLs
    const vendorUrls = {
      'openai': 'https://api.openai.com/v1/',
      'sf': 'https://api.siliconflow.com/v1/',
      'google': 'https://generativelanguage.googleapis.com/v1beta/models/'
    };
    
    this.baseUrl = vendorUrls[modelConfig.vendor];
    if (!this.baseUrl) {
      throw new Error(`Unsupported vendor: ${modelConfig.vendor}. Supported vendors: ${Object.keys(vendorUrls).join(', ')}`);
    }
  }

  /**
   * Calculate cost based on token count and model pricing
   * @param {number} tokenCount - Number of tokens
   * @returns {number} - Cost in dollars
   */
  calculateCost(tokenCount) {
    // Cost is per 1 million tokens, so divide by 1,000,000
    return (tokenCount / 1000000) * this.modelConfig.cost;
  }

  /**
   * Generate embedding for text using REST API
   * @param {string} text - Text to embed
   * @param {string} operation - Operation type ('generate' for content, 'query' for search)
   * @returns {Promise<{embedding: number[], tokens: number}>} - Embedding vector and token count
   */
  async generateEmbedding(text, operation = 'generate') {
    if (this.modelConfig.vendor === 'google') {
      return this.generateGoogleEmbedding(text, operation);
    } else {
      return this.generateStandardEmbedding(text);
    }
  }

  /**
   * Generate embedding using Google Gemini API format
   * @param {string} text - Text to embed
   * @param {string} operation - Operation type ('generate' for content, 'query' for search)
   * @returns {Promise<{embedding: number[], tokens: number}>} - Embedding vector and token count
   */
  async generateGoogleEmbedding(text, operation) {
    // Determine task type based on operation and model config
    let taskType = null;
    if (operation === 'generate' && this.modelConfig.generate_task_type) {
      taskType = this.modelConfig.generate_task_type;
    } else if (operation === 'query' && this.modelConfig.query_task_type) {
      taskType = this.modelConfig.query_task_type;
    }

    const requestBody = {
      content: {
        parts: [{ text: text }]
      }
    };

    // Add embedding_config with task_type if specified
    if (taskType) {
      requestBody.embedding_config = {
        task_type: taskType
      };
    }

    const data = JSON.stringify(requestBody);

    const url = new URL(`${this.baseUrl}${this.model}:embedContent?key=${this.apiKey}`);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data, 'utf8')
      }
    };

    debugger;

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            console.log(responseData);
            const response = JSON.parse(responseData);
            
            if (res.statusCode !== 200) {
              reject(new Error(`Google API error: ${response.error?.message || 'Unknown error'}`));
              return;
            }

            
            
            if (!response.embedding || !response.embedding.values) {
              reject(new Error('Invalid response format from Google API'));
              return;
            }
            
            // Google API doesn't provide token count directly, estimate based on text length
            const tokens = Math.ceil(text.length / 4); // Rough estimation: ~4 chars per token
            
            resolve({
              embedding: response.embedding.values,
              tokens: tokens
            });
          } catch (error) {
            reject(new Error(`Failed to parse Google API response: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        debugger;
        reject(new Error(`Google API request failed: ${error.message}`));
      });
      
      req.write(data);
      req.end();
    });
  }

  /**
   * Generate embedding using standard OpenAI/SF API format
   * @param {string} text - Text to embed
   * @returns {Promise<{embedding: number[], tokens: number}>} - Embedding vector and token count
   */
  async generateStandardEmbedding(text) {
    const data = JSON.stringify({
      model: this.model,
      input: text,
      encoding_format: 'float'
    });

    const url = new URL(`${this.baseUrl}embeddings`);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data, 'utf8')
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(responseData);
            
            if (res.statusCode !== 200) {
              reject(new Error(`API error: ${response.error?.message || 'Unknown error'}`));
              return;
            }
            
            if (!response.data || !response.data[0] || !response.data[0].embedding) {
              reject(new Error('Invalid response format from API'));
              return;
            }
            
            // Extract token count from usage field if available
            const tokens = response.usage?.total_tokens || 0;
            
            resolve({
              embedding: response.data[0].embedding,
              tokens: tokens
            });
          } catch (error) {            
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });
      
      req.write(data);
      req.end();
    });
  }
}

module.exports = EmbeddingService;