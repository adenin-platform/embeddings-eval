#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
let inputFile = null;
let outputFile = null;

// Parse --in and --out flags
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--in' && i + 1 < args.length) {
        inputFile = args[i + 1];
        i++; // Skip next argument since we consumed it
    } else if (args[i] === '--out' && i + 1 < args.length) {
        outputFile = args[i + 1];
        i++; // Skip next argument since we consumed it
    }
}

// Validate arguments
if (!inputFile || !outputFile) {
    console.error('Usage: node script.js --in <input_file> --out <output_file>');
    console.error('Example: node script.js --in data.json --out filtered.json');
    process.exit(1);
}

try {
    // Check if input file exists
    if (!fs.existsSync(inputFile)) {
        console.error(`Error: Input file '${inputFile}' does not exist.`);
        process.exit(1);
    }

    // Read and parse the input JSON file
    console.log(`Reading from: ${inputFile}`);
    const rawData = fs.readFileSync(inputFile, 'utf8');
    const jsonData = JSON.parse(rawData);

    // Extract only id, title, and description fields
    const filteredData = jsonData.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description
    }));

    // Write the filtered data to output file
    console.log(`Writing to: ${outputFile}`);
    fs.writeFileSync(outputFile, JSON.stringify(filteredData, null, 2), 'utf8');
    
    console.log(`✅ Successfully processed ${jsonData.length} items`);
    console.log(`✅ Output written to: ${outputFile}`);

} catch (error) {
    if (error.code === 'ENOENT') {
        console.error(`Error: Could not find file '${inputFile}'`);
    } else if (error instanceof SyntaxError) {
        console.error(`Error: Invalid JSON format in '${inputFile}'`);
        console.error(`Details: ${error.message}`);
    } else {
        console.error(`Error: ${error.message}`);
    }
    process.exit(1);
}