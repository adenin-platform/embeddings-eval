const EmbeddingsEvaluator = require('./index.js');

async function testLoad() {
  try {
    console.log('Testing module load...');
    const evaluator = new EmbeddingsEvaluator();
    
    console.log('Testing file loading...');
    const content = await evaluator.loadContent();
    console.log(`✓ Loaded ${content.length} content items`);
    
    const evalData = await evaluator.loadEvalData();
    console.log(`✓ Loaded ${evalData.length} evaluation queries`);
    
    console.log('✓ All tests passed!');
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testLoad();
}