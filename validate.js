#!/usr/bin/env node

const fs = require('fs');

// List of projects to validate
const projects = ['default', 'courses-de'];

console.log('🔍 Validating all projects...\n');

let allValid = true;

for (const project of projects) {
  try {
    const contentPath = `${project}/content.json`;
    const evalPath = `${project}/eval.json`;
    
    // Check if project directory exists
    if (!fs.existsSync(project)) {
      console.log(`⚠️  Project ${project}: Directory not found`);
      continue;
    }
    
    // Check if files exist
    if (!fs.existsSync(contentPath)) {
      console.log(`❌ Project ${project}: content.json not found`);
      allValid = false;
      continue;
    }
    
    if (!fs.existsSync(evalPath)) {
      console.log(`❌ Project ${project}: eval.json not found`);
      allValid = false;
      continue;
    }
    
    const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    const evalData = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
    
    console.log(`✓ Project ${project}: Content items: ${content.length}, Eval queries: ${evalData.length}`);
  } catch (error) {
    console.log(`❌ Project ${project}: ${error.message}`);
    allValid = false;
  }
}

if (!allValid) {
  process.exit(1);
}

console.log('\n✅ All projects validated successfully!');