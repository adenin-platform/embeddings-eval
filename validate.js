#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get all project directories
const projects = [];
const items = fs.readdirSync('.');

for (const item of items) {
  const itemPath = path.join('.', item);
  const stats = fs.statSync(itemPath);
  
  if (stats.isDirectory() && !item.startsWith('.') && item !== 'node_modules' && item !== 'lib') {
    // Check if it contains content.json and eval.json
    const contentPath = path.join(itemPath, 'content.json');
    const evalPath = path.join(itemPath, 'eval.json');
    
    if (fs.existsSync(contentPath) && fs.existsSync(evalPath)) {
      projects.push(item);
    }
  }
}

console.log('📋 Validating all projects...\n');

let hasErrors = false;

for (const project of projects) {
  try {
    const contentPath = path.join(project, 'content.json');
    const evalPath = path.join(project, 'eval.json');
    
    const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    const evalData = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
    
    console.log(`✓ Project ${project}: Content items: ${content.length}, Eval queries: ${evalData.length}`);
  } catch (error) {
    console.log(`❌ Project ${project}: ${error.message}`);
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log('\n✅ All projects validated successfully!');