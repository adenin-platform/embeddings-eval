const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Windows-compatible atomic operations for Vectra
 * Uses system temp directory to avoid permission issues
 */
class WindowsAtomicOperations {
  static async writeFile(filePath, data, options = {}) {
    const { retries = 3, retryDelay = 100 } = options;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.performAtomicWrite(filePath, data);
        return;
      } catch (err) {
        console.log(`Write attempt ${attempt} failed:`, err.message);
        
        if (attempt === retries || this.isNonRetriableError(err)) {
          throw err;
        }
        
        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  static async performAtomicWrite(filePath, data) {
    // Use system temp directory instead of target directory
    const tempDir = os.tmpdir();
    const fileName = path.basename(filePath);
    const tempFileName = `vectra-${Date.now()}-${Math.random().toString(36).substring(2)}-${fileName}`;
    const tempPath = path.join(tempDir, tempFileName);
    
    try {
      console.log(`Writing temp file: ${tempPath}`);
      
      // Write to temporary file in system temp
      await fs.writeFile(tempPath, data, { flag: 'w' });
      
      // Skip the problematic fsync operations on Windows
      // The rename operation below will ensure atomicity
      
      // Ensure target directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      // Atomically move temp file to target
      await fs.rename(tempPath, filePath);
      
      console.log(`Successfully wrote: ${filePath}`);
    } catch (err) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath);
      } catch (cleanupErr) {
        // Ignore cleanup errors
      }
      throw err;
    }
  }

  static isNonRetriableError(err) {
    const nonRetriableCodes = [
      'EACCES', // Permission denied
      'EISDIR', // Is a directory
      'ENOTDIR', // Not a directory
      'EINVAL', // Invalid argument
      'ENOENT', // No such file or directory (for parent dir)
    ];
    
    return err.code && nonRetriableCodes.includes(err.code);
  }
}

module.exports = WindowsAtomicOperations;