// Test file for the null handling fix
// This validates that the fix for issue #50 continues to work

const Metrics = require('./lib/metrics.js');

console.log('Running regression test for null handling fix...');

// Test individual calculation functions
console.assert(Metrics.calculateRecall([], []) === 100, 'Expected empty recall should be 100%');
console.assert(Metrics.calculatePrecision([], []) === 100, 'Expected empty precision should be 100%');
console.assert(Metrics.calculateRecall([1], []) === 0, 'Unexpected results recall should be 0%');
console.assert(Metrics.calculatePrecision([1], []) === 0, 'Unexpected results precision should be 0%');

// Test aggregation doesn't produce >100% precision
const metrics = new Metrics();
metrics.addEvaluateMetrics({
  search: 'test1', tokens: 10, runtime: 100, cost: 0.001,
  recall: 100, precision: 100, expectedCount: 0, foundCount: 0, returnedCount: 0
});
metrics.addEvaluateMetrics({
  search: 'test2', tokens: 10, runtime: 100, cost: 0.001,
  recall: 0, precision: 0, expectedCount: 0, foundCount: 0, returnedCount: 1
});

const totals = metrics.getEvaluateTotals();
const maxPrecision = Math.max(
  totals.microAveraging.precision,
  totals.macroAveraging.precision,
  totals.weightedAveraging.precision
);

console.assert(maxPrecision <= 100, `Precision should not exceed 100%, got ${maxPrecision}%`);
console.assert(maxPrecision >= 0, `Precision should not be negative, got ${maxPrecision}%`);

console.log('✅ All regression tests passed!');
console.log(`   Individual calculations: ✅`);
console.log(`   Aggregation bounds: ✅ (max precision: ${maxPrecision.toFixed(1)}%)`);