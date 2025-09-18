/**
 * Metrics calculation and tracking utilities
 */
class Metrics {
  constructor() {
    this.generateMetrics = [];
    this.evaluateMetrics = [];
  }

  /**
   * Add metrics for a document generation
   * @param {Object} metrics - Generation metrics
   */
  addGenerateMetrics(metrics) {
    // Store cost as fixed decimal string to prevent scientific notation, then parse back
    const roundedCost = parseFloat(parseFloat(metrics.cost).toFixed(8));
    
    this.generateMetrics.push({
      id: metrics.id,
      title: metrics.title,
      tokens: metrics.tokens,
      runtime: metrics.runtime,
      cost: roundedCost
    });
  }

  /**
   * Add metrics for a search evaluation
   * @param {Object} metrics - Evaluation metrics
   */
  addEvaluateMetrics(metrics) {
    // Store cost as fixed decimal to prevent scientific notation
    const roundedCost = parseFloat(parseFloat(metrics.cost).toFixed(8));
    
    this.evaluateMetrics.push({
      search: metrics.search,
      tokens: metrics.tokens,
      runtime: metrics.runtime,
      cost: roundedCost,
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
    // Special handling for expected: [] - if we expect no documents and find none, that's 100% recall
    if (expectedIds.length === 0) {
      return foundIds.length === 0 ? 100 : 0;
    }
    
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
    // Special handling for expected: [] - if we expect no documents and find none, that's 100% precision
    if (expectedIds.length === 0) {
      return foundIds.length === 0 ? 100 : 0;
    }
    
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
      totalCost: parseFloat(totalCost.toFixed(8)), // Round to 8 decimal places
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

    // Micro-averaging (Aggregate then Calculate) with special handling for expected: []
    let totalExpectedCount = 0;
    let totalFoundCount = 0;
    let totalReturnedCount = 0;
    
    this.evaluateMetrics.forEach(m => {
      if (m.expectedCount === 0) {
        // Special handling: expected: [] counts as 1 expected, 1 found if nothing returned, 1 returned if nothing returned
        totalExpectedCount += 1;
        totalFoundCount += m.returnedCount === 0 ? 1 : 0;
        totalReturnedCount += m.returnedCount === 0 ? 1 : m.returnedCount;
      } else {
        totalExpectedCount += m.expectedCount;
        totalFoundCount += m.foundCount;
        totalReturnedCount += m.returnedCount;
      }
    });
    
    const microRecall = totalExpectedCount > 0 ? (totalFoundCount / totalExpectedCount) * 100 : 0;
    const microPrecision = totalReturnedCount > 0 ? (totalFoundCount / totalReturnedCount) * 100 : 0;

    // Macro-averaging (Calculate then Average)
    const avgRecall = this.evaluateMetrics.length > 0 
      ? this.evaluateMetrics.reduce((sum, m) => sum + m.recall, 0) / this.evaluateMetrics.length 
      : 0;
    const avgPrecision = this.evaluateMetrics.length > 0 
      ? this.evaluateMetrics.reduce((sum, m) => sum + m.precision, 0) / this.evaluateMetrics.length 
      : 0;

    // Weighted averaging (Weight by expected items) with special handling for expected: []
    let weightedRecallSum = 0;
    let weightedPrecisionSum = 0;
    let weightedTotalExpected = 0;
    
    this.evaluateMetrics.forEach(m => {
      if (m.expectedCount === 0) {
        // Special handling: weight by 1 for expected: [] cases
        weightedRecallSum += m.recall * 1;
        weightedPrecisionSum += m.precision * 1;
        weightedTotalExpected += 1;
      } else {
        weightedRecallSum += m.recall * m.expectedCount;
        weightedPrecisionSum += m.precision * m.expectedCount;
        weightedTotalExpected += m.expectedCount;
      }
    });
    
    const weightedRecall = weightedTotalExpected > 0 ? weightedRecallSum / weightedTotalExpected : 0;
    const weightedPrecision = weightedTotalExpected > 0 ? weightedPrecisionSum / weightedTotalExpected : 0;

    return {
      totalTokens,
      totalRuntime,
      totalCost: parseFloat(totalCost.toFixed(8)), // Round to 8 decimal places
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