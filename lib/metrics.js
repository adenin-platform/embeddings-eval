/**
 * Metrics calculation and tracking utilities
 */
class Metrics {
  constructor() {
    this.generateMetrics = [];
    this.evaluateMetrics = [];
  }

  /**
   * Simple token counting using word-based approximation
   * @param {string} text - Text to count tokens for
   * @returns {number} - Approximate token count
   */
  static countTokens(text) {
    // Simple approximation: split by whitespace and punctuation
    // This is a rough estimate - actual tokenization would be more complex
    const tokens = text.split(/\s+|[.,!?;:]/).filter(token => token.length > 0);
    return tokens.length;
  }

  /**
   * Add metrics for a document generation
   * @param {Object} metrics - Generation metrics
   */
  addGenerateMetrics(metrics) {
    this.generateMetrics.push({
      id: metrics.id,
      title: metrics.title,
      tokens: metrics.tokens,
      runtime: metrics.runtime,
      cost: metrics.cost // Dynamic cost calculated based on model pricing
    });
  }

  /**
   * Add metrics for a search evaluation
   * @param {Object} metrics - Evaluation metrics
   */
  addEvaluateMetrics(metrics) {
    this.evaluateMetrics.push({
      search: metrics.search,
      tokens: metrics.tokens,
      runtime: metrics.runtime,
      cost: metrics.cost, // Dynamic cost calculated based on model pricing
      recall: metrics.recall,
      precision: metrics.precision,
      expectedCount: metrics.expectedCount,
      foundCount: metrics.foundCount,
      returnedCount: metrics.returnedCount
    });
  }

  /**
   * Calculate recall percentage
   * @param {number[]} foundIds - IDs found by search
   * @param {number[]} expectedIds - Expected IDs
   * @returns {number} - Recall percentage (0-100)
   */
  static calculateRecall(foundIds, expectedIds) {
    if (expectedIds.length === 0) return 0;
    
    const foundSet = new Set(foundIds);
    const expectedFound = expectedIds.filter(id => foundSet.has(id)).length;
    
    return (expectedFound / expectedIds.length) * 100;
  }

  /**
   * Calculate precision percentage
   * @param {number[]} foundIds - IDs found by search
   * @param {number[]} expectedIds - Expected IDs
   * @returns {number} - Precision percentage (0-100)
   */
  static calculatePrecision(foundIds, expectedIds) {
    if (foundIds.length === 0) return 0;
    
    const expectedSet = new Set(expectedIds);
    const correctFound = foundIds.filter(id => expectedSet.has(id)).length;
    
    return (correctFound / foundIds.length) * 100;
  }

  /**
   * Get total generation metrics
   * @returns {Object} - Total generation metrics
   */
  getGenerateTotals() {
    const totalTokens = this.generateMetrics.reduce((sum, m) => sum + m.tokens, 0);
    const totalRuntime = this.generateMetrics.reduce((sum, m) => sum + m.runtime, 0);
    const totalCost = this.generateMetrics.reduce((sum, m) => sum + m.cost, 0);

    return {
      totalTokens,
      totalRuntime,
      totalCost,
      documentCount: this.generateMetrics.length
    };
  }

  /**
   * Get total evaluation metrics with three averaging methods
   * @returns {Object} - Total evaluation metrics
   */
  getEvaluateTotals() {
    const totalTokens = this.evaluateMetrics.reduce((sum, m) => sum + m.tokens, 0);
    const totalRuntime = this.evaluateMetrics.reduce((sum, m) => sum + m.runtime, 0);
    const totalCost = this.evaluateMetrics.reduce((sum, m) => sum + m.cost, 0);

    // Micro-averaging (Aggregate then Calculate)
    const totalExpectedCount = this.evaluateMetrics.reduce((sum, m) => sum + m.expectedCount, 0);
    const totalFoundCount = this.evaluateMetrics.reduce((sum, m) => sum + m.foundCount, 0);
    const totalReturnedCount = this.evaluateMetrics.reduce((sum, m) => sum + m.returnedCount, 0);
    
    const microRecall = totalExpectedCount > 0 ? (totalFoundCount / totalExpectedCount) * 100 : 0;
    const microPrecision = totalReturnedCount > 0 ? (totalFoundCount / totalReturnedCount) * 100 : 0;

    // Macro-averaging (Calculate then Average)
    const avgRecall = this.evaluateMetrics.length > 0 
      ? this.evaluateMetrics.reduce((sum, m) => sum + m.recall, 0) / this.evaluateMetrics.length 
      : 0;
    const avgPrecision = this.evaluateMetrics.length > 0 
      ? this.evaluateMetrics.reduce((sum, m) => sum + m.precision, 0) / this.evaluateMetrics.length 
      : 0;

    // Weighted averaging (Weight by expected items)
    const weightedRecallSum = this.evaluateMetrics.reduce((sum, m) => sum + (m.recall * m.expectedCount), 0);
    const weightedPrecisionSum = this.evaluateMetrics.reduce((sum, m) => sum + (m.precision * m.expectedCount), 0);
    const weightedRecall = totalExpectedCount > 0 ? weightedRecallSum / totalExpectedCount : 0;
    const weightedPrecision = totalExpectedCount > 0 ? weightedPrecisionSum / totalExpectedCount : 0;

    return {
      totalTokens,
      totalRuntime,
      totalCost,
      queryCount: this.evaluateMetrics.length,
      microAveraging: {
        recall: microRecall,
        precision: microPrecision
      },
      macroAveraging: {
        recall: avgRecall,
        precision: avgPrecision
      },
      weightedAveraging: {
        recall: weightedRecall,
        precision: weightedPrecision
      }
    };
  }

  /**
   * Get all metrics data for saving to file
   * @returns {Object} - Complete metrics data
   */
  getAllMetrics() {
    return {
      generate: {
        items: this.generateMetrics,
        totals: this.getGenerateTotals()
      },
      evaluate: {
        items: this.evaluateMetrics,
        totals: this.getEvaluateTotals()
      }
    };
  }
}

module.exports = Metrics;