const fs = require('fs');
const path = require('path');
const parser = require(path.resolve(__dirname, '../frontend-web/node_modules/@babel/parser'));
const traverse = require(path.resolve(__dirname, '../frontend-web/node_modules/@babel/traverse')).default;

const BROWSER_GLOBALS = new Set([
  'window', 'document', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'Math', 'Date', 'JSON', 'Promise', 'Number', 'String', 'Boolean', 'Array', 'Object', 'Error',
  'isNaN', 'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent', 'localStorage',
  'sessionStorage', 'navigator', 'fetch', 'Event', 'CustomEvent', 'Blob', 'FileReader', 'URL',
  'URLSearchParams', 'AbortController', 'AbortSignal', 'FormData', 'Intl', 'Map', 'Set', 'Symbol',
  'RegExp', 'alert', 'confirm', 'prompt', 'location', 'history', 'crypto', 'performance',
  'requestAnimationFrame', 'cancelAnimationFrame', 'Node', 'Audio', 'speechSynthesis',
  'SpeechSynthesisUtterance', 'SpeechRecognition', 'webkitSpeechRecognition', 'MediaRecorder',
  'AudioContext', 'webkitAudioContext', 'process', 'global', 'Infinity', 'undefined', 'NaN', 'null'
]);

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const basePath = path.resolve(__dirname, '../frontend-web');
const allSrcFiles = getAllFiles(path.join(basePath, 'src'));
const filesToCheck = allSrcFiles.map(p => path.relative(basePath, p).replace(/\\/g, '/'));

console.log('================================================================');
console.log('🔍 RUNNING NO-UNDEF & JSX-NO-UNDEF AST SCOPE ANALYSIS');
console.log('================================================================');

let totalErrors = 0;

for (const relFile of filesToCheck) {
  const fullPath = path.join(basePath, relFile);
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️ File not found: ${relFile}`);
    continue;
  }

  const code = fs.readFileSync(fullPath, 'utf-8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });
  } catch (err) {
    console.error(`❌ Syntax Error parsing ${relFile}: ${err.message}`);
    totalErrors++;
    continue;
  }

  const fileErrors = [];

  traverse(ast, {
    // Check standard identifier references
    ReferencedIdentifier(pathNode) {
      const name = pathNode.node.name;
      // Ignore property access like obj.foo or import specifiers
      if (BROWSER_GLOBALS.has(name)) return;
      if (pathNode.parent.type === 'JSXMemberExpression') return;
      if (pathNode.parent.type === 'MemberExpression' && pathNode.parent.property === pathNode.node && !pathNode.parent.computed) return;
      if (pathNode.parent.type === 'ObjectProperty' && pathNode.parent.key === pathNode.node && !pathNode.parent.computed) return;

      if (!pathNode.scope.hasBinding(name)) {
        fileErrors.push({
          name,
          line: pathNode.node.loc?.start?.line,
          col: pathNode.node.loc?.start?.column,
          type: 'no-undef'
        });
      }
    },

    // Check JSX identifiers (react/jsx-no-undef)
    JSXIdentifier(pathNode) {
      const name = pathNode.node.name;
      // If it's a tag name (not an attribute name)
      if (pathNode.parent.type === 'JSXOpeningElement' && pathNode.parent.name === pathNode.node) {
        // Lowercase HTML tags (div, span, button, etc.) are standard HTML
        if (/^[a-z]/.test(name)) return;
        if (BROWSER_GLOBALS.has(name)) return;
        if (!pathNode.scope.hasBinding(name)) {
          fileErrors.push({
            name,
            line: pathNode.node.loc?.start?.line,
            col: pathNode.node.loc?.start?.column,
            type: 'react/jsx-no-undef'
          });
        }
      }
    }
  });

  if (fileErrors.length > 0) {
    console.log(`\n❌ ${relFile} (${fileErrors.length} undefined identifiers found):`);
    for (const err of fileErrors) {
      console.log(`   ↳ [${err.type}] '${err.name}' at line ${err.line}:${err.col}`);
    }
    totalErrors += fileErrors.length;
  } else {
    console.log(`✅ ${relFile}: 0 undefined identifiers`);
  }
}

console.log('\n================================================================');
console.log(`RESULT: ${totalErrors} total undefined identifier errors found.`);
console.log('================================================================');
