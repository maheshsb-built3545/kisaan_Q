const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const regex = /(aadhaar|aadhar|uidai|sha256|\bPAN\b|\bIFSC\b)/i;
const ignoreDirs = ['node_modules', '.git', '.system_generated', 'dist', 'build', '.gemini'];

const hits = [];

function walk(dir) {
  for (const item of fs.readdirSync(dir)) {
    if (ignoreDirs.includes(item)) continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (stat.isFile() && /\.(js|jsx|ts|tsx|json|html|md|css)$/i.test(item)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (regex.test(line)) {
            const relPath = path.relative(root, fullPath).replace(/\\/g, '/');
            hits.push({ file: relPath, line: idx + 1, text: line.trim() });
          }
        });
      } catch (e) {}
    }
  }
}

walk(root);
console.log('TOTAL HITS:', hits.length);
hits.forEach(h => console.log(`${h.file}:${h.line}: ${h.text}`));
