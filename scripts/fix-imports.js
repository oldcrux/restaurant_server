import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import { exec as execCallback } from 'node:child_process';

const exec = promisify(execCallback);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIST_DIR = join(__dirname, '..', 'dist');

async function* walkDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(path);
    } else if (entry.isFile() && path.endsWith('.js')) {
      yield path;
    }
  }
}

async function fixImports() {
  try {
    console.log('Fixing import extensions...');
    
    for await (const filePath of walkDir(DIST_DIR)) {
      let content = await readFile(filePath, 'utf8');
      
      // Fix import/export statements to include .js extension
      content = content.replace(
        /(from\s+['"])(\.*?)(?=(\/index)?(\.[a-z]+)?['"])/g,
        (match, p1, p2) => {
          // Don't modify node_modules imports or built-in modules
          if (p2.startsWith('@') || p2.startsWith('node:') || !p2.startsWith('.')) {
            return match;
          }
          
          // If the import already has an extension, leave it as is
          if (p2.endsWith('.js') || p2.endsWith('.json') || p2.endsWith('.node')) {
            return match;
          }
          
          // Add .js extension
          return `${p1}${p2}.js`;
        }
      );
      
      await writeFile(filePath, content, 'utf8');
    }
    
    console.log('Successfully fixed import extensions');
    
    // Fix file permissions if needed
    if (process.platform !== 'win32') {
      await exec('chmod +x dist/index.js');
    }
  } catch (error) {
    console.error('Error fixing imports:', error);
    process.exit(1);
  }
}

fixImports();
