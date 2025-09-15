#!/usr/bin/env node

const fs = require('fs');
const project = process.argv[2] || 'default';

try {
  const contentPath = `${project}/content.json`;
  const evalPath = `${project}/eval.json`;
  
  const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  const evalData = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
  
  console.log(`✓ Project ${project}: Content items: ${content.length}, Eval queries: ${evalData.length}`);
} catch (error) {
  console.log(`❌ Project ${project}: ${error.message}`);
  process.exit(1);
}