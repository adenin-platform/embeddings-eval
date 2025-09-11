# embeddings-eval

A Node.js application for evaluating content embeddings using Vectra and OpenAI's text-embedding-3-small model.

## Overview

This application:
1. Reads content from `content.json` (array of objects with `title` and `description` properties)
2. Uses [Vectra](https://github.com/Stevenic/vectra) with OpenAI's `text-embedding-3-small` model to compute embeddings for `title + " " + description`
3. Loads evaluation data from `eval.json` (array of objects with `search` property)
4. Searches for each search term and returns the top 3 most relevant results

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

### Two-Step Process (Recommended)

1. **Generate embeddings and store vectors:**
```bash
npm run generate
```

2. **Run evaluation for search terms:**
```bash
npm run evaluate  
```

### Alternative Commands

Run the complete pipeline (generate + evaluate):
```bash
npm run start
```
or
```bash
npm run eval
```

### Command Details

- `npm run generate`: Creates embeddings for all content in `content.json` and stores them in the vector index. This needs to be run first before evaluation.
- `npm run evaluate`: Runs search evaluation using queries from `eval.json` against the existing vector index. Requires running `generate` first.
- `npm run start` / `npm run eval`: Runs the full pipeline (equivalent to running generate then evaluate)
- `npm run validate`: Validates that the required JSON files exist and shows item counts

### Development in GitHub Codespaces

This repository is configured for GitHub Codespaces with automatic setup:

1. Click "Code" → "Open with Codespaces" → "New codespace" 
2. Dependencies will be installed automatically
3. Add your OpenAI API key to the codespace secrets as `OPENAI_API_KEY`
4. Run the commands above

## Data Files

### content.json
Contains an array of content objects:
```json
[
  {
    "title": "Introduction to Machine Learning",
    "description": "A comprehensive guide to understanding the fundamentals..."
  }
]
```

### eval.json
Contains an array of search queries:
```json
[
  {
    "search": "python programming"
  }
]
```

## Output

### Generate Command (`npm run generate`)
The application will:
1. Build a vector index from the content in `content.json`
2. Generate embeddings using OpenAI's text-embedding-3-small model
3. Store the vectors in the local index
4. Display progress and completion status

### Evaluate Command (`npm run evaluate`)
The application will:
1. Load the existing vector index (requires running generate first)
2. Search for each query in the `eval.json` file  
3. Display top 3 results with similarity scores for each query
4. Save detailed results to `evaluation-results.json`

## Example Output

```
Search: "python programming"
Top 3 results:
  1. [Score: 0.8542] Data Science with Python
     Explore data analysis, visualization, and statistical modeling using Python libraries...
  2. [Score: 0.7231] Machine Learning Fundamentals
     A comprehensive guide to understanding the fundamentals of machine learning...
  3. [Score: 0.6891] Database Design Principles
     Understanding relational database design, normalization, indexing...
```