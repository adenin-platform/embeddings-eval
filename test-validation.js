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