#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Validator = require('./lib/validate');

/**
 * Validate all projects in the repository
 */
async function validateAllProjects() {
  console.log('🔍 Validating all projects...\n');
  
  // Get all directories that could be projects
  const entries = fs.readdirSync('.', { withFileTypes: true });
  const projectDirs = entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && !['node_modules', 'lib'].includes(entry.name))
    .map(entry => entry.name);
    
  let totalProjects = 0;
  let validProjects = 0;
  let totalContent = 0;
  let totalQueries = 0;
  
  for (const projectName of projectDirs) {
    const projectPath = path.join('.', projectName);
    const contentPath = path.join(projectPath, 'content.json');
    const evalPath = path.join(projectPath, 'eval.json');
    
    // Check if this directory contains content.json and eval.json
    if (fs.existsSync(contentPath) && fs.existsSync(evalPath)) {
      totalProjects++;
      
      const result = await Validator.validateProject(projectPath);
      if (result.isValid) {
        console.log(`✓ Project ${projectName}: Content items: ${result.contentItems}, Eval queries: ${result.evalQueries}`);
        validProjects++;
        totalContent += result.contentItems;
        totalQueries += result.evalQueries;
      } else {
        console.log(`❌ Project ${projectName}: ${result.error}`);
      }
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Valid projects: ${validProjects}/${totalProjects}`);
  console.log(`   Total content items: ${totalContent}`);
  console.log(`   Total eval queries: ${totalQueries}`);
  
  if (validProjects === totalProjects && totalProjects > 0) {
    console.log(`\n✅ All projects validated successfully!`);
    process.exit(0);
  } else if (totalProjects === 0) {
    console.log(`\n❌ No valid projects found! Expected directories with content.json and eval.json files.`);
    process.exit(1);
  } else {
    console.log(`\n❌ ${totalProjects - validProjects} project(s) failed validation.`);
    process.exit(1);
  }
}

// Run validation
validateAllProjects().catch(error => {
  console.error('\n❌ Validation failed:', error.message);
  process.exit(1);
});