# Embeddings Evaluation Application

A Node.js application for evaluating content embeddings using Vectra and OpenAI's text-embedding-3-small model.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Prerequisites
- Node.js v20+ (current version: v20.19.5)
- OpenAI API key for full functionality

### Initial Setup
Run these commands in order for a fresh repository clone:

1. **Install dependencies** (takes ~7-8 seconds):
   ```bash
   npm install
   ```

2. **Validate data files** (takes ~0.2 seconds):
   ```bash
   npm run validate
   ```
   This verifies that `content.json` and `eval.json` are properly formatted and reports item counts.

3. **Create environment configuration**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your OpenAI API key:
   ```
   OPENAI_API_KEY=your_actual_openai_api_key_here
   ```

### Running the Application

#### With Valid API Key
```bash
npm start
```
OR
```bash
npm run eval
```

**Expected behavior with valid API key:**
- Reads 10 content items from `content.json`
- Generates embeddings for each item (title + description)
- Builds vector index in `embeddings-index/` directory
- Processes 10 search queries from `eval.json`
- Outputs top 3 results for each query with similarity scores
- Saves results to `evaluation-results.json`
- **Runtime varies based on API response times** - typically 30-60 seconds for full evaluation

#### Without API Key (Testing Error Handling)
```bash
npm start
```
**Expected output:**
```
❌ Error: OPENAI_API_KEY environment variable is required. Please set it in a .env file.

💡 Please create a .env file with your OpenAI API key:
   OPENAI_API_KEY=your_openai_api_key_here

📖 See .env.example for the template.
```

## Data Files Structure

### content.json
Contains 10 content objects with `title` and `description` properties:
```json
[
  {
    "title": "Introduction to Machine Learning",
    "description": "A comprehensive guide to understanding..."
  }
]
```

### eval.json
Contains 10 search query objects:
```json
[
  {
    "search": "python programming"
  }
]
```

## Validation Scenarios

### Basic Functionality Test
1. **Environment setup validation:**
   ```bash
   npm run validate
   ```
   Expected output: `✓ Content items: 10` and `✓ Eval queries: 10`

2. **Application startup test (without API key):**
   ```bash
   npm start
   ```
   Should display helpful error message about missing API key.

3. **Full evaluation test (with API key):**
   ```bash
   npm start
   ```
   Should complete successfully and create `evaluation-results.json` and `embeddings-index/` directory.

### Manual Testing Scenarios
After making changes, always test:

1. **Configuration validation:** Verify JSON files parse correctly with `npm run validate`
2. **Error handling:** Test without `.env` file to ensure proper error messages
3. **Complete workflow:** Run full evaluation with valid API key to ensure end-to-end functionality
4. **Output verification:** Check that `evaluation-results.json` contains expected structure with search results and similarity scores

## Key Files and Directories

### Source Files
- `index.js` - Main application entry point with EmbeddingsEvaluator class
- `package.json` - Dependencies and scripts configuration
- `content.json` - Content data for embedding (10 items)
- `eval.json` - Search queries for evaluation (10 queries)

### Configuration Files
- `.env.example` - Environment variable template
- `.env` - Your actual environment configuration (not committed)
- `.gitignore` - Excludes node_modules, .env, embeddings-index, and output files

### Generated Files/Directories
- `embeddings-index/` - Vector database storage (created by Vectra)
- `evaluation-results.json` - Output file with search results and scores
- `node_modules/` - NPM dependencies
- `package-lock.json` - Dependency lock file

## Common Issues and Troubleshooting

### "Connection error" when running npm start
- Verify your OpenAI API key is correctly set in `.env`
- Check that your API key has sufficient credits/quota
- Ensure network connectivity to OpenAI API endpoints

### "OPENAI_API_KEY environment variable is required" error
- Create `.env` file with `OPENAI_API_KEY=your_key_here`
- Verify `.env` file is in the repository root directory
- Check that your API key doesn't have extra spaces or quotes

### Application creates embeddings-index but fails during search
- This indicates the indexing worked but search queries failed
- Usually related to API key issues during the query phase
- The index is persistent - subsequent runs will reuse it if items count matches

## Development Notes

- **No build step required** - This is a pure Node.js application
- **No test suite** - `npm test` returns "Error: no test specified"
- **No linting configuration** - No ESLint, Prettier, or similar tools configured
- **Dependencies install quickly** - `npm install` completes in ~7-8 seconds
- **Index persistence** - Vector index is stored locally and reused across runs
- **API rate limiting** - Application includes small delays (100-200ms) between API calls

## Architecture Overview

The application follows a simple class-based structure:

1. **EmbeddingsEvaluator class** handles all functionality
2. **OpenAI integration** for generating embeddings using text-embedding-3-small model
3. **Vectra LocalIndex** for vector storage and similarity search
4. **File-based configuration** using JSON data files
5. **Environment-based API key management** with dotenv

## Validation Commands Summary

Always run these commands to validate changes:

```bash
# Basic setup and validation
npm install                    # ~7-8 seconds
npm run validate              # ~0.2 seconds

# Test error handling
npm start                     # Should show API key error without .env

# Full functionality test (requires API key)
npm start                     # Completes full evaluation workflow
```

**NEVER CANCEL** long-running embedding operations - they may take 30-60 seconds depending on API response times. The application includes appropriate delays and error handling for API rate limits.