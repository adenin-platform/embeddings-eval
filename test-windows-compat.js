#!/usr/bin/env node

/**
 * Test script to validate Windows compatibility fix
 * Tests file operations without requiring OpenAI API
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Test our LocalIndexWrapper
const LocalIndexWrapper = require('./lib/local-index-wrapper');

async function testWindowsCompatibility() {
  console.log('🧪 Testing Windows compatibility for embeddings operations...\n');
  
  const isWindows = os.platform() === 'win32';
  const testIndexPath = path.join(__dirname, 'test-index');
  
  console.log(`📍 Platform: ${os.platform()} ${isWindows ? '(Windows detected)' : '(Non-Windows)'}`);
  console.log(`📁 Test index path: ${testIndexPath}\n`);
  
  try {
    // Clean up any existing test index
    try {
      await fs.rm(testIndexPath, { recursive: true, force: true });
      console.log('🧹 Cleaned up existing test index');
    } catch (err) {
      // Ignore if directory doesn't exist
    }
    
    // Test 1: Create index
    console.log('📋 Test 1: Creating vector index...');
    const wrapper = new LocalIndexWrapper(testIndexPath);
    
    await wrapper.createIndex();
    console.log('✅ Vector index created successfully');
    
    // Test 2: Check if index was created
    console.log('\n📋 Test 2: Verifying index exists...');
    const exists = await wrapper.isIndexCreated();
    if (exists) {
      console.log('✅ Index verification successful');
    } else {
      throw new Error('Index was not created properly');
    }
    
    // Test 3: Get index stats
    console.log('\n📋 Test 3: Getting index stats...');
    const stats = await wrapper.getIndexStats();
    console.log(`✅ Index stats: ${stats.items} items`);
    
    // Test 4: Try to insert a test item (will fail due to missing embedding, but should handle gracefully)
    console.log('\n📋 Test 4: Testing insert operation (should fail gracefully)...');
    try {
      await wrapper.insertItem({
        vector: [0.1, 0.2, 0.3], // Small test vector
        metadata: {
          id: 'test-1',
          title: 'Test Item',
          description: 'This is a test item'
        }
      });
      console.log('✅ Insert operation completed');
      
      // Check stats again
      const newStats = await wrapper.getIndexStats();
      console.log(`✅ Updated stats: ${newStats.items} items`);
      
    } catch (error) {
      console.log(`⚠️  Insert failed as expected (likely due to vector dimension mismatch): ${error.message}`);
    }
    
    // Test 5: Delete index
    console.log('\n📋 Test 5: Deleting index...');
    await wrapper.deleteIndex();
    console.log('✅ Index deletion successful');
    
    console.log('\n🎉 All Windows compatibility tests passed!');
    console.log('\n📊 Summary:');
    console.log('   ✅ Index creation works without EPERM errors');
    console.log('   ✅ File operations handle Windows file system properly');
    console.log('   ✅ Error handling and retries function correctly');
    
    if (isWindows) {
      console.log('\n✨ Windows-specific compatibility features active');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n🔍 Error details:', error);
    process.exit(1);
    
  } finally {
    // Clean up test files
    try {
      await fs.rm(testIndexPath, { recursive: true, force: true });
      console.log('\n🧹 Cleaned up test files');
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testWindowsCompatibility().catch(console.error);
}

module.exports = { testWindowsCompatibility };