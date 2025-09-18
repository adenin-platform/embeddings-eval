/**
 * Reranker service for VoyageAI Rerank API
 * Handles REST API calls to rerank search results
 */
class RerankerService {
  constructor(apiKey, rerankerConfig) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    if (!rerankerConfig) {
      throw new Error('Reranker configuration is required');
    }
    if (!rerankerConfig.vendor || !rerankerConfig.model) {
      throw new Error('Reranker vendor and model are required in configuration');
    }
    
    this.apiKey = apiKey;
    this.vendor = rerankerConfig.vendor;
    this.model = rerankerConfig.model;
    
    // Map vendor to base URLs
    const vendorUrls = {
      'voyageai': 'https://api.voyageai.com/v1/'
    };
    
    this.baseUrl = vendorUrls[this.vendor];
    if (!this.baseUrl) {
      throw new Error(`Unsupported reranker vendor: ${this.vendor}`);
    }
  }

  /**
   * Rerank documents using VoyageAI Rerank API
   * @param {string} query - The search query
   * @param {Array} documents - Array of document objects with {id, title, description}
   * @param {number} topK - Number of top results to return (default: 10)
   * @returns {Promise<Array>} - Reranked documents with relevance scores
   */
  async rerank(query, documents, topK = 10) {
    if (!query || !documents || documents.length === 0) {
      return [];
    }

    try {
      // Prepare documents as strings for the rerank API
      // Combine title and description for better ranking
      const documentTexts = documents.map(doc => `${doc.title}. ${doc.description}`);
      
      const requestBody = {
        model: this.model,
        query: query,
        documents: documentTexts,
        top_k: Math.min(topK, documents.length), // Don't request more than available
        return_documents: false // We'll map back using indices
      };

      const url = `${this.baseUrl}rerank`;

      console.log(`🔄 Reranking ${documents.length} results using ${this.vendor}/${this.model}...`);
      
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
        throw new Error(`${this.vendor} Rerank API error: ${responseData.error?.message || 'Unknown error'}`);
      }
      
      if (!responseData.data || !Array.isArray(responseData.data)) {
        throw new Error(`Invalid response format from ${this.vendor} Rerank API`);
      }

      // Map rerank results back to original document objects with new scores
      const rerankedResults = responseData.data.map(result => {
        const originalDoc = documents[result.index];
        return {
          ...originalDoc,
          score: result.relevance_score, // Use reranker's relevance score
          originalScore: originalDoc.score, // Preserve original similarity score
          reranked: true
        };
      });

      console.log(`✅ Reranked to ${rerankedResults.length} results`);
      
      // Return results ordered by reranker (they should already be ordered)
      return rerankedResults;
      
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`${this.vendor} Rerank API request failed: ${error.message}`);
      } else if (error.name === 'SyntaxError') {
        throw new Error(`Failed to parse ${this.vendor} Rerank API response: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Calculate cost for reranking operation
   * @param {number} queryCount - Number of queries
   * @param {number} documentCount - Number of documents reranked
   * @returns {number} - Cost in dollars
   */
  calculateCost(queryCount, documentCount) {
    // VoyageAI Rerank pricing: $0.05 per 1000 searches (1 query + documents = 1 search)
    const costPer1000 = 0.05;
    const totalSearches = queryCount * documentCount;
    return (totalSearches / 1000) * costPer1000;
  }
}

module.exports = RerankerService;