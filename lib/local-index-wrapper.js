const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { LocalIndex } = require('vectra-enhanced');

/**
 * Windows-compatible LocalIndex wrapper
 * Handles EPERM issues during atomic operations on Windows
 */
class LocalIndexWrapper {
  constructor(indexPath) {
    this.indexPath = indexPath;
    this.localIndex = new LocalIndex(indexPath);
    this.isWindows = os.platform() === 'win32';
  }

  // Proxy most methods directly to the underlying LocalIndex
  async createIndex() {
    if (!this.isWindows) {
      return await this.localIndex.createIndex();
    }

    // Windows-specific create index with retry logic
    return await this.retryOperation(async () => {
      return await this.localIndex.createIndex();
    }, 'createIndex');
  }

  async deleteIndex() {
    if (!this.isWindows) {
      return await this.localIndex.deleteIndex();
    }

    // Windows-specific delete with retry
    return await this.retryOperation(async () => {
      return await this.localIndex.deleteIndex();
    }, 'deleteIndex');
  }

  async insertItem(item) {
    if (!this.isWindows) {
      return await this.localIndex.insertItem(item);
    }

    // Windows-specific insert with retry logic
    return await this.retryOperation(async () => {
      return await this.localIndex.insertItem(item);
    }, 'insertItem');
  }

  async queryItems(vector, topK, filter) {
    // Query operations typically don't have file writing issues
    return await this.localIndex.queryItems(vector, topK, filter);
  }

  async isIndexCreated() {
    return await this.localIndex.isIndexCreated();
  }

  async getIndexStats() {
    return await this.localIndex.getIndexStats();
  }

  async updateItem(id, item) {
    if (!this.isWindows) {
      return await this.localIndex.updateItem(id, item);
    }

    return await this.retryOperation(async () => {
      return await this.localIndex.updateItem(id, item);
    }, 'updateItem');
  }

  async deleteItem(id) {
    if (!this.isWindows) {
      return await this.localIndex.deleteItem(id);
    }

    return await this.retryOperation(async () => {
      return await this.localIndex.deleteItem(id);
    }, 'deleteItem');
  }

  async beginUpdate() {
    return await this.localIndex.beginUpdate();
  }

  async endUpdate() {
    if (!this.isWindows) {
      return await this.localIndex.endUpdate();
    }

    return await this.retryOperation(async () => {
      return await this.localIndex.endUpdate();
    }, 'endUpdate');
  }

  async cancelUpdate() {
    return await this.localIndex.cancelUpdate();
  }

  /**
   * Retry operation with Windows-specific error handling
   */
  async retryOperation(operation, operationName, maxRetries = 5) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Check if this is a Windows permission error we can retry
        if (this.shouldRetryWindowsError(error)) {
          const delay = this.calculateRetryDelay(attempt);
          
          console.log(`⚠️  Windows file operation retry ${attempt}/${maxRetries} for ${operationName}: ${error.message}`);
          console.log(`🔄 Retrying in ${delay}ms...`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Try to clean up any orphaned temp files before retrying
          await this.cleanupTempFiles();
          
          continue;
        }
        
        // If it's not a retryable error, throw immediately
        throw error;
      }
    }
    
    // If we exhausted all retries, throw the last error with context
    throw new Error(`Windows operation '${operationName}' failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
  }

  /**
   * Determine if a Windows error should be retried
   */
  shouldRetryWindowsError(error) {
    // Retry on Windows permission and file locking errors
    const retryableErrors = [
      'EPERM',    // Operation not permitted
      'EBUSY',    // Resource busy
      'EACCES',   // Permission denied (sometimes transient on Windows)
      'EMFILE',   // Too many open files
      'ENFILE'    // File table overflow
    ];

    // Also retry on specific error messages common on Windows
    const retryableMessages = [
      'operation not permitted',
      'resource busy',
      'access denied',
      'sharing violation',
      'lock violation'
    ];

    if (error.code && retryableErrors.includes(error.code)) {
      return true;
    }

    if (error.message) {
      const lowerMessage = error.message.toLowerCase();
      return retryableMessages.some(msg => lowerMessage.includes(msg));
    }

    return false;
  }

  /**
   * Calculate exponential backoff delay with jitter for Windows retries
   */
  calculateRetryDelay(attempt) {
    const baseDelay = 200; // Start with 200ms
    const exponentialDelay = baseDelay * Math.pow(1.5, attempt - 1);
    const jitter = Math.random() * 100; // Add some randomness to avoid thundering herd
    return Math.min(exponentialDelay + jitter, 2000); // Cap at 2 seconds
  }

  /**
   * Clean up any orphaned temporary files in the index directory
   */
  async cleanupTempFiles() {
    try {
      const files = await fs.readdir(this.indexPath);
      const tempFiles = files.filter(file => 
        file.endsWith('.tmp') || 
        file.includes('.tmp') || 
        file.startsWith('.') && file.includes('tmp')
      );

      for (const tempFile of tempFiles) {
        try {
          const tempPath = path.join(this.indexPath, tempFile);
          await fs.unlink(tempPath);
          console.log(`🧹 Cleaned up orphaned temp file: ${tempFile}`);
        } catch (cleanupError) {
          // Ignore cleanup errors - temp file might already be gone
        }
      }
    } catch (error) {
      // Ignore errors reading directory - it might not exist yet
    }
  }
}

module.exports = LocalIndexWrapper;