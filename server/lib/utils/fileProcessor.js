import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { chunkCodeFile, getFileType } from './codeChunking.js';
import { getEmbedding } from './ollamaEmbed.js';

export async function processFolder(folderPath, options = {}) {
  const {
    extensions = [
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.md',
      '.txt',
      '.json',
      '.toml',
      '.css',
      '.sql',
      '.html',
      '.env',
      '.env.local',
      '.env.development',
      '.env.test',
      '.env.production',
      '.yaml',
      '.yml',
      '.xml',
      '.sh',
      '.bat',
      '.ps1',
      '.dockerfile',
      '.gitignore',
      '.gitattributes',
      '.eslintrc',
      '.prettierrc',
      '.babelrc',
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'composer.json',
      'requirements.txt',
      'Pipfile',
      'pyproject.toml',
      'Cargo.toml',
      'go.mod',
      'go.sum',
      'Gemfile',
      'pom.xml',
      'build.gradle',
      'Makefile',
      'CMakeLists.txt',
      'README',
      'LICENSE',
      'CHANGELOG',
      'CONTRIBUTING',
    ],
    maxDepth = 10,
    ignore = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      'logs',
      'tmp',
      'temp',
      '.vscode',
    ],
  } = options;

  const files = [];

  function scanDirectory(dir, depth = 0) {
    if (depth > maxDepth) return;

    try {
      const items = readdirSync(dir);

      for (const item of items) {
        if (ignore.includes(item)) continue;

        const fullPath = path.join(dir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          scanDirectory(fullPath, depth + 1);
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning ${dir}:`, error.message);
    }
  }

  scanDirectory(folderPath);
  return files;
}

export async function processFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const fileType = getFileType(filePath);
    const chunks = chunkCodeFile(filePath, content);

    const processedChunks = [];

    for (const chunk of chunks) {
      const embedding = await getEmbedding(chunk.content);

      processedChunks.push({
        filePath,
        fileType,
        chunkType: chunk.type,
        content: chunk.content,
        embedding,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        size: chunk.content.length,
      });
    }

    return processedChunks;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return [];
  }
}
