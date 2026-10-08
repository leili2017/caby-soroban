// Bundle kids/index.html + style.css + scripts into one self-contained file.
// Usage: node scripts/build-kids.js          (writes kids/capy-soroban.html)
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'kids');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
let html = read('index.html');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/, (_, f) => `<style>\n${read(f)}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => {
  const code = read(f);
  if (/<\/script/i.test(code)) throw new Error(`${f} contains </script`);
  return `<script>\n${code}\n</script>`;
});
fs.writeFileSync(path.join(dir, 'capy-soroban.html'), html);
console.log('wrote kids/capy-soroban.html', html.length, 'bytes');
