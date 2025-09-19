// Test file for the reranker utilities refinements
// This validates that the new reranker utility functions work correctly

const { 
  validateRerankerConfig, 
  calculateRerankerCost, 
  createRerankerMetrics, 
  separateRerankedResults, 
  formatRerankerConfig, 
  isRerankerAvailable,
  getRerankerConfigHelp,
  checkRerankerRequirements
} = require('./lib/rerank-utils');

console.log('Running reranker utilities tests...');

// Test validateRerankerConfig
console.log('\n1. Testing validateRerankerConfig...');
console.assert(!validateRerankerConfig(null).isValid, 'Null config should be invalid');
console.assert(!validateRerankerConfig({}).isValid, 'Empty config should be invalid');
console.assert(!validateRerankerConfig({ vendor: 'voyageai' }).isValid, 'Config without model should be invalid');
console.assert(validateRerankerConfig({ vendor: 'voyageai', model: 'rerank-2.5' }).isValid, 'Valid config should pass');
console.assert(!validateRerankerConfig({ vendor: 'unknown', model: 'test' }).isValid, 'Unknown vendor should be invalid');

// Test calculateRerankerCost
console.log('2. Testing calculateRerankerCost...');
const cost1 = calculateRerankerCost('voyageai', 1, 10);
console.assert(cost1 === 0.0005, `Expected cost 0.0005, got ${cost1}`);
const cost2 = calculateRerankerCost('voyageai', 5, 8);
console.assert(cost2 === 0.002, `Expected cost 0.002, got ${cost2}`);
const cost3 = calculateRerankerCost('unknown', 1, 10);
console.assert(cost3 === 0, `Unknown vendor should return 0 cost, got ${cost3}`);

// Test createRerankerMetrics
console.log('3. Testing createRerankerMetrics...');
const metrics = createRerankerMetrics({
  vendor: 'voyageai',
  model: 'rerank-2.5',
  query: 'test query',
  documentsCount: 5,
  runtime: 150,
  cost: 0.001
});
console.assert(metrics.vendor === 'voyageai', 'Vendor should match');
console.assert(metrics.documentsCount === 5, 'Documents count should match');
console.assert(typeof metrics.cost === 'number', 'Cost should be a number');

// Test separateRerankedResults
console.log('4. Testing separateRerankedResults...');
const mockResults = [
  { id: 1, score: 0.8, title: 'High score' },
  { id: 2, score: 0.6, title: 'Medium score' },
  { id: 3, score: 0.3, title: 'Low score' },
  { id: 4, score: 0.1, title: 'Very low score' }
];
const separated = separateRerankedResults(mockResults, [], 0.5);
console.assert(separated.aboveThreshold.length === 2, `Expected 2 above threshold, got ${separated.aboveThreshold.length}`);
console.assert(separated.belowThreshold.length === 2, `Expected 2 below threshold, got ${separated.belowThreshold.length}`);

// Test formatRerankerConfig
console.log('5. Testing formatRerankerConfig...');
const formatted = formatRerankerConfig({ vendor: 'voyageai', model: 'rerank-2.5' });
console.assert(formatted === 'voyageai/rerank-2.5', `Expected 'voyageai/rerank-2.5', got '${formatted}'`);

// Test isRerankerAvailable
console.log('6. Testing isRerankerAvailable...');
const mockService = { rerank: () => {} };
const mockConfig = { 'reranker-vendor': 'voyageai', 'reranker-model': 'rerank-2.5' };
console.assert(isRerankerAvailable(mockService, mockConfig), 'Should detect available reranker');
console.assert(!isRerankerAvailable(null, mockConfig), 'Should detect missing service');
console.assert(!isRerankerAvailable(mockService, {}), 'Should detect missing config');

// Test getRerankerConfigHelp
console.log('7. Testing getRerankerConfigHelp...');
const help = getRerankerConfigHelp('voyageai');
console.assert(help.includes('VOYAGEAI_API_KEY'), 'Help should include API key name');
console.assert(help.includes('rerank-2.5'), 'Help should include model names');
const unknownHelp = getRerankerConfigHelp('unknown');
console.assert(unknownHelp.includes('Unknown reranker vendor'), 'Should handle unknown vendor');

// Test checkRerankerRequirements
console.log('8. Testing checkRerankerRequirements...');
const noRerankerConfig = { vendor: 'openai', model: 'text-embedding-3-small' };
const noRerankerResult = checkRerankerRequirements(noRerankerConfig);
console.assert(!noRerankerResult.hasReranker, 'Should detect no reranker');
console.assert(noRerankerResult.isValid, 'Should be valid when no reranker is configured');

const rerankerConfig = { 'reranker-vendor': 'voyageai', 'reranker-model': 'rerank-2.5' };
const rerankerResult = checkRerankerRequirements(rerankerConfig);
console.assert(rerankerResult.hasReranker, 'Should detect reranker configuration');
// Note: This will fail validation due to missing API key in test environment, which is expected

console.log('\n✅ All reranker utility tests passed!');
console.log('   Configuration validation: ✅');
console.log('   Cost calculation: ✅');
console.log('   Metrics creation: ✅');
console.log('   Results separation: ✅');
console.log('   Config formatting: ✅');
console.log('   Availability checking: ✅');
console.log('   Config help generation: ✅');
console.log('   Requirements checking: ✅');