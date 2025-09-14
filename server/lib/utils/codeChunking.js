import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import { readFileSync } from 'fs';
import path from 'path';

const jsParser = new Parser();
jsParser.setLanguage(JavaScript);

const tsParser = new Parser();
tsParser.setLanguage(TypeScript.typescript);

export function chunkCodeFile(filePath, content) {
  const ext = path.extname(filePath).toLowerCase();
  const chunks = [];

  try {
    let parser;
    if (ext === '.ts' || ext === '.tsx') {
      parser = tsParser;
    } else if (ext === '.js' || ext === '.jsx') {
      parser = jsParser;
    } else {
      // Fallback to simple chunking for unsupported files
      return chunkByLines(content);
    }

    const tree = parser.parse(content);
    const rootNode = tree.rootNode;

    // Extract top-level nodes (functions, classes, exports, imports)
    for (const child of rootNode.children) {
      const nodeText = content.slice(child.startIndex, child.endIndex);

      if (nodeText.trim().length > 0) {
        chunks.push({
          type: child.type,
          content: nodeText.trim(),
          startLine: child.startPosition.row + 1,
          endLine: child.endPosition.row + 1,
        });
      }
    }

    return chunks.length > 0 ? chunks : chunkByLines(content);
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error.message);
    return chunkByLines(content);
  }
}

function chunkByLines(content, maxLines = 50) {
  const lines = content.split('\n');
  const chunks = [];

  for (let i = 0; i < lines.length; i += maxLines) {
    const chunk = lines.slice(i, i + maxLines).join('\n');
    if (chunk.trim().length > 0) {
      chunks.push({
        type: 'text_block',
        content: chunk.trim(),
        startLine: i + 1,
        endLine: Math.min(i + maxLines, lines.length),
      });
    }
  }

  return chunks;
}

export function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) return 'code';
  if (['.md', '.txt', '.rst'].includes(ext)) return 'documentation';
  if (['.json', '.yml', '.yaml', '.toml'].includes(ext)) return 'config';

  return 'other';
}
