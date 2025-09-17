# Embeddings Evaluation Application

A Node.js application for evaluating content embeddings using Vectra and OpenAI's text-embedding-3-small model.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Prerequisites
- Node.js v20+ (current version: v20.19.5)
- OpenAI API key for full functionality

### Initial Setup
Run these commands in order for a fresh repository clone:

1. **Install dependencies** (takes ~7 seconds):
   ```bash
   npm install
   ```

2. **Validate data files** (takes ~0.2 seconds):
   ```bash
   npm run validate
   ```
   This verifies that all project JSON files are properly formatted and reports item counts for each project.

3. **Create environment configuration**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your OpenAI API key:
   ```
   OPENAI_API_KEY=your_actual_openai_api_key_here
   ```

### Running the Application

**CRITICAL**: The application uses `--dataset` parameter, NOT `--project` (despite some documentation mentioning --project).

#### Basic Commands (Without API Key for Testing)
```bash
npm start                              # Tests error handling
npm start -- --dataset default        # Full pipeline for default dataset  
npm start -- --dataset courses-de     # Full pipeline for German courses
npm run generate -- --dataset default # Generate embeddings only
npm run evaluate -- --dataset default # Evaluate using existing index
```

#### With Valid API Key - NEVER CANCEL
```bash
npm start -- --dataset default
```
**NEVER CANCEL** - Embedding generation may take 30-60 seconds depending on API response times. The application includes rate limiting delays.

**Expected behavior with valid API key:**
- Reads content items from `{dataset}/content.json`
- Generates embeddings for each item (title + description)
- Builds vector index in `{dataset}/embeddings-index/` directory
- Processes search queries from `{dataset}/eval.json`
- Outputs top 3 results for each query with similarity scores
- Saves results to `{dataset}/evaluation-results-{dataset}.json`

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

Each dataset is stored in its own directory with the following structure:

### {dataset}/content.json
Contains content objects with `id`, `title`, and `description` properties:
```json
[
  {
    "id": 1,
    "title": "Introduction to Machine Learning",
    "description": "A comprehensive guide to understanding..."
  }
]
```

### {dataset}/eval.json
Contains search query objects with optional expected results:
```json
[
  {
    "search": "python programming",
    "expected": [6]
  }
]
```

### Available Datasets
- **default**: 10 content items, 12 eval queries
- **courses-de**: 10 content items, 12 eval queries (German)

### Configuration Files  
- **default/default.json**: Configuration for default dataset (`minSimilarity: 0.4`)
- **test.json**: Configuration file (`minSimilarity: 0.5`)
- **No config**: Datasets without configuration files use no filtering (`minSimilarity: 0.0`)

## Validation Scenarios

### Basic Functionality Test
1. **Environment setup validation:**
   ```bash
   npm run validate
   ```
   Expected output: `✓ Project default: Content items: 10, Eval queries: 12` and `✓ Project courses-de: Content items: 10, Eval queries: 12`

2. **Individual project validation:**
   ```bash
   npm run validate-project default
   npm run validate-project courses-de
   ```

3. **Application startup test (without API key):**
   ```bash
   npm start
   ```
   Should display helpful error message about missing API key.

4. **Invalid dataset test:**
   ```bash
   npm start -- --dataset invalid
   ```
   Should show usage examples and list valid datasets.

5. **Full evaluation test (with API key):** 
   ```bash
   npm start -- --dataset default
   ```
   **NEVER CANCEL** - Should complete successfully and create `default/evaluation-results-default.json` and `default/embeddings-index/` directory.

### Manual Testing Scenarios
After making changes, always test:

1. **Configuration validation:** Verify JSON files parse correctly with `npm run validate`
2. **Error handling:** Test without `.env` file to ensure proper error messages
3. **Dataset validation:** Test invalid dataset name to ensure proper error handling
4. **Complete workflow:** Run full evaluation with valid API key to ensure end-to-end functionality
5. **Output verification:** Check that `{dataset}/evaluation-results-{dataset}.json` contains expected structure with search results and similarity scores
6. **Index persistence:** Verify that subsequent runs reuse existing embeddings index when available

## Key Files and Directories

