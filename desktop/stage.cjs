// Copies the web build (../dist from `vite build`) into ./app-dist, which is what gets packaged.
const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, '..', 'dist');
const dest = path.join(__dirname, 'app-dist');
if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('No web build found. Run `npm run build` in the project root first.');
  process.exit(1);
}
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`staged ${src} -> ${dest}`);
