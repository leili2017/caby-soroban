// Logic tests for the kids course (engine, lessons, runner). Run: node test/kids.test.js
const assert = require('assert');
const path = require('path');
const S = require(path.join(__dirname, '..', 'kids', 'soroban.js'));
const L = require(path.join(__dirname, '..', 'kids', 'lessons.js'));
const R = require(path.join(__dirname, '..', 'kids', 'runner.js'));

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`FAIL ${name}\n  ${e.message}`); process.exitCode = 1; }
}
const rng = seed => L.mulberry32(seed);

// ---------- engine ----------
test('every digit round-trips through beads', () => {
  for (let d = 0; d <= 9; d++) assert.strictEqual(S.digitFrom(S.beadsFor(d)), d);
});
test('toValue and toDigits agree', () => {
  assert.strictEqual(S.toValue([4, 7]), 47);
  assert.deepStrictEqual(S.toDigits(7, 2), [0, 7]);
  assert.deepStrictEqual(S.toDigits(47, 2), [4, 7]);
});
test('tapping a bead moves the whole stack toward the bar', () => {
  assert.strictEqual(S.tap(0, 'earth', 2), 3);   // third bead pulls two others with it
  assert.strictEqual(S.tap(3, 'earth', 0), 0);   // first bead pushes all three back
  assert.strictEqual(S.tap(3, 'earth', 2), 2);   // top of stack steps down by one
});
test('heaven bead adds and removes exactly five', () => {
  for (let d = 0; d <= 9; d++) {
    const t = S.tap(d, 'heaven', 0);
    assert.strictEqual(t, d >= 5 ? d - 5 : d + 5);
  }
});
test('drag moves a bead toward or away from the bar', () => {
  assert.strictEqual(S.move(0, 'earth', 3, true), 4);
  assert.strictEqual(S.move(4, 'earth', 1, false), 1);
  assert.strictEqual(S.move(2, 'heaven', 0, true), 7);
  assert.strictEqual(S.move(7, 'heaven', 0, false), 2);
});
test('no move can produce an invalid digit', () => {
  for (let d = 0; d <= 9; d++) for (const toward of [true, false]) {
    for (let i = 0; i < 4; i++) { const v = S.move(d, 'earth', i, toward); assert.ok(v >= 0 && v <= 9); }
    const h = S.move(d, 'heaven', 0, toward); assert.ok(h >= 0 && h <= 9);
  }
});
test('earth moves never change the heaven bead', () => {
  for (let d = 0; d <= 9; d++) for (let i = 0; i < 4; i++) for (const t of [true, false]) {
    assert.strictEqual(S.move(d, 'earth', i, t) >= 5, d >= 5);
  }
});

