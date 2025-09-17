# Embeddings Evaluation Application

A Node.js application for evaluating content embeddings using Vectra and OpenAI's text-embedding-3-small model.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Prerequisites
- Node.js v20+ (current version: v20.19.5)
- OpenAI API key for full functionality

### Initial Setup
Run these commands in order for a fresh repository clone:

1. **Install dependencies** (takes ~4-7 seconds):
   ```bash
   npm install
   ```

2. **Validate data files** (takes ~0.18 seconds):
   ```bash
   npm run validate
   ```
   This verifies that all project JSON files are properly formatted and reports item counts for all projects.

3. **Create environment configuration**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your OpenAI API key:
   ```
   OPENAI_API_KEY=your_actual_openai_api_key_here
   ```

### Running the Application

The application supports multiple datasets (projects) and configurations:
- **Available datasets**: `default`, `courses-de`
- **Available configs**: `default` (minSimilarity: 0.4), `test` (minSimilarity: 0.5)

#### Two-Step Process (Recommended)
```bash
# Step 1: Generate embeddings for a dataset (NEVER CANCEL - takes 30-60 seconds)
npm run generate -- --dataset default

# Step 2: Run evaluation with specific config
npm run evaluate -- --dataset default --config test
```

#### Alternative Commands
```bash
# Full pipeline (generate + evaluate) in one command
npm start -- --dataset default --config default

# Direct command execution without npm
node index.js generate --dataset courses-de
node index.js evaluate --dataset default --config test
node index.js --dataset default --config default  # full pipeline
```

#### Command Details

- `npm run generate -- --dataset {name}`: Creates embeddings for all content in `{dataset}/content.json` and stores them in a dataset-specific vector index.
- `npm run evaluate -- --dataset {name} --config {config}`: Runs search evaluation using queries from `{dataset}/eval.json` against the existing vector index.
- `npm start -- --dataset {name} --config {config}`: Runs the full pipeline (equivalent to running generate then evaluate)
- `npm run validate`: Validates that all project JSON files exist and shows item counts
- `npm run validate-project {name}`: Validates a specific project

**Note:** The `--` separator is required when passing `--dataset` through npm scripts.

#### Expected behavior with valid API key:
- Reads 10 content items from `{dataset}/content.json`
- Generates embeddings for each item (title + description)
- Builds vector index in `{dataset}/embeddings-index/` directory
- Processes 12 search queries from `{dataset}/eval.json`
- Outputs top 3 results for each query with similarity scores
- Saves results to `{dataset}/evaluation-results-{config}.json`
- **NEVER CANCEL: Runtime varies based on API response times** - typically 30-60 seconds for full evaluation

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

## Project Configuration

Each project can have a configuration file that controls search behavior:

- **default/default.json**: Configuration for the default project (`minSimilarity: 0.4`)
- **test.json**: Configuration for the test project (`minSimilarity: 0.5`)
- **No config**: Projects without configuration files use no filtering (`minSimilarity: 0.0`)

The `minSimilarity` threshold filters search results to only return matches with similarity scores >= the threshold value.

## Data Files Structure

### content.json (per dataset)
Contains 10 content objects with `id`, `title` and `description` properties:
```json
[
  {
    "id": 1,
    "title": "Introduction to Machine Learning",
    "description": "A comprehensive guide to understanding..."
  }
]
```

### eval.json (per dataset)
Contains 12 search query objects with `search` and optional `expected` properties:
```json
[
  {
    "search": "python programming",
    "expected": [6]
  }
]
```

## Validation Scenarios

### Basic Functionality Test
1. **Environment setup validation:**
   ```bash
   npm run validate
   ```
   Expected output: `✓ Project default: Content items: 10, Eval queries: 12` and `✓ Project courses-de: Content items: 10, Eval queries: 12`

2. **Application startup test (without API key):**
   ```bash
   npm start
   ```
   Should display helpful error message about missing API key.

3. **Full evaluation test (with API key) - NEVER CANCEL:**
   ```bash
   npm start -- --dataset default --config default
   ```
   Should complete successfully and create `default/evaluation-results-default.json` and `default/embeddings-index/` directory.

### Manual Testing Scenarios
After making changes, always test:

