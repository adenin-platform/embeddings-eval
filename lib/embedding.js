const https = require('https');

/**
 * Embedding service that handles REST API calls to OpenAI
 */
class EmbeddingService {
  constructor(apiKey, modelConfig) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    if (!modelConfig) {
      throw new Error('Model configuration is required');
    }
    this.apiKey = apiKey;
    this.baseUrl = 'api.openai.com';
    this.model = modelConfig.model;
    this.modelConfig = modelConfig;
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
   * Generate embedding for text using OpenAI REST API
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} - Embedding vector
   */
  async generateEmbedding(text) {
    const data = JSON.stringify({
      model: this.model,
      input: text,
      encoding_format: 'float'
    });

    const options = {
      hostname: this.baseUrl,
      port: 443,
      path: '/v1/embeddings',
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
              reject(new Error(`OpenAI API error: ${response.error?.message || 'Unknown error'}`));
              return;
            }
            
            if (!response.data || !response.data[0] || !response.data[0].embedding) {
              reject(new Error('Invalid response format from OpenAI API'));
              return;
            }
            
            resolve(response.data[0].embedding);
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