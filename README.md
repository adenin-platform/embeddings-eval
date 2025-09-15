# embeddings-eval

A Node.js application for evaluating content embeddings using Vectra Enhanced and OpenAI's text-embedding-3-small model.

## Overview

This application supports multiple projects with language-specific content:

- **default**: Default course content
- **courses-de**: German course content

The application:
1. Reads content from `{project}/content.json` (array of objects with `title` and `description` properties)
2. Uses [Vectra Enhanced](https://github.com/Stevenic/vectra) with OpenAI's `text-embedding-3-small` model to compute embeddings for `title + " " + description`
3. Loads evaluation data from `{project}/eval.json` (array of objects with `search` property)
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

### Project Selection

All commands support the `--project` parameter to specify which project to work with:

- `--project default` (default): Use default content
- `--project courses-de`: Use German content

### Two-Step Process (Recommended)

1. **Generate embeddings and store vectors:**
```bash
npm run generate -- --project default
# or
npm run generate -- --project courses-de
```

2. **Run evaluation for search terms:**
```bash
npm run evaluate -- --project default
# or  
npm run evaluate -- --project courses-de
```

### Alternative Commands

Run the complete pipeline (generate + evaluate):
```bash
npm start -- --project default
# or
npm start -- --project courses-de
```

### Command Details

- `npm run generate -- --project {name}`: Creates embeddings for all content in `{project}/content.json` and stores them in a project-specific vector index.
- `npm run evaluate -- --project {name}`: Runs search evaluation using queries from `{project}/eval.json` against the existing vector index.
- `npm start -- --project {name}`: Runs the full pipeline (equivalent to running generate then evaluate)
- `npm run validate`: Validates that all project JSON files exist and shows item counts
- `npm run validate-project {name}`: Validates a specific project

**Note:** The `--` separator is required when passing `--project` through npm scripts. Alternatively, you can run the commands directly:
```bash
node index.js generate --project courses-de
node index.js evaluate --project default
```

### Development in GitHub Codespaces

This repository is configured for GitHub Codespaces with automatic setup:

1. Click "Code" → "Open with Codespaces" → "New codespace" 
2. Dependencies will be installed automatically
3. Add your OpenAI API key to the codespace secrets as `OPENAI_API_KEY`
4. Run the commands above

## Project Structure

```
├── default/              # Default project
│   ├── content.json      # Default course content
│   └── eval.json         # Default search queries
├── courses-de/           # German project  
│   ├── content.json      # German course content (translated)
│   └── eval.json         # German search queries (translated)
├── index.js              # Main application
└── validate.js           # Validation script
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

### Generate Command (`npm run generate -- --project {name}`)
The application will:
1. Build a project-specific vector index from the content in `{project}/content.json`
2. Generate embeddings using OpenAI's text-embedding-3-small model
3. Store the vectors in `embeddings-index-{project}/`
4. Display progress and completion status

### Evaluate Command (`npm run evaluate -- --project {name}`)
The application will:
1. Load the existing project-specific vector index
2. Search for each query in the `{project}/eval.json` file  
3. Display top 3 results with similarity scores for each query
4. Save detailed results to `evaluation-results-{project}.json`

## Example Output

```
🚀 Command: Generate embeddings and store vectors for project 'courses-de'

Loading content from project 'courses-de' and building index...
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

## Platform Compatibility

### Windows Support

This application includes enhanced Windows compatibility to handle file system differences:

- **Windows File Permissions**: The application automatically detects Windows and uses enhanced retry logic for file operations
- **Temporary File Handling**: Implements Windows-specific temporary file management to avoid EPERM errors
- **Error Recovery**: Includes exponential backoff and cleanup of orphaned temporary files

### Testing Windows Compatibility

You can test the Windows compatibility features using the included test script:

```bash
npm run test-windows
```

This will validate that:
- Vector index creation works without permission errors
- File operations handle Windows file system properly  
- Error handling and retry mechanisms function correctly

## Troubleshooting

### Common Issues

#### EPERM: operation not permitted (Windows)

**Error**: `EPERM: operation not permitted, lstat 'embeddings-index\.index.json.xxx.tmp'`

**Solution**: This has been fixed in the current version. The application now includes Windows-specific file handling that:
- Uses retry logic for permission errors
- Implements proper temporary file cleanup
- Handles Windows file locking behavior

**Verification**: Run `npm run test-windows` to confirm Windows compatibility is working.

#### OpenAI API Connection Issues

**Error**: `getaddrinfo ENOTFOUND api.openai.com` or `OpenAI API error`

**Solutions**:
1. Check your internet connection
2. Verify your OpenAI API key in the `.env` file
3. Ensure your API key has sufficient credits/quota
4. Check if your network blocks OpenAI API endpoints

#### Missing Project Directory

**Error**: `Invalid project 'xyz'. Valid projects are: default, courses-de`

**Solution**: Use only the available project names or create a new project directory with `content.json` and `eval.json` files.