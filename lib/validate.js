import fs from 'fs/promises';
import path from 'path';

/**
 * Validation utilities for projects and data
 */
class Validator {
  /**
   * Validate a project folder structure and data files
   * @param {string} projectPath - Path to the project folder
   * @returns {Promise<Object>} - Validation results
   */
  static async validateProject(projectPath) {
    try {
      const contentPath = path.join(projectPath, 'content.json');
      const evalPath = path.join(projectPath, 'eval.json');
      
      // Check if files exist
      const contentData = await fs.readFile(contentPath, 'utf8');
      const evalData = await fs.readFile(evalPath, 'utf8');
      
      // Parse JSON
      const content = JSON.parse(contentData);
      const evalQueries = JSON.parse(evalData);
      
      // Validate structure
      if (!Array.isArray(content)) {
        throw new Error('content.json must be an array');
      }
      
      if (!Array.isArray(evalQueries)) {
        throw new Error('eval.json must be an array');
      }
      
      // Validate content items
      for (let i = 0; i < content.length; i++) {
        const item = content[i];
        if (!item.title || !item.description) {
          throw new Error(`Content item ${i + 1} missing title or description`);
        }
        if (!item.id) {
          throw new Error(`Content item ${i + 1} missing id`);
        }
      }
      
      // Validate eval queries
      for (let i = 0; i < evalQueries.length; i++) {
        const query = evalQueries[i];
        if (!query.search) {
          throw new Error(`Eval query ${i + 1} missing search property`);
        }
      }
      
      return {
        isValid: true,
        contentItems: content.length,
        evalQueries: evalQueries.length,
        message: `Project validation successful`
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
        message: `Project validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate search results against expected results
   * @param {string[]} foundIds - IDs found by search
   * @param {string[]} expectedIds - Expected IDs
   * @returns {Object} - Validation result
   */
  static validateResults(foundIds, expectedIds) {
    // Check if found results start with expected results in order
    if (expectedIds.length === 0) {
      return { isValid: true, message: 'No expectations to validate' };
    }
    
    if (foundIds.length < expectedIds.length) {
      return { 
        isValid: false, 
        message: `Expected ${expectedIds.length} results but found only ${foundIds.length}` 
      };
    }
    
    for (let i = 0; i < expectedIds.length; i++) {
      if (foundIds[i] !== expectedIds[i]) {
        return { 
          isValid: false, 
          message: `Expected ID ${expectedIds[i]} at position ${i + 1}, but found ID ${foundIds[i]}` 
        };
      }
    }
    
    return { isValid: true, message: `All ${expectedIds.length} expected results match` };
  }
}

export default Validator;