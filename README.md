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

Run the evaluation:
```bash
npm run eval
```

or

```bash
npm start
```

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

The application will:
1. Build a vector index from the content (on first run)
2. Search for each query in the eval file
3. Display top 3 results with similarity scores
4. Save results to `evaluation-results.json`

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