// ---------- lessons ----------
test('curriculum ids are unique, ordered, and reference real modules', () => {
  assert.strictEqual(new Set(L.ORDER).size, L.ORDER.length);
  for (const l of L.LESSONS) assert.ok(L.MODULES.some(m => m.id === l.module), l.id);
  assert.deepStrictEqual(L.ORDER, [...L.ORDER].sort());
});
test('every lesson builds its full item count, deterministically', () => {
  for (const l of L.LESSONS) {
    const a = l.gen(rng(7)), b = l.gen(rng(7));
    assert.strictEqual(a.length, l.count, l.id);
    assert.deepStrictEqual(a, b, `${l.id} not deterministic`);
    assert.ok(l.mastery <= l.count, l.id);
  }
});
test('every item has a spoken prompt and valid bead digits (200 seeds)', () => {
  for (const l of L.LESSONS) for (let s = 0; s < 200; s++) {
    for (const it of l.gen(rng(s))) {
      assert.ok(it.say && it.say.length > 0, `${l.id} missing say`);
      assert.ok(['set', 'read', 'part'].includes(it.kind), `${l.id} kind`);
      for (const arr of [it.start, it.target]) if (arr) {
        assert.strictEqual(arr.length, it.rods, `${l.id} rod count`);
        arr.forEach(d => assert.ok(Number.isInteger(d) && d >= 0 && d <= 9, `${l.id} digit ${d}`));
      }
      if (it.kind === 'set') assert.strictEqual(S.toValue(it.target), it.answer, `${l.id} target != answer`);
      if (it.kind === 'set' && l.id !== '2.4') assert.strictEqual(S.toValue(it.start), 0, `${l.id} should start empty`);
    }
  }
});
test('read items: 3 unique choices, exactly one correct, all plausible numbers', () => {
  for (const id of ['1.4', '2.3']) for (let s = 0; s < 300; s++) {
    for (const it of L.byId[id].gen(rng(s))) {
      assert.strictEqual(it.choices.length, 3, id);
      assert.strictEqual(new Set(it.choices).size, 3, `${id} duplicate choices ${it.choices}`);
      assert.strictEqual(it.choices.filter(c => c === it.answer).length, 1, id);
      assert.strictEqual(S.toValue(it.target), it.answer, id);
      it.choices.forEach(c => assert.ok(id === '1.4' ? c >= 0 && c <= 9 : c >= 10 && c <= 99, `${id} choice ${c}`));
    }
  }
});
test('1.2 and 1.3 cover their whole ranges evenly', () => {
  for (const [id, lo, hi] of [['1.2', 0, 4], ['1.3', 5, 9]]) {
    const counts = {};
    for (const it of L.byId[id].gen(rng(3))) counts[it.answer] = (counts[it.answer] || 0) + 1;
    for (let v = lo; v <= hi; v++) assert.strictEqual(counts[v], 2, `${id} value ${v}`);
  }
});
test('1.1 asks for all three parts and hints only early items', () => {
  const items = L.byId['1.1'].gen(rng(1));
  assert.deepStrictEqual([...new Set(items.map(i => i.answer))].sort(), ['bar', 'earth', 'heaven']);
  assert.strictEqual(items.filter(i => i.hint).length, 3);
});
test('2.2 includes four numbers needing the top bead on both rods', () => {
  for (let s = 0; s < 100; s++) {
    const items = L.byId['2.2'].gen(rng(s));
    const both = items.filter(i => i.target[0] >= 5 && i.target[1] >= 5);
    assert.ok(both.length >= 4, `seed ${s}: ${both.length}`);
    items.forEach(i => assert.ok(i.answer % 10 !== 0, 'no round numbers in 2.2'));
  }
});
test('2.4 counting items: correct delta, balanced, crosses tens', () => {
  for (let s = 0; s < 200; s++) {
    const items = L.byId['2.4'].gen(rng(s));
    const up = items.filter(i => i.badge === '+1'), down = items.filter(i => i.badge === '−1');
    assert.strictEqual(up.length, 5); assert.strictEqual(down.length, 5);
    up.forEach(i => assert.strictEqual(i.answer, S.toValue(i.start) + 1));
    down.forEach(i => assert.strictEqual(i.answer, S.toValue(i.start) - 1));
    items.forEach(i => assert.ok(i.answer >= 10 && i.answer <= 99, `${i.answer} out of range`));
    assert.ok(up.some(i => i.answer % 10 === 0), 'one +1 crosses a ten');
    assert.ok(down.some(i => i.answer % 10 === 9), 'one −1 crosses a ten');
  }
});

