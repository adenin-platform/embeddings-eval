# embeddings-eval

A Node.js application for evaluating content embeddings using Vectra and OpenAI's text-embedding-3-small model.

## Overview

This application supports multiple projects with different configurations:

- **default**: Default project with standard similarity threshold (0.1)
- **courses-de**: German course content  
- **test**: Test project with high similarity threshold (0.5)

The application:
1. Reads content from `{project}/content.json` (array of objects with `title` and `description` properties)
2. Uses [Vectra](https://github.com/Stevenic/vectra) with OpenAI's `text-embedding-3-small` model to compute embeddings for `title + " " + description`
3. Loads evaluation data from `{project}/eval.json` (array of objects with `search` property)
4. **NEW:** Loads project configuration with similarity thresholds from config files
5. Searches for each search term and returns the top 3 most relevant results
6. **NEW:** Filters results based on `minSimilarity` threshold from project configuration

## Project Configuration

Each project can have a configuration file that controls search behavior:

- **default/default.json**: Configuration for the default project (`minSimilarity: 0.1`)
- **test.json**: Configuration for the test project (`minSimilarity: 0.5`)
- **No config**: Projects without configuration files use no filtering (`minSimilarity: 0.0`)

The `minSimilarity` threshold filters search results to only return matches with similarity scores >= the threshold value.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your OpenAI API key:
```
OPENAI_API_KEY=your_openai_api_key_here
```

## Usage

### Dataset and Model Selection

All commands support the `--dataset` parameter to specify which dataset to work with and the `--model` parameter to specify which embedding model to use:

**Datasets:**
- `--dataset default` (default): Use default content with similarity threshold 0.4
- `--dataset courses-de`: Use German content  

**Models:**
- `--model default` (default): OpenAI text-embedding-3-small model  
- `--model oa3large`: OpenAI text-embedding-3-large model

### Two-Step Process (Recommended)

1. **Generate embeddings and store vectors:**
```bash
npm run generate -- --dataset default --model default
# or
npm run generate -- --dataset courses-de --model oa3large
```

2. **Run evaluation for search terms:**
```bash
npm run evaluate -- --dataset default --config test --model default
# or  
npm run evaluate -- --dataset courses-de --config default --model oa3large
```

### Alternative Commands

Run the complete pipeline (generate + evaluate):
```bash
npm start -- --dataset default --config default --model default
# or
npm start -- --dataset courses-de --config test --model oa3large
```

### Command Details

- `npm run generate -- --dataset {name} --model {model}`: Creates embeddings for all content in `{dataset}/content.json` and stores them in a dataset-specific vector index using the specified model.
- `npm run evaluate -- --dataset {name} --config {config} --model {model}`: Runs search evaluation using queries from `{dataset}/eval.json` against the existing vector index for the specified model.
- `npm start -- --dataset {name} --config {config} --model {model}`: Runs the full pipeline (equivalent to running generate then evaluate)
- `npm run validate`: Validates that all project JSON files exist and shows item counts
- `npm run validate-project {name}`: Validates a specific project

**Note:** The `--` separator is required when passing parameters through npm scripts. Alternatively, you can run the commands directly:
```bash
node index.js generate --dataset courses-de --model oa3large
node index.js evaluate --dataset default --config test --model default
node index.js --dataset default --config default --model default  # full pipeline
```

### Development in GitHub Codespaces

This repository is configured for GitHub Codespaces with automatic setup:

1. Click "Code" → "Open with Codespaces" → "New codespace" 
2. Dependencies will be installed automatically
3. Add your OpenAI API key to the codespace secrets as `OPENAI_API_KEY`
4. Run the commands above

## Project Structure

```
├── courses-en/          # English project
│   ├── content.json     # English course content
│   └── eval.json        # English search queries
├── courses-de/          # German project  
│   ├── content.json     # German course content (translated)
│   └── eval.json        # German search queries (translated)
├── index.js             # Main application
└── validate.js          # Validation script
```

## Data Files

### {project}/content.json
Contains an array of content objects with `id`, `title`, and `description`:
```json
[
  {
    "id": 1,
    "title": "Introduction to Machine Learning",
    "description": "A comprehensive guide to understanding the fundamentals..."
  }
]
```

### {project}/eval.json
Contains an array of search queries with optional expected results:
```json
[
  {
    "search": "python programming",
    "expected": [6]
  }
]
```

## Output

### Generate Command (`npm run generate -- --dataset {name} --model {model}`)
The application will:
1. Build a dataset-specific vector index from the content in `{dataset}/content.json`
2. Generate embeddings using the specified model (e.g., OpenAI's text-embedding-3-small)
3. Store the vectors in `{dataset}/embeddings-index-{model}/` with model-specific catalog files (`{model}.json`)
4. Display progress and completion status

### Evaluate Command (`npm run evaluate -- --dataset {name} --config {config} --model {model}`)
The application will:
1. Load the existing dataset and model-specific vector index
2. Search for each query in the `{dataset}/eval.json` file  
3. Display top 3 results with similarity scores for each query
4. Save detailed results to `evaluation-results-{config}.json`

## Example Output

```
🚀 Command: Generate embeddings and store vectors for dataset 'courses-de' using model 'oa3large'

Loading content from dataset 'courses-de' and building index...
Processing item 1/10: Einführung in Machine Learning
Processing item 2/10: JavaScript für Anfänger
...

Search: "python programmierung"
Expected: [6]
Found: [6, 1, 4]
Validation: ✅ All 1 expected results match
Top 3 results:
  1. [ID: 6, Score: 0.8542] Data Science mit Python
     Erkunden Sie Datenanalyse, Visualisierung und statistische Modellierung mit Python-Bibliotheken...
```