1. **Configuration validation:** Verify JSON files parse correctly with `npm run validate`
2. **Error handling:** Test without `.env` file to ensure proper error messages
3. **Invalid dataset error:** Test `npm start -- --dataset invalid` to verify error handling
4. **Complete workflow:** Run full evaluation with valid API key to ensure end-to-end functionality
5. **Output verification:** Check that `{dataset}/evaluation-results-{config}.json` contains expected structure with search results, similarity scores, and comprehensive metrics

## Key Files and Directories

### Source Files
- `index.js` - Main application entry point with EmbeddingsEvaluator class
- `lib/embedding.js` - OpenAI REST API integration
- `lib/generate.js` - Embedding generation and index building
- `lib/validate.js` - Project validation utilities
- `lib/metrics.js` - Performance and accuracy metrics calculation
- `package.json` - Dependencies and scripts configuration

### Project Files (per dataset)
- `{dataset}/content.json` - Content data for embedding (10 items)
- `{dataset}/eval.json` - Search queries for evaluation (12 queries)
- `{config}.json` - Configuration files with minSimilarity settings

### Configuration Files
- `.env.example` - Environment variable template
- `.env` - Your actual environment configuration (not committed)
- `.gitignore` - Excludes node_modules, .env, embeddings-index, and output files
- `validate.js` - Validates all projects
- `validate-project.js` - Validates specific projects

### Generated Files/Directories (per dataset)
- `{dataset}/embeddings-index/` - Vector database storage (created by Vectra)
- `{dataset}/evaluation-results-{config}.json` - Output file with search results and comprehensive metrics
- `{dataset}/generation-metrics.json` - Embedding generation performance metrics

### Dependencies
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
- Use only valid datasets: `default`, `courses-de`
- Check command syntax: `npm start -- --dataset default --config test`

### Application creates embeddings-index but fails during search
- This indicates the indexing worked but search queries failed
- Usually related to API key issues during the query phase
- The index is persistent - subsequent runs will reuse it if items count matches

### VS Code Launch Configurations are Outdated
- The `.vscode/launch.json` file still uses `--project` parameter instead of `--dataset`
- Use the command line or update the launch configuration manually

## Development Notes

- **No build step required** - This is a pure Node.js application
- **No test suite** - `npm test` returns "Error: no test specified"
- **No linting configuration** - No ESLint, Prettier, or similar tools configured
- **Dependencies install quickly** - `npm install` completes in ~4-7 seconds
- **Index persistence** - Vector index is stored locally and reused across runs
- **API rate limiting** - Application includes small delays (100-200ms) between API calls
- **Project structure** - Each dataset is a separate folder with its own content, evaluation, and output files

## Architecture Overview

The application follows a modular class-based structure:

1. **EmbeddingsEvaluator class** (index.js) - Main orchestration
2. **EmbeddingService class** (lib/embedding.js) - OpenAI REST API integration using text-embedding-3-small model
3. **Generator class** (lib/generate.js) - Embedding generation and index building
4. **Validator class** (lib/validate.js) - Project validation utilities
5. **Metrics class** (lib/metrics.js) - Performance and accuracy metrics calculation
6. **Vectra LocalIndex** - Vector storage and similarity search
7. **File-based configuration** - JSON data files per dataset
8. **Environment-based API key management** - dotenv for configuration

## Validation Commands Summary

Always run these commands to validate changes:

```bash
# Basic setup and validation
npm install                              # ~4-7 seconds
npm run validate                         # ~0.18 seconds

# Test error handling
npm start                               # Should show API key error without .env
npm start -- --dataset invalid         # Should show invalid dataset error

# Test project-specific validation
npm run validate-project default        # ~0.18 seconds
npm run validate-project courses-de     # ~0.18 seconds

# Full functionality test (requires API key) - NEVER CANCEL
npm start -- --dataset default --config default     # Completes full evaluation workflow (30-60 seconds)
npm run generate -- --dataset courses-de            # Generate embeddings only (30-60 seconds)
npm run evaluate -- --dataset default --config test # Evaluate only (with existing index)
```

**CRITICAL: NEVER CANCEL** long-running embedding operations - they may take 30-60 seconds depending on API response times. The application includes appropriate delays and error handling for API rate limits. Set timeouts to 120+ seconds when using bash commands for generate/evaluate operations.