// ---------- runner ----------
const lesson = L.byId['1.2'];
const solve = (s, wrongFirst = 0) => {
  let n = 0;
  while (R.current(s)) { const r = R.submit(s, n < wrongFirst ? false : true); n++; if (r.done) break; }
};
test('a perfect run scores full marks and 3 stars', () => {
  const s = R.start(lesson, rng(1));
  solve(s);
  const r = R.result(s);
  assert.deepStrictEqual([r.score, r.of, r.passed, r.stars], [10, 10, true, 3]);
});
test('a miss costs the point, requeues the item once, and still finishes', () => {
  const s = R.start(lesson, rng(2));
  R.submit(s, false); R.submit(s, true);
  assert.strictEqual(s.queue.length, 11);
  assert.strictEqual(s.firstTry, 0);
  let guard = 0; while (R.current(s) && guard++ < 50) R.submit(s, true);
  assert.ok(guard < 50);
  const r = R.result(s);
  assert.strictEqual(r.score, 9);
  assert.strictEqual(r.passed, true);   // 9 of 10 meets mastery
  assert.strictEqual(r.stars, 2);
});
test('repeated misses on one item requeue it only once', () => {
  const s = R.start(lesson, rng(3));
  for (let i = 0; i < 5; i++) R.submit(s, false);
  assert.strictEqual(s.queue.length, 11);
});
test('second miss on the same item asks for a hint', () => {
  const s = R.start(lesson, rng(4));
  assert.strictEqual(R.submit(s, false).outcome, 'retry');
  assert.strictEqual(R.submit(s, false).outcome, 'hint');
});
test('requeued items do not earn score when answered', () => {
  const s = R.start(lesson, rng(5));
  R.submit(s, false); R.submit(s, true);
  while (R.current(s)) R.submit(s, true);
  assert.strictEqual(s.firstTry, 9);
});
test('failing the mastery bar does not pass', () => {
  const s = R.start(lesson, rng(6));
  for (let i = 0; i < 4; i++) { R.submit(s, false); R.submit(s, true); }
  while (R.current(s)) R.submit(s, true);
  const r = R.result(s);
  assert.strictEqual(r.score, 6);
  assert.strictEqual(r.passed, false);
  assert.strictEqual(r.stars, 1);
});
test('each lesson can be played to the end', () => {
  for (const l of L.LESSONS) {
    const s = R.start(l, rng(11));
    let guard = 0; while (R.current(s) && guard++ < 100) R.submit(s, true);
    assert.strictEqual(R.result(s).stars, 3, l.id);
  }
});

// ---------- progress ----------
const memory = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } }; };
test('progress saves and reloads', () => {
  const st = memory(), p = R.load(st);
  R.record(p, '1.1', { score: 9, stars: 2, passed: true }, 100);
  R.save(st, p);
  const q = R.load(st);
  assert.strictEqual(q.lessons['1.1'].best, 9);
  assert.strictEqual(q.lessons['1.1'].passed, true);
});
test('best score and stars never go down, and a pass is kept', () => {
  const p = R.load(memory());
  R.record(p, '1.1', { score: 10, stars: 3, passed: true }, 1);
  R.record(p, '1.1', { score: 4, stars: 1, passed: false }, 2);
  assert.deepStrictEqual([p.lessons['1.1'].best, p.lessons['1.1'].stars, p.lessons['1.1'].passed, p.lessons['1.1'].plays], [10, 3, true, 2]);
});
test('corrupt or missing storage falls back to a fresh start', () => {
  const bad = { getItem: () => '{not json', setItem() {} };
  assert.deepStrictEqual(R.load(bad).lessons, {});
  assert.deepStrictEqual(R.load({ getItem: () => 'null', setItem() {} }).lessons, {});
  assert.doesNotThrow(() => R.save({ setItem() { throw new Error('full'); } }, R.load(bad)));
});
test('lessons unlock in order', () => {
  const p = R.load(memory());
  assert.strictEqual(R.unlocked(p, L.ORDER, '1.1'), true);
  assert.strictEqual(R.unlocked(p, L.ORDER, '1.2'), false);
  R.record(p, '1.1', { score: 9, stars: 2, passed: true }, 1);
  assert.strictEqual(R.unlocked(p, L.ORDER, '1.2'), true);
  assert.strictEqual(R.unlocked(p, L.ORDER, '1.3'), false);
  R.record(p, '1.2', { score: 5, stars: 1, passed: false }, 2);
  assert.strictEqual(R.unlocked(p, L.ORDER, '1.3'), false);
  p.unlockAll = true;
  assert.strictEqual(R.unlocked(p, L.ORDER, '2.4'), true);
});

console.log(`${passed} tests passed${process.exitCode ? ', with failures' : ''}`);
