const fs = require('fs');
const path = require('path');

function scanDir(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results = results.concat(scanDir(full));
    } else if (e.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

const srcDir = path.resolve(__dirname, '../src');
const files = scanDir(srcDir);

const hits = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const rel = path.relative(srcDir, file).replace(/\\/g, '/');

  // Search for direct property accesses: req.body.phone, req.params.farmerPhone, etc.
  lines.forEach((line, idx) => {
    const match = line.match(/req\.(params|query|body)(\?\.|\.)(phone|farmerPhone|mobile|farmerId|userId)\b/);
    if (match) {
      hits.push({
        file: rel,
        line: idx + 1,
        code: line.trim()
      });
    }
  });

  // Search for destructurings: const { ... phone ... } = req.body (including multiline)
  const regexDestruct = /const\s*\{([^}]+)\}\s*=\s*req\.(body|query|params)/g;
  let m;
  while ((m = regexDestruct.exec(content)) !== null) {
    const keys = m[1];
    const source = m[2];
    const targetKeys = ['phone', 'farmerPhone', 'mobile', 'farmerId', 'userId'];
    const foundKeys = targetKeys.filter(k => new RegExp(`\\b${k}\\b`).test(keys));
    if (foundKeys.length > 0) {
      const lineNum = content.slice(0, m.index).split('\n').length;
      hits.push({
        file: rel,
        line: lineNum,
        code: m[0].replace(/\s+/g, ' ')
      });
    }
  }
}

// Remove duplicates by file + line
const uniqueHits = [];
const seen = new Set();
for (const h of hits) {
  const key = `${h.file}:${h.line}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueHits.push(h);
  }
}

uniqueHits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

console.log(`Total unique hits: ${uniqueHits.length}`);
console.log(JSON.stringify(uniqueHits, null, 2));
