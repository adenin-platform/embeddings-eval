#!/usr/bin/env node

const Validator = require('./lib/validate');

console.log('Testing validation logic...\n');

// Test case from the issue
const foundIds = [170, 34, 187, 99, 110, 137];
const expectedIds = [99];

console.log('Test case from issue:');
console.log(`Expected: [${expectedIds.join(', ')}]`);
console.log(`Found: [${foundIds.join(', ')}]`);

const result = Validator.validateResults(foundIds, expectedIds);
console.log(`Current validation: ${result.isValid ? '✅' : '❌'} ${result.message}`);

// Additional test cases
console.log('\n--- Additional test cases ---');

// Test 1: Expected IDs are all present but in different order
const test1Found = [2, 5, 6, 1, 3];
const test1Expected = [2, 5, 6];
const result1 = Validator.validateResults(test1Found, test1Expected);
console.log(`Test 1 - All present, different order: ${result1.isValid ? '✅' : '❌'} ${result1.message}`);

// Test 2: Some expected IDs missing
const test2Found = [2, 5, 1, 3];
const test2Expected = [2, 5, 6];
const result2 = Validator.validateResults(test2Found, test2Expected);
console.log(`Test 2 - Some missing: ${result2.isValid ? '✅' : '❌'} ${result2.message}`);

// Test 3: No expected IDs
const test3Found = [2, 5, 6];
const test3Expected = [];
const result3 = Validator.validateResults(test3Found, test3Expected);
console.log(`Test 3 - No expectations: ${result3.isValid ? '✅' : '❌'} ${result3.message}`);

// Test 4: Expected IDs in exact order at beginning
const test4Found = [2, 5, 6, 1, 3];
const test4Expected = [2, 5, 6];
const result4 = Validator.validateResults(test4Found, test4Expected);
console.log(`Test 4 - Exact order at start: ${result4.isValid ? '✅' : '❌'} ${result4.message}`);

// Test 5: Empty found results but expecting some
const test5Found = [];
const test5Expected = [1, 2];
const result5 = Validator.validateResults(test5Found, test5Expected);
console.log(`Test 5 - Empty found, expecting some: ${result5.isValid ? '✅' : '❌'} ${result5.message}`);

// Test 6: Duplicates in expected and found
const test6Found = [1, 2, 3, 2, 1];
const test6Expected = [1, 2, 1];
const result6 = Validator.validateResults(test6Found, test6Expected);
console.log(`Test 6 - Duplicates: ${result6.isValid ? '✅' : '❌'} ${result6.message}`);

// Test 7: Expected ID at the end
const test7Found = [1, 2, 3, 4, 5];
const test7Expected = [5];
const result7 = Validator.validateResults(test7Found, test7Expected);
console.log(`Test 7 - Expected at end: ${result7.isValid ? '✅' : '❌'} ${result7.message}`);

// Test 8: Multiple missing IDs
const test8Found = [1, 3, 5];
const test8Expected = [1, 2, 4, 6];
const result8 = Validator.validateResults(test8Found, test8Expected);
console.log(`Test 8 - Multiple missing: ${result8.isValid ? '✅' : '❌'} ${result8.message}`);