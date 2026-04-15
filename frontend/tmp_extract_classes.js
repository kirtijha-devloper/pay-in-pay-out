const fs = require('fs');
const path = require('path');
const glob = require('glob');
const root = process.cwd();
const files = glob.sync('src/**/*.{jsx,js}');
const cls = new Set();
for (const f of files) {
  const text = fs.readFileSync(path.join(root, f), 'utf8');
  const re = /className\s*=\s*{?['`"]([^"'`]+)['`"]}?/g;
  let m;
  while ((m = re.exec(text))) {
    const parts = m[1].split(/\s+/).filter(Boolean);
    for (const p of parts) cls.add(p);
  }
}
console.log([...cls].sort().join('\n'));