### Source Files
- `index.js` - Main application entry point with EmbeddingsEvaluator class
- `lib/` - Library modules (embedding.js, generate.js, validate.js, metrics.js)
- `validate.js` - Validates all projects (required for npm run validate)
- `validate-project.js` - Validates individual project (for npm run validate-project)
- `package.json` - Dependencies and scripts configuration

### Project Directories
- `default/` - Default project with English content
- `courses-de/` - German course content project
- Each project contains: `content.json`, `eval.json`, optional config files

### Configuration Files
- `.env.example` - Environment variable template
- `.env` - Your actual environment configuration (not committed)
- `.gitignore` - Excludes node_modules, .env, embeddings-index, and output files
- `.devcontainer/devcontainer.json` - GitHub Codespaces configuration
- `.vscode/launch.json` - VSCode debug configurations

### Generated Files/Directories (per dataset)
- `{dataset}/embeddings-index/` - Vector database storage (created by Vectra)
- `{dataset}/evaluation-results-{dataset}.json` - Output file with search results and scores
- `{dataset}/generation-metrics.json` - Generation performance metrics
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

### "Invalid dataset" error
- Use `--dataset default` or `--dataset courses-de`
- **Do NOT use** `--project` (despite some documentation mentioning it)
- Valid datasets are: default, courses-de

### Application creates embeddings-index but fails during search
- This indicates the indexing worked but search queries failed
- Usually related to API key issues during the query phase
- The index is persistent - subsequent runs will reuse it if items count matches

### npm run validate fails with "Cannot find module 'validate.js'"
- The validate.js file should exist in the repository root
- If missing, it needs to be created to support the npm validate script

## Development Notes

- **No build step required** - This is a pure Node.js application
- **No test suite** - `npm test` returns "Error: no test specified"
- **No linting configuration** - No ESLint, Prettier, or similar tools configured
- **Dependencies install quickly** - `npm install` completes in ~7 seconds
- **Index persistence** - Vector index is stored locally per dataset and reused across runs
- **API rate limiting** - Application includes small delays (100-200ms) between API calls
- **CRITICAL**: The codebase uses `--dataset` parameters but some documentation incorrectly mentions `--project`

## Architecture Overview

The application follows a simple class-based structure:

1. **EmbeddingsEvaluator class** handles all functionality
2. **OpenAI integration** for generating embeddings using text-embedding-3-small model
3. **Vectra LocalIndex** for vector storage and similarity search
4. **File-based configuration** using JSON data files in dataset directories
5. **Environment-based API key management** with dotenv
6. **Multi-dataset support** with dataset-specific indexes and results

## Available NPM Scripts

```bash
npm start                    # Run full pipeline (default dataset)
npm run generate            # Generate embeddings only
npm run evaluate            # Evaluate using existing index
npm run eval                # Alias for evaluate
npm run validate            # Validate all projects
npm run validate-project    # Validate specific project
npm test                    # No tests configured (returns error)
```

## Command Line Usage

**All commands support these patterns:**
```bash
# Using npm scripts (requires -- separator)
npm start -- --dataset default --config default
npm run generate -- --dataset courses-de
npm run evaluate -- --dataset default --config test

# Direct node execution  
node index.js --dataset default --config default
node index.js generate --dataset courses-de
node index.js evaluate --dataset default --config test
```

## Validation Commands Summary

Always run these commands to validate changes:

```bash
# Basic setup and validation
npm install                                 # ~7 seconds
npm run validate                           # ~0.2 seconds

# Test error handling scenarios
npm start                                  # Should show API key error without .env
npm start -- --dataset invalid            # Should show valid dataset options

# Test dataset-specific validation
npm run validate-project default          # Should show: Content items: 10, Eval queries: 12
npm run validate-project courses-de       # Should show: Content items: 10, Eval queries: 12

# Full functionality test (requires API key) - NEVER CANCEL
npm start -- --dataset default            # Completes full evaluation workflow, 30-60 seconds
npm start -- --dataset courses-de         # German dataset evaluation, 30-60 seconds
```

**NEVER CANCEL** long-running embedding operations - they may take 30-60 seconds depending on API response times. The application includes appropriate delays and error handling for API rate limits.