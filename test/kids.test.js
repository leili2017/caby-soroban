// Logic tests for the kids course (engine, lessons, runner). Run: node test/kids.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const S = require(path.join(__dirname, '..', 'kids', 'soroban.js'));
const L = require(path.join(__dirname, '..', 'kids', 'lessons.js'));
const R = require(path.join(__dirname, '..', 'kids', 'runner.js'));
const T = require(path.join(__dirname, '..', 'kids', 'speech.js'));
const Th = require(path.join(__dirname, '..', 'kids', 'themes.js'));

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

// ---------- dragging ----------
test('a dragged bead stays on its track and settles at the nearer end', () => {
  for (const [kind, i] of [['heaven', 0], ['earth', 0], ['earth', 3]]) {
    const { on, off } = S.bounds(kind, i);
    const lo = Math.min(on, off), hi = Math.max(on, off);
    assert.strictEqual(S.drag(0, kind, i, lo - 500).y, lo);   // cannot leave the track
    assert.strictEqual(S.drag(0, kind, i, hi + 500).y, hi);
    assert.strictEqual(S.drag(0, kind, i, on).toward, true);
    assert.strictEqual(S.drag(0, kind, i, off).toward, false);
    assert.strictEqual(S.drag(0, kind, i, (on + off) / 2 + (on < off ? -1 : 1)).toward, true);
  }
});
test('dragging a bead to the bar counts it, and its stack comes with it', () => {
  const { on } = S.bounds('earth', 2);
  assert.strictEqual(S.drag(0, 'earth', 2, on).digit, 3);   // pushing the third bead brings the two nearer the bar with it
  assert.strictEqual(S.drag(7, 'heaven', 0, S.bounds('heaven', 0).off).digit, 2);
  assert.strictEqual(S.drag(2, 'heaven', 0, S.bounds('heaven', 0).on).digit, 7);
});
test('dragging a bead away from the bar clears it and the ones beyond it', () => {
  const { off } = S.bounds('earth', 1);
  assert.strictEqual(S.drag(4, 'earth', 1, off).digit, 1);
});
test('every drag result is a valid digit', () => {
  for (let d = 0; d <= 9; d++) for (let y = -50; y <= 500; y += 7) {
    for (const [kind, i] of [['heaven', 0], ['earth', 0], ['earth', 1], ['earth', 2], ['earth', 3]]) {
      const r = S.drag(d, kind, i, y);
      assert.ok(r.digit >= 0 && r.digit <= 9 && Number.isInteger(r.digit));
      if (kind === 'earth') assert.strictEqual(r.digit >= 5, d >= 5);   // earth beads never touch the heaven bead
    }
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
      assert.ok(['set', 'read'].includes(it.kind), `${l.id} kind`);
      for (const arr of [it.start, it.target]) if (arr) {
        assert.strictEqual(arr.length, it.rods, `${l.id} rod count`);
        arr.forEach(d => assert.ok(Number.isInteger(d) && d >= 0 && d <= 9, `${l.id} digit ${d}`));
      }
      if (it.kind === 'set') assert.strictEqual(S.toValue(it.target), it.answer, `${l.id} target != answer`);
      if (it.kind === 'set' && l.id !== '2.4' && !(l.id === '1.2' && it.answer === 0)) assert.strictEqual(S.toValue(it.start), 0, `${l.id} should start empty`);
      if (it.kind === 'set') assert.notStrictEqual(it.start.join(''), it.target.join(''), `${l.id} starts already solved`);
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
test('1.1 alternates one bottom bead and the top bead, hinting only early items', () => {
  for (let sd = 0; sd < 100; sd++) {
    const items = L.byId['1.1'].gen(rng(sd));
    assert.strictEqual(items.filter(i => i.answer === 1).length, 5);
    assert.strictEqual(items.filter(i => i.answer === 5).length, 5);
    assert.strictEqual(items.filter(i => i.hint).length, 3);
    items.forEach(i => { assert.strictEqual(i.kind, 'set'); assert.deepStrictEqual(i.start, [0]); });
  }
});
test('1.2 zero means clearing beads that start at the bar', () => {
  for (let sd = 0; sd < 200; sd++) {
    const zeros = L.byId['1.2'].gen(rng(sd)).filter(i => i.answer === 0);
    assert.strictEqual(zeros.length, 2);
    zeros.forEach(i => { assert.ok(i.start[0] >= 1 && i.start[0] <= 4); assert.deepStrictEqual(i.target, [0]); });
  }
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

// ---------- voice and phrases ----------
const V = (name, lang, local = true) => ({ name, lang, localService: local });
test('voice ranking prefers premium and enhanced, skips novelty and non-English', () => {
  const voices = [
    V('Zarvox', 'en-US'), V('Albert', 'en-US'), V('Amelie', 'fr-FR'), V('Samantha', 'en-US'),
    V('Ava (Enhanced)', 'en-US'), V('Zoe (Premium)', 'en-US'), V('Fred', 'en-US'),
  ];
  const ranked = T.rank(voices).map(v => v.name);
  assert.strictEqual(ranked[0], 'Zoe (Premium)');
  assert.strictEqual(ranked[1], 'Ava (Enhanced)');
  assert.ok(ranked.includes('Samantha'));
  for (const bad of ['Zarvox', 'Albert', 'Amelie', 'Fred']) assert.ok(!ranked.includes(bad), bad);
});
test('a saved voice wins while installed, otherwise fall back to the best', () => {
  const voices = [V('Samantha', 'en-US'), V('Ava (Enhanced)', 'en-US')];
  assert.strictEqual(T.pick(voices, 'Samantha').name, 'Samantha');
  assert.strictEqual(T.pick(voices, 'Gone Voice').name, 'Ava (Enhanced)');
  assert.strictEqual(T.pick(voices, '').name, 'Ava (Enhanced)');
  assert.strictEqual(T.pick([], 'x'), null);
  assert.strictEqual(T.pick([V('Amelie', 'fr-FR')], ''), null);
});
test('praise pools are large and free of duplicates', () => {
  for (const [name, pool] of Object.entries(T.pools)) {
    assert.strictEqual(new Set(pool).size, pool.length, `${name} has duplicates`);
    pool.forEach(p => assert.ok(p.length > 0 && p.length < 60, `${name}: ${p}`));
  }
  assert.ok(T.pools.FIRST.length >= 15 && T.pools.RETRY.length >= 5 && T.pools.OOPS.length >= 5);
});
test('the same praise never repeats back to back or within the last few', () => {
  for (let sd = 0; sd < 50; sd++) {
    const p = T.createPhrases(L.mulberry32(sd));
    const out = Array.from({ length: 300 }, () => p.praise({ first: true, streak: 1 }));
    for (let i = 1; i < out.length; i++) assert.notStrictEqual(out[i], out[i - 1], `seed ${sd} repeated at ${i}`);
    for (let i = 4; i < out.length; i++) {
      const dupes = out.slice(i - 4, i).includes(out[i]);
      if (T.pools.FIRST.includes(out[i]) && T.pools.FIRST.length > 5) assert.ok(!dupes, `seed ${sd} reused "${out[i]}" within 4`);
    }
  }
});
test('praise uses a large share of the pool over a session', () => {
  const p = T.createPhrases(L.mulberry32(1));
  const seen = new Set(Array.from({ length: 100 }, () => p.praise({ first: true, streak: 1 })));
  assert.ok(seen.size >= 15, `only ${seen.size} different phrases`);
});
test('retry praise differs from first-try praise and never claims perfection', () => {
  const p = T.createPhrases(L.mulberry32(2));
  for (let i = 0; i < 100; i++) {
    const r = p.praise({ first: false, streak: 5, n: 7 });
    assert.ok(T.pools.RETRY.includes(r), r);
  }
});
test('streak praise appears every third first-try answer', () => {
  const p = T.createPhrases(L.mulberry32(3));
  assert.ok(T.pools.STREAK.includes(p.praise({ first: true, streak: 3 })));
  assert.ok(T.pools.STREAK.includes(p.praise({ first: true, streak: 6 })));
  assert.ok(!T.pools.STREAK.includes(p.praise({ first: true, streak: 4 })));
});
test('number praise fills the number in and leaves no placeholder', () => {
  let withNumber = 0;
  const p = T.createPhrases(L.mulberry32(4));
  for (let i = 0; i < 400; i++) {
    const r = p.praise({ first: true, streak: 1, n: 42 });
    assert.ok(!r.includes('{n}'), r);
    if (r.includes('42')) withNumber++;
  }
  assert.ok(withNumber > 40 && withNumber < 250, `number used ${withNumber} of 400`);
  assert.ok(!T.createPhrases(L.mulberry32(5)).praise({ first: true, streak: 1 }).includes('undefined'));
});
test('oops, help and done phrases rotate and match their outcome', () => {
  const p = T.createPhrases(L.mulberry32(6));
  const o = Array.from({ length: 40 }, () => p.oops());
  for (let i = 1; i < o.length; i++) assert.notStrictEqual(o[i], o[i - 1]);
  assert.ok(T.pools.HELP.includes(p.help()));
  assert.ok(T.pools.DONE_PASS.includes(p.done(true)));
  assert.ok(T.pools.DONE_TRY.includes(p.done(false)));
});
test('saved progress keeps a chosen voice and defaults to none', () => {
  const st = memory(), pr = R.load(st);
  assert.strictEqual(pr.voice, '');
  pr.voice = 'Ava (Enhanced)'; R.save(st, pr);
  assert.strictEqual(R.load(st).voice, 'Ava (Enhanced)');
});

// ---------- themes ----------
const contrast = (a, b) => {
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
test('all seven friends exist, with unique ids, names and palettes', () => {
  assert.deepStrictEqual(Th.ORDER, ['capybara', 'hedgehog', 'axolotl', 'fennec', 'hamster', 'rabbit', 'dragon']);
  const ts = Th.ORDER.map(id => Th.THEMES[id]);
  assert.strictEqual(new Set(ts.map(t => t.name)).size, 7);
  assert.strictEqual(new Set(ts.map(t => t.palette.bg)).size, 7);
  assert.strictEqual(new Set(ts.map(t => t.palette.brand)).size, 7);
  ts.forEach(t => assert.strictEqual(Th.THEMES[t.id], t));
});
test('every friend draws well-formed SVG with both mouths and a blush', () => {
  for (const id of Th.ORDER) {
    const svg = Th.svg(id, 'happy');
    const stack = [];
    for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
      const [, close, tag, , self] = m;
      if (self) continue;
      if (close) assert.strictEqual(stack.pop(), tag, `${id}: mismatched </${tag}>`);
      else stack.push(tag);
    }
    assert.deepStrictEqual(stack, [], `${id}: unclosed tags`);
    for (const need of ['m-happy', 'm-oops', 'blush', 'viewBox="0 0 200 160"', 'role="img"']) assert.ok(svg.includes(need), `${id} missing ${need}`);
    assert.ok(!/NaN|undefined|\[object/.test(svg), `${id} has a bad value`);
    assert.ok(svg.includes(Th.get(id).name), `${id} aria-label should name the friend`);
  }
});
test('palettes keep text readable: dark on background, white on the big buttons', () => {
  for (const id of Th.ORDER) {
    const p = Th.get(id).palette;
    assert.ok(contrast('#3b2a1a', p.bg) >= 7, `${id} text on background`);
    assert.ok(contrast('#ffffff', p.brand) >= 3, `${id} white on brand (large text)`);
    assert.ok(contrast('#ffffff', p.brandDark) >= 4.5, `${id} white on dark brand`);
  }
});
test('each module gets the next friend, and the list wraps', () => {
  assert.strictEqual(Th.forModule(1), 'capybara');
  assert.strictEqual(Th.forModule(2), 'hedgehog');
  assert.strictEqual(Th.forModule(7), 'dragon');
  assert.strictEqual(Th.forModule(8), 'capybara');
  assert.strictEqual(Th.forModule(9), 'hedgehog');
  for (const m of L.MODULES) assert.ok(Th.THEMES[Th.forModule(m.id)], `module ${m.id}`);
});
test('an unknown theme falls back to the capybara, and bad module numbers do not crash', () => {
  assert.strictEqual(Th.get('nope').id, 'capybara');
  for (const n of [0, -3, 1.5, NaN, undefined]) assert.ok(Th.THEMES[Th.forModule(n)], String(n));
});
test('theme css sets every colour variable the stylesheet uses', () => {
  const css = Th.css(Th.get('rabbit'));
  for (const v of ['--bg', '--brand', '--brand-dark', '--edge', '--dot']) assert.ok(css.includes(v + ':'), v);
  const sheet = fs.readFileSync(path.join(__dirname, '..', 'kids', 'style.css'), 'utf8');
  for (const v of ['--brand', '--brand-dark', '--edge', '--dot']) assert.ok(sheet.includes(`var(${v})`), `${v} unused`);
});

console.log(`${passed} tests passed${process.exitCode ? ', with failures' : ''}`);
