# embeddings-eval

A Node.js application for evaluating content embeddings using Vectra and OpenAI's text-embedding-3-small model.

## Overview

This application supports multiple datasets with different embedding models:

- **default**: Default project with 10 sample items
- **courses-de**: German course content (10 items)  
- **intranet**: Intranet content (200 items)
- Any dataset with valid `content.json` and `eval.json` files

The application:
1. Reads content from `{dataset}/content.json` (array of objects with `title` and `description` properties)
2. Uses [Vectra](https://github.com/Stevenic/vectra) with configurable embedding models (OpenAI, Google AI, SiliconFlow) to compute embeddings for `title + " " + description`
3. Loads evaluation data from `{dataset}/eval.json` (array of objects with `search` property)
4. Stores embeddings in `{dataset}/embeddings/` folder with standard index structure
5. Searches for each search term and returns the top 3 most relevant results
6. Filters results based on `minSimilarity` threshold from model configuration

## Model Configuration

Each model file contains embedding model settings and search behavior configuration:

- **default-model.json**: OpenAI text-embedding-3-small model (`minSimilarity: 0.4`)
- **oa3large-model.json**: OpenAI text-embedding-3-large model (`minSimilarity: 0.5`)
- **google-model.json**: Google text-embedding-004 model with task types (`minSimilarity: 0.4`)
- **sf-model.json**: SiliconFlow BAAI/bge-large-en-v1.5 model (`minSimilarity: 0.4`)

The `minSimilarity` threshold filters search results to only return matches with similarity scores >= the threshold value. Configuration is now embedded directly in the model files.

For Google models, additional parameters are supported:
- `generate_task_type`: Task type for content embedding generation (e.g., "RETRIEVAL_DOCUMENT")
- `query_task_type`: Task type for search query embedding (e.g., "RETRIEVAL_QUERY")

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your API key(s):
```
# For OpenAI models
OPENAI_API_KEY=your_openai_api_key_here

# For Google AI models  
GOOGLE_API_KEY=your_google_ai_api_key_here

# For SiliconFlow models
SF_API_KEY=your_siliconflow_api_key_here
```

## Usage

### Dataset and Model Selection

All commands support the `--dataset` parameter to specify which dataset to work with and the `--model` parameter to specify which embedding model to use:

**Datasets:**
- `--dataset default` (default): Use default content
- `--dataset courses-de`: Use German content  
- `--dataset intranet`: Use intranet content
- Any folder with valid `content.json` and `eval.json` files

**Models:**
- `--model default` (default): OpenAI text-embedding-3-small model (minSimilarity: 0.4)
- `--model oa3large`: OpenAI text-embedding-3-large model (minSimilarity: 0.5)  
- `--model google`: Google text-embedding-004 model with task types (minSimilarity: 0.4)
- `--model sf`: SiliconFlow BAAI/bge-large-en-v1.5 model (minSimilarity: 0.4)

### Two-Step Process (Recommended)

1. **Generate embeddings and store vectors:**
```bash
npm run generate -- --dataset default --model default
# or
npm run generate -- --dataset courses-de --model oa3large
# or  
npm run generate -- --dataset intranet --model google
```

2. **Run evaluation for search terms:**
```bash
npm run evaluate -- --dataset default --model default
# or  
npm run evaluate -- --dataset courses-de --model oa3large
# or
npm run evaluate -- --dataset intranet --model google
```

3. **Run interactive query mode:**
```bash
npm run query -- --dataset intranet --model voyageai
```

### Alternative Commands

Run the complete pipeline (generate + evaluate):
```bash
npm start -- --dataset default --model default
# or
npm start -- --dataset courses-de --model oa3large
# or
npm start -- --dataset intranet --model google
```

### Command Details

- `npm run generate -- --dataset {name} --model {model}`: Creates embeddings for all content in `{dataset}/content.json` and stores them in `{dataset}/embeddings/` folder using the specified model.
- `npm run evaluate -- --dataset {name} --model {model}`: Runs search evaluation using queries from `{dataset}/eval.json` against the existing vector index for the specified model.
- `npm run query -- --dataset {name} --model {model}`: Interactive query mode that prompts for a search term and displays results in the same format as evaluate mode.
- `npm start -- --dataset {name} --model {model}`: Runs the full pipeline (equivalent to running generate then evaluate)
- `npm run validate`: Validates that all project JSON files exist and shows item counts
- `npm run validate-project {name}`: Validates a specific project

**Note:** The `--` separator is required when passing parameters through npm scripts. Alternatively, you can run the commands directly:
```bash
node index.js generate --dataset courses-de --model oa3large
node index.js evaluate --dataset default --model google
node index.js query --dataset intranet --model voyageai
node index.js --dataset default --model default  # full pipeline
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

### Evaluate Command (`npm run evaluate -- --dataset {name} --model {model}`)
The application will:
1. Load the existing dataset and model-specific vector index from `{dataset}/embeddings/`
2. Search for each query in the `{dataset}/eval.json` file  
3. Display top 3 results with similarity scores for each query, filtered by model's minSimilarity threshold
4. Save detailed results to `evaluation-results-{model}.json`

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