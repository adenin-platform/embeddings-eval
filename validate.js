#!/usr/bin/env node

const fs = require('fs');
const projects = ['courses-en', 'courses-de'];

console.log('Validating project data files...\n');

projects.forEach(project => {
  try {
    const contentPath = `${project}/content.json`;
    const evalPath = `${project}/eval.json`;
    
    const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    const evalData = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
    
    console.log(`✓ Project ${project}: Content items: ${content.length}, Eval queries: ${evalData.length}`);
  } catch (error) {
    console.log(`❌ Project ${project}: ${error.message}`);
  }
});

console.log('\nValidation complete.');