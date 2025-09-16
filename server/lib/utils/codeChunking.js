import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import path from 'path';

const jsParser = new Parser();
jsParser.setLanguage(JavaScript);

const tsParser = new Parser();
tsParser.setLanguage(TypeScript.typescript);

export function chunkCodeFile(filePath, content) {
  const ext = path.extname(filePath).toLowerCase();
  const chunks = [];

  try {
    // Handle markdown files with hybrid chunking
    if (ext === '.md') {
      return chunkMarkdownFile(content);
    }

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

// Hybrid chunking for markdown files with code blocks
export function chunkMarkdownFile(content) {
  const chunks = [];
  const lines = content.split('\n');
  let currentChunk = [];
  let inCodeBlock = false;
  let codeBlockLanguage = '';
  let codeBlockContent = [];
  let lineNumber = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect code block start
    const codeBlockMatch = line.match(/^```(\w+)?/);
    if (codeBlockMatch && !inCodeBlock) {
      // Save any accumulated text chunk
      if (currentChunk.length > 0) {
        const textContent = currentChunk.join('\n').trim();
        if (textContent.length > 0) {
          chunks.push({
            type: 'text_block',
            content: textContent,
            startLine: lineNumber - currentChunk.length,
            endLine: lineNumber - 1,
          });
        }
        currentChunk = [];
      }

      inCodeBlock = true;
      codeBlockLanguage = codeBlockMatch[1] || '';
      codeBlockContent = [];
      continue;
    }

    // Detect code block end
    if (line.match(/^```/) && inCodeBlock) {
      // Process the code block
      if (codeBlockContent.length > 0) {
        const codeContent = codeBlockContent.join('\n');

        // Try to parse with Tree-sitter if it's a supported language
        if (
          ['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx'].includes(
            codeBlockLanguage.toLowerCase(),
          )
        ) {
          try {
            const fakeFileName = `temp.${codeBlockLanguage === 'typescript' || codeBlockLanguage === 'ts' ? 'ts' : 'js'}`;
            const codeChunks = chunkCodeFile(fakeFileName, codeContent);

            // Add parsed code chunks
            codeChunks.forEach((chunk) => {
              chunks.push({
                type: `code_${chunk.type}`,
                content: chunk.content,
                startLine: lineNumber - codeBlockContent.length - 1,
                endLine: lineNumber - 1,
                language: codeBlockLanguage,
              });
            });
          } catch (error) {
            // eslint-disable-next-line no-console
            console.log('Error parsing code block:', error);
            // Fallback to treating as single code block
            chunks.push({
              type: 'code_block',
              content: codeContent,
              startLine: lineNumber - codeBlockContent.length - 1,
              endLine: lineNumber - 1,
              language: codeBlockLanguage,
            });
          }
        } else {
          // Non-JS/TS code block - keep as single chunk
          chunks.push({
            type: 'code_block',
            content: codeContent,
            startLine: lineNumber - codeBlockContent.length - 1,
            endLine: lineNumber - 1,
            language: codeBlockLanguage,
          });
        }
      }

      inCodeBlock = false;
      codeBlockLanguage = '';
      codeBlockContent = [];
      lineNumber++;
      continue;
    }

    // Accumulate content
    if (inCodeBlock) {
      codeBlockContent.push(line);
    } else {
      currentChunk.push(line);
    }

    lineNumber++;
  }

  // Handle any remaining content
  if (currentChunk.length > 0) {
    const textContent = currentChunk.join('\n').trim();
    if (textContent.length > 0) {
      chunks.push({
        type: 'text_block',
        content: textContent,
        startLine: lineNumber - currentChunk.length,
        endLine: lineNumber - 1,
      });
    }
  }

  // If we ended in a code block, save it
  if (inCodeBlock && codeBlockContent.length > 0) {
    chunks.push({
      type: 'code_block',
      content: codeBlockContent.join('\n'),
      startLine: lineNumber - codeBlockContent.length,
      endLine: lineNumber - 1,
      language: codeBlockLanguage,
    });
  }

  return chunks.length > 0 ? chunks : chunkByLines(content);
}

export function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) return 'code';
  if (['.md'].includes(ext)) return 'markdown';
  if (['.txt', '.rst'].includes(ext)) return 'documentation';
  if (['.json', '.yml', '.yaml', '.toml'].includes(ext)) return 'config';

  return 'other';
}
