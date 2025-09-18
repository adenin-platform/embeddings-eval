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

    // Add task_type if specified
    if (taskType) {
      requestBody.task_type = taskType;
    }

    const url = `${this.baseUrl}${this.model}:embedContent`;

    // console.log(`Sending request to Google API ${url}\n${JSON.stringify(requestBody, null, 2)}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      // Get raw response text first
      const rawResponseText = await response.text();
      // console.log('Raw Google API response:', rawResponseText);
      // console.log('Response status:', response.status);
      // console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Now try to parse JSON
      let responseData;
      try {
        responseData = JSON.parse(rawResponseText);
        // console.log('Parsed response data:', responseData);
      } catch (parseError) {
        console.error('JSON parse error:', parseError.message);
        console.error('Raw response that failed to parse:', rawResponseText);
        throw new Error(`Failed to parse JSON response: ${parseError.message}. Raw response: ${rawResponseText}`);
      }

      if (!response.ok) {
        throw new Error(`Google API error: ${responseData.error?.message || 'Unknown error'}`);
      }
      
      if (!responseData.embedding || !responseData.embedding.values) {
        throw new Error('Invalid response format from Google API');
      }
      
      // Google API doesn't provide token count directly, estimate based on text length
      const tokens = Math.ceil(text.length / 4); // Rough estimation: ~4 chars per token
      
      return {
        embedding: responseData.embedding.values,
        tokens: tokens
      };
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Google API request failed: ${error.message}`);
      } else if (error.name === 'SyntaxError') {
        throw new Error(`Failed to parse Google API response: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Generate embedding using standard OpenAI/SF API format
   * @param {string} text - Text to embed
   * @returns {Promise<{embedding: number[], tokens: number}>} - Embedding vector and token count
   */
  async generateStandardEmbedding(text) {
    const requestBody = {
      model: this.model,
      input: text,
      encoding_format: 'float'
    };

    const url = `${this.baseUrl}embeddings`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`API error: ${responseData.error?.message || 'Unknown error'}`);
      }
      
      if (!responseData.data || !responseData.data[0] || !responseData.data[0].embedding) {
        throw new Error('Invalid response format from API');
      }
      
      // Extract token count from usage field if available
      const tokens = responseData.usage?.total_tokens || 0;
      
      return {
        embedding: responseData.data[0].embedding,
        tokens: tokens
      };
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Request failed: ${error.message}`);
      } else if (error.name === 'SyntaxError') {
        throw new Error(`Failed to parse response: ${error.message}`);
      }
      throw error;
    }
  }
}

module.exports = EmbeddingService;