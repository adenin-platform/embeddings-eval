const https = require('https');

/**
 * Embedding service that handles REST API calls to OpenAI
 */
class EmbeddingService {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }
    this.apiKey = apiKey;
    this.baseUrl = 'api.openai.com';
    this.model = 'text-embedding-3-small';
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