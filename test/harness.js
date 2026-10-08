// Headless logic test for abacus.html (no browser needed).
// Run: node test/harness.js
// Loads the page's inline <script> against a stubbed DOM, generates guided-challenge
// problems at every level, solves each step like a perfect user, and asserts that
// Check accepts it, the final zone matches the answer, and bad input is rejected.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'abacus.html'), 'utf8');
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];

function el() {
  const e = {
    children: [], style: {}, dataset: {}, classList: { toggle() {} },
    value: '1', textContent: '', innerHTML: '',
    appendChild(c) { e.children.push(c); return c; },
    addEventListener() {},
    querySelector() { return el(); },
    querySelectorAll() { return []; },
  };
  return e;
}
const byId = {};
global.document = {
  getElementById: id => byId[id] || (byId[id] = el()),
  createElement: () => el(),
  querySelectorAll: () => [],
};
global.window = global;

// Expose page internals to the test.
eval(src + `
;globalThis.T = {
  get rods() { return rods }, set rods(v) { rods = v },
  newGuided, checkGuided, checkFinal, setMode, placeNum, readZone,
  setLevel(l) { guidedLevel = l },
  get guided() { return guided },
};`);

const errs = [];
let n = 0;
const fail = m => errs.push(m);
const digits = x => String(x).split('').reverse().map(Number);

// Put the beads into the state a correct solver has after step s.
function applyTarget(g, s) {
  T.rods.fill(0);
  if (g.op === 'add' || g.op === 'sub') {
    const m = g.title.match(/(\d+) ([+−]) (\d+)/);
    const a = +m[1], b = +m[3], sg = m[2] === '+' ? 1 : -1;
    let run = a, cnt = -1;
    const ds = digits(b);
    for (let i = 0; i < ds.length; i++) {
      if (ds[i] === 0) continue;
      cnt++; run += sg * ds[i] * 10 ** i;
      if (cnt === s) break;
    }
    T.placeNum(8, run);
  } else if (g.op === 'mul') {
    const m = g.title.match(/(\d+) × (\d+)/);
    const a = +m[1], b = +m[2];
    const aD = digits(a), bD = digits(b);
    let run = 0, cnt = -1, stop = false;
    for (let i = 0; i < bD.length && !stop; i++) {
      for (let j = 0; j < aD.length; j++) {
        if (bD[i] * aD[j] === 0) continue;
        cnt++; run += bD[i] * aD[j] * 10 ** (i + j);
        if (cnt === s) { stop = true; break; }
      }
    }
    T.placeNum(1, a); T.placeNum(4, b); T.placeNum(8, run);
  } else {
    const m = g.title.match(/(\d+) ÷ (\d+)/);
    const D = +m[1], d = +m[2], q = D / d;
    const q1 = Math.floor(q / 10), q0 = q % 10, D1 = q0 * d;
    const st = [[q1, 0, D], [q1, 0, D1], [q1, q0, D1], [q1, q0, 0]][s];
    T.placeNum(8, st[2]); T.rods[2] = st[0]; T.rods[3] = st[1];
  }
}

// 1. Perfect solver passes every step at every level, for every operation.
for (let level = 1; level <= 5; level++) {
  for (let t = 0; t < 300; t++) {
    T.setMode('challenge'); T.setLevel(level); T.newGuided();
    const g = T.guided; n++;
    const label = `L${level} ${g.op} ${g.title}`;
    for (let s = 0; s < g.steps.length; s++) {
      applyTarget(g, s);
      const pre = T.guided.idx;
      T.checkGuided();
      if (T.guided.idx === pre && s < g.steps.length - 1) fail(`${label} step ${s} rejected a correct state`);
    }
    const [a, b] = g.answerRods;
    if (parseInt(T.readZone(a, b), 10) !== g.answer) fail(`${label} final zone ${T.readZone(a, b)} != ${g.answer}`);
  }
}

// 2. All four operations are generated.
const ops = {};
for (let i = 0; i < 2000; i++) { T.setLevel(1 + (i % 5)); T.newGuided(); ops[T.guided.op] = (ops[T.guided.op] || 0) + 1; }
for (const op of ['add', 'sub', 'mul', 'div']) if (!ops[op]) fail(`operation never generated: ${op}`);

// 3. Empty beads are rejected and counted as an error.
T.setLevel(1); T.newGuided(); T.rods.fill(0);
const e0 = T.guided.errors; T.checkGuided();
if (T.guided.errors !== e0 + 1 || T.guided.idx !== 0) fail('empty beads were not rejected');

// 4. Check final answer jumps straight to the last step.
T.newGuided();
const g2 = T.guided; T.rods.fill(0);
T.placeNum(g2.answerRods[1], g2.answer); T.checkFinal();
if (T.guided.idx !== g2.steps.length - 1) fail(`final shortcut did not complete ${g2.title}`);

console.log(`problems tested: ${n}, operations: ${JSON.stringify(ops)}`);
if (errs.length) {
  console.error(`FAIL: ${errs.length} failure(s)`);
  console.error(errs.slice(0, 15).join('\n'));
  process.exit(1);
}
console.log('PASS');
