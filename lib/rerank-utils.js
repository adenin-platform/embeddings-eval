/**
 * Reranker utility functions and helpers
 * Provides enhanced functionality for reranker operations including metrics tracking,
 * validation, and configuration management.
 */

/**
 * Validate reranker configuration
 * @param {Object} config - Reranker configuration object
 * @returns {Object} - Validation result with isValid boolean and errors array
 */
function validateRerankerConfig(config) {
  const errors = [];
  
  if (!config) {
    errors.push('Reranker configuration is required');
    return { isValid: false, errors };
  }
  
  if (!config.vendor || typeof config.vendor !== 'string') {
    errors.push('Reranker vendor must be a non-empty string');
  }
  
  if (!config.model || typeof config.model !== 'string') {
    errors.push('Reranker model must be a non-empty string');
  }
  
  // Check supported vendors
  const supportedVendors = ['voyageai'];
  if (config.vendor && !supportedVendors.includes(config.vendor.toLowerCase())) {
    errors.push(`Unsupported reranker vendor: ${config.vendor}. Supported vendors: ${supportedVendors.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calculate reranker cost based on vendor pricing models
 * @param {string} vendor - Reranker vendor
 * @param {number} queryCount - Number of queries
 * @param {number} documentCount - Number of documents reranked per query
 * @returns {number} - Total cost in dollars
 */
function calculateRerankerCost(vendor, queryCount, documentCount) {
  const pricingModels = {
    'voyageai': {
      costPer1000: 0.05, // $0.05 per 1000 searches (1 query + documents = 1 search)
      calculateCost: (queries, docs) => {
        const totalSearches = queries * docs;
        return (totalSearches / 1000) * 0.05;
      }
    }
  };
  
  const vendorLower = vendor.toLowerCase();
  if (!pricingModels[vendorLower]) {
    console.warn(`Unknown reranker vendor pricing: ${vendor}, returning 0 cost`);
    return 0;
  }
  
  return pricingModels[vendorLower].calculateCost(queryCount, documentCount);
}

/**
 * Create reranker metrics object for tracking performance
 * @param {Object} params - Metrics parameters
 * @param {string} params.vendor - Reranker vendor
 * @param {string} params.model - Reranker model
 * @param {string} params.query - Search query
 * @param {number} params.documentsCount - Number of documents reranked
 * @param {number} params.runtime - Runtime in milliseconds
 * @param {number} params.cost - Cost in dollars
 * @returns {Object} - Reranker metrics object
 */
function createRerankerMetrics({ vendor, model, query, documentsCount, runtime, cost }) {
  return {
    vendor,
    model,
    query,
    documentsCount,
    runtime,
    cost: parseFloat(parseFloat(cost).toFixed(8)) // Round to 8 decimal places
  };
}

/**
 * Merge and deduplicate reranked results with original results
 * @param {Array} rerankedResults - Results from reranker service
 * @param {Array} originalResults - Original similarity-based results
 * @param {number} minSimilarity - Minimum similarity threshold
 * @returns {Object} - Object with aboveThreshold and belowThreshold arrays
 */
function separateRerankedResults(rerankedResults, originalResults, minSimilarity) {
  const aboveThreshold = [];
  const belowThreshold = [];
  
  rerankedResults.forEach(result => {
    if (result.score >= minSimilarity) {
      aboveThreshold.push(result);
    } else {
      belowThreshold.push(result);
    }
  });
  
  return {
    aboveThreshold,
    belowThreshold: belowThreshold.slice(0, 3) // Limit to top 3 below threshold
  };
}

/**
 * Format reranker configuration for logging
 * @param {Object} config - Reranker configuration
 * @returns {string} - Formatted configuration string
 */
function formatRerankerConfig(config) {
  if (!config || !config.vendor || !config.model) {
    return 'Unknown reranker configuration';
  }
  
  return `${config.vendor}/${config.model}`;
}

/**
 * Check if reranker is available and properly configured
 * @param {Object} rerankerService - Reranker service instance
 * @param {Object} config - Configuration object
 * @returns {boolean} - True if reranker is available
 */
function isRerankerAvailable(rerankerService, config) {
  return !!(rerankerService && 
           config && 
           config['reranker'] && 
           config['reranker-model']);
}

/**
 * Get reranker configuration help message
 * @param {string} vendor - Reranker vendor name
 * @returns {string} - Help message for configuring the reranker
 */
function getRerankerConfigHelp(vendor) {
  const help = {
    'voyageai': {
      apiKeyName: 'VOYAGEAI_API_KEY',
      models: ['rerank-2.5', 'rerank-1'],
      documentation: 'https://docs.voyageai.com/docs/reranking'
    }
  };
  
  const vendorLower = vendor.toLowerCase();
  if (!help[vendorLower]) {
    return `Unknown reranker vendor: ${vendor}. Supported vendors: ${Object.keys(help).join(', ')}`;
  }
  
  const config = help[vendorLower];
  return [
    `Configuration help for ${vendor}:`,
    `  Environment variable: ${config.apiKeyName}=your_api_key_here`,
    `  Available models: ${config.models.join(', ')}`,
    `  Documentation: ${config.documentation}`
  ].join('\n');
}

/**
 * Validate if reranker requirements are met for a given model configuration
 * @param {Object} modelConfig - Model configuration object
 * @returns {Object} - Validation result with status and messages
 */
function checkRerankerRequirements(modelConfig) {
  if (!modelConfig) {
    return {
      isValid: false,
      hasReranker: false,
      messages: ['No model configuration provided']
    };
  }
  
  const hasRerankerConfig = modelConfig['reranker'] && modelConfig['reranker-model'];
  
  if (!hasRerankerConfig) {
    return {
      isValid: true,
      hasReranker: false,
      messages: ['No reranker configured for this model']
    };
  }
  
  const messages = [];
  const vendor = modelConfig['reranker'];
  const apiKeyName = `${vendor.toUpperCase()}_API_KEY`;
  
  if (!process.env[apiKeyName]) {
    messages.push(`Missing ${apiKeyName} environment variable`);
    messages.push(getRerankerConfigHelp(vendor));
  }
  
  const configValidation = validateRerankerConfig({
    vendor: modelConfig['reranker'],
    model: modelConfig['reranker-model']
  });
  
  if (!configValidation.isValid) {
    messages.push(...configValidation.errors);
  }
  
  return {
    isValid: messages.length === 0,
    hasReranker: true,
    vendor,
    model: modelConfig['reranker-model'],
    messages
  };
}

module.exports = {
  validateRerankerConfig,
  calculateRerankerCost,
  createRerankerMetrics,
  separateRerankedResults,
  formatRerankerConfig,
  isRerankerAvailable,
  getRerankerConfigHelp,
  checkRerankerRequirements
};