// Bundle kids/index.html + style.css + scripts into one self-contained page.
// Usage: node scripts/build-kids.js
// Writes kids/capy-soroban.html and docs/index.html (the copy GitHub Pages serves).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'kids');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

function build() {
  let html = read('index.html');
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/, (_, f) => `<style>\n${read(f)}\n</style>`);
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => {
    const code = read(f);
    if (/<\/script/i.test(code)) throw new Error(`${f} contains </script`);
    return `<script>\n${code}\n</script>`;
  });
  return html;
}

if (require.main === module) {
  const html = build();
  fs.writeFileSync(path.join(dir, 'capy-soroban.html'), html);
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'index.html'), html);
  fs.writeFileSync(path.join(root, 'docs', '.nojekyll'), '');   // serve the files as they are, no Jekyll step
  console.log('wrote kids/capy-soroban.html and docs/index.html', html.length, 'bytes');
}
module.exports = { build };
