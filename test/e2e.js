// End-to-end test: loads the real built page in jsdom and plays it with simulated finger drags.
// Needs jsdom, which is not a project dependency:  npm i --no-save jsdom   (or set JSDOM_PATH)
// Run: node scripts/build-kids.js && node test/e2e.js
const assert = require('assert');
const path = require('path');
let JSDOM;
try { ({ JSDOM } = require(process.env.JSDOM_PATH || 'jsdom')); }
catch (e) { console.log('e2e skipped: jsdom not installed (npm i --no-save jsdom)'); process.exit(0); }

const FILE = path.join(__dirname, '..', 'kids', 'capy-soroban.html');
const L = require(path.join(__dirname, '..', 'kids', 'lessons.js'));
const Th = require(path.join(__dirname, '..', 'kids', 'themes.js'));
const Th_speech = require(path.join(__dirname, '..', 'kids', 'speech.js'));
const Coins = require(path.join(__dirname, '..', 'kids', 'coins.js'));

let failures = 0, passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; } catch (e) { failures++; console.error(`FAIL ${name}\n  ${e.stack.split('\n').slice(0, 3).join('\n  ')}`); }
}

// A fresh page with a fake clock, a recording speech stub, and the SVG bits jsdom lacks.
async function boot(opts = {}) {
  const O = opts;
  const spoken = [], errors = [], timers = new Map();
  let now = 0, seq = 0;
  const dom = await JSDOM.fromFile(FILE, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(win) {
      win.addEventListener('error', e => errors.push(e.message));
      win.setTimeout = (fn, ms = 0) => { const id = ++seq; timers.set(id, { fn, at: now + ms }); return id; };
      win.clearTimeout = id => timers.delete(id);
      win.Element.prototype.setPointerCapture = () => {};
      Object.defineProperty(win.SVGSVGElement.prototype, 'viewBox', {
        get() { const [, , w, h] = this.getAttribute('viewBox').split(' ').map(Number); return { baseVal: { width: w, height: h } }; },
      });
      win.SpeechSynthesisUtterance = function (text) { this.text = text; };
      win.speechSynthesis = { cancel() {}, speak: u => spoken.push({ text: u.text, voice: u.voice && u.voice.name }), getVoices: () => opts.voices || [] };
      if (opts.storage) for (const k in opts.storage) win.localStorage.setItem(k, opts.storage[k]);
    },
  });
  const win = dom.window, doc = win.document;
  const q = s => doc.querySelector(s), qa = s => [...doc.querySelectorAll(s)];
  const advance = ms => {
    const end = now + ms;
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]); now = Math.max(now, due[1].at); due[1].fn();
    }
    now = end;
  };
  const fire = (el, type, y = 0) => { const e = new win.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y }); e.pointerId = 1; el.dispatchEvent(e); };
  const click = el => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));

  // ----- driving the beads like a finger -----
  const beadsOf = () => qa('.soroban .bead');
  const digits = () => { const b = beadsOf(), out = []; for (let r = 0; r < b.length / 5; r++) { const s = b.slice(r * 5, r * 5 + 5); out.push((s[0].classList.contains('on') ? 5 : 0) + s.slice(1).filter(x => x.classList.contains('on')).length); } return out; };
  function drag(bead, kind, i, toward) {
    const bnd = win.Soroban.bounds(kind, i), base = bead.classList.contains('on') ? bnd.on : bnd.off;
    const dy = (toward ? bnd.on : bnd.off) - base;
    if (!dy) return;
    fire(bead, 'pointerdown', 300); fire(bead, 'pointermove', 300 + dy); fire(bead, 'pointerup', 300 + dy);
  }
  function setRod(r, digit) {
    const [h, ...e] = beadsOf().slice(r * 5, r * 5 + 5);
    const wantH = digit >= 5, k = digit % 5, cur = e.filter(x => x.classList.contains('on')).length;
    if (h.classList.contains('on') !== wantH) drag(h, 'heaven', 0, wantH);
    if (cur === k) return;
    if (k === 0) drag(e[0], 'earth', 0, false);
    else if (cur < k) drag(e[k - 1], 'earth', k - 1, true);
    else drag(e[k], 'earth', k, false);
  }
  const setDigits = ds => ds.forEach((d, r) => setRod(r, d));
  // What the on-screen problem asks for, read from the bubble.
  function wanted() {
    const rods = beadsOf().length / 5, t = q('#bubble').textContent;
    const m = t.match(/^(\d+)([+\u2212])?(\d+)?$/);
    assert.ok(m, `unreadable bubble "${t}"`);
    const v = Number(m[1]) + (m[2] ? (m[2] === '+' ? 1 : -1) * Number(m[3]) : 0);
    return String(v).padStart(rods, '0').split('').map(Number);
  }
  const covered = () => q('.soroban').classList.contains('covered');
  const num = ds => Number(ds.join(''));
  // Memory items play like a child who remembers: tap the eyes, read the beads while they are visible,
  // wait for them to hide, then answer from what was seen. Nothing is read from hidden state.
  function solveMemory() {
    const peek = q('#peek');
    assert.ok(covered(), 'beads start hidden');
    click(peek);
    assert.ok(!covered(), 'beads show after tapping the eyes');
    assert.ok(!q('#peek'), 'eyes button is gone while looking');
    const seen = digits();
    advance(5200 * peekScale);                          // longer than any lesson's showMs at this setting
    assert.ok(!q('#peek'), 'no second peek once the picture has gone');
    const choices = qa('.choice');
    if (choices.length) {                               // flash or mind
      const m = q('#bubble').textContent.match(/^([+\u2212])(\d+)$/);
      const answer = m ? num(seen) + (m[1] === '+' ? 1 : -1) * Number(m[2]) : num(seen);
      assert.ok(covered(), 'beads are hidden while he answers');
      click(choices.find(c => c.textContent === String(answer)));
    } else {                                            // recall: the board is empty and he builds it
      assert.ok(!covered(), 'board is open to build on');
      assert.deepStrictEqual(digits(), digits().map(() => 0), 'board cleared for recall');
      setDigits(seen);
    }
  }
  let peekScale = O.peekScale || 1;
  const isMemory = () => Boolean(q('#peek'));
  function solve() {
    if (isMemory()) solveMemory();
    else {
      const choices = qa('.choice');
      if (choices.length) { const v = digits().join('').replace(/^0+(?=\\d)/, ''); click(choices.find(c => c.textContent === v)); }
      else setDigits(wanted());
    }
    advance(1600);
  }
  function playLesson(id) {
    click(q(`.card[data-id="${id}"]`));
    let n = 0;
    while (!q('.result') && n++ < 40) solve();
    return n;
  }

  return { dom, win, doc, q, qa, advance, fire, click, spoken, errors, digits, setDigits, wanted, solve, playLesson, storage: () => JSON.parse(win.localStorage.getItem('capy.progress.v1') || 'null') };
}

(async () => {
  await test('the page loads with no errors and shows the home screen', async () => {
    const a = await boot();
    assert.deepStrictEqual(a.errors, []);
    assert.strictEqual(a.qa('.card').length, L.LESSONS.length);
    assert.deepStrictEqual(a.qa('.card:not([disabled])').map(c => c.dataset.id), ['1.1']);
    assert.ok(a.q('.hero svg.capy'), 'friend is drawn');
    // every module heading shows its own friend between the number and the title
    const heads = a.qa('.module h2');
    assert.strictEqual(heads.length, L.MODULES.length);
    heads.forEach((h, i) => {
      const m = L.MODULES[i], t = Th.get(Th.forModule(m.id)), kids = [...h.children];
      assert.deepStrictEqual(kids.map(k => k.className.baseVal || k.className).map(c => c.split(' ')[0]), ['num', 'capy', 'mtitle', 'bank'], `module ${m.id}: number, then animal, then title, then coin balance`);
      assert.strictEqual(kids[0].textContent, String(m.id));
      assert.ok(kids[1].getAttribute('aria-label').includes(t.name), `module ${m.id} shows ${t.name}`);
      assert.strictEqual(kids[2].textContent, m.title);
    });
    assert.strictEqual(new Set(heads.map(h => h.querySelector('svg').getAttribute('aria-label'))).size, heads.length, 'a different animal for each module');
  });

  await test('1.1: the hint shows on early items only, and a drag to the bar is accepted', async () => {
    const a = await boot();
    a.click(a.q('.card[data-id="1.1"]'));
    assert.ok(a.qa('.ghost').length > 0, 'dotted hint on item 1');
    assert.strictEqual(a.qa('.soroban .bead').length, 5);
    a.solve();
    const lines = [...Th_speech.pools.FIRST, ...Th_speech.pools.RETRY, ...Th_speech.pools.STREAK, ...Th_speech.pools.WITH_NUMBER.map(p => p.replace('{n}', '\\d+'))];
    assert.ok(a.spoken.some(s => lines.some(l => new RegExp('^' + l.replace(/[.?!]/g, m => '\\' + m) + '$').test(s.text))), 'praise spoken: ' + JSON.stringify(a.spoken.map(s => s.text)));
    assert.strictEqual(a.qa('.dots i.done').length, 1);
    assert.deepStrictEqual(a.digits(), [0], 'board is fresh for the next problem');
  });

  await test('a wrong answer is not penalised until he pauses, then Capy encourages him', async () => {
    const a = await boot();
    a.click(a.q('.card[data-id="1.2"]'));
    // A wrong position that is neither the answer nor where the beads already sit, so a real move happens.
    const target = a.wanted(), here = a.digits();
    const wrong = [1, 2, 3, 4].filter(x => x !== target[0] && x !== here[0]).slice(0, 1);
    a.setDigits(wrong);
    a.advance(1000);
    assert.ok(!a.q('.coach .capy.oops'), 'no scolding mid-move');
    a.advance(1500);
    assert.ok(a.q('.coach .capy.oops'), 'oops face after the pause');
    assert.ok(/Almost|close|Not quite|another go|Nearly|Oops/.test(a.spoken[a.spoken.length - 1].text));
    assert.strictEqual(a.qa('.dots i.done').length, 0);
  });

  await test('a second miss shows the dotted hint, and a requeued item adds one dot', async () => {
    const a = await boot();
    a.click(a.q('.card[data-id="1.2"]'));
    while (a.wanted()[0] === 0 && a.qa('.dots i').length === 10 && a.qa('.dots i.done').length < 3) a.solve();
    const t = a.wanted()[0];
    const pick = () => [1, 2, 3, 4].filter(x => x !== t && x !== a.digits()[0])[0];
    a.setDigits([pick()]); a.advance(2300);
    a.setDigits([pick()]); a.advance(2300);
    assert.ok(a.qa('.ghost').length > 0, 'hint after two misses');
    assert.ok(/dotted circles/.test(a.spoken[a.spoken.length - 1].text));
    a.setDigits(a.wanted()); a.advance(1600);
    assert.strictEqual(a.qa('.dots i').length, 11, 'missed item comes back once');
  });

  await test('perfect play passes every lesson in order, with the right friend and colours', async () => {
    const a = await boot();
    for (const l of L.LESSONS) {
      const card = a.q(`.card[data-id="${l.id}"]`);
      assert.ok(card && !card.disabled, `${l.id} should be unlocked after the previous one`);
      a.click(card);
      const theme = Th.get(Th.forModule(l.module));
      assert.strictEqual(a.doc.documentElement.style.getPropertyValue('--brand'), theme.palette.brand, `${l.id} colours`);
      assert.ok(a.q('.coach svg').getAttribute('aria-label').includes(theme.name), `${l.id} friend`);
      let n = 0;
      while (!a.q('.result') && n++ < 40) a.solve();
      assert.ok(a.q('.result'), `${l.id} never finished`);
      assert.strictEqual(a.q('.result .stars').textContent.trim(), '⭐⭐⭐', `${l.id} should earn three stars`);
      a.click(a.q('#r-home'));
    }
    assert.deepStrictEqual(a.errors, []);
    const p = a.storage();
    assert.deepStrictEqual(Object.keys(p.lessons).sort(), [...L.ORDER].sort());
    assert.ok(Object.values(p.lessons).every(x => x.passed && x.stars === 3));
    assert.strictEqual(a.qa('.card[disabled]').length, 0);
  });

  await test('progress survives a reload', async () => {
    const a = await boot();
    a.playLesson('1.1'); a.click(a.q('#r-home'));
    const saved = a.win.localStorage.getItem('capy.progress.v1');
    const b = await boot({ storage: { 'capy.progress.v1': saved } });
    assert.deepStrictEqual(b.qa('.card:not([disabled])').map(c => c.dataset.id), ['1.1', '1.2']);
  });

  await test('parent area: opens on press-and-hold, not on a quick tap', async () => {
    const a = await boot();
    const gear = a.q('#gear');
    a.fire(gear, 'pointerdown'); a.advance(300); a.fire(gear, 'pointerup'); a.advance(2000);
    assert.ok(a.q('#parent').hidden, 'quick tap must not open it');
    a.fire(gear, 'pointerdown'); a.advance(1300);
    assert.ok(!a.q('#parent').hidden && /Parent area/.test(a.q('#parent').textContent));
  });

  await test('reset needs two taps, cancels itself, and clears the scores', async () => {
    const a = await boot();
    a.playLesson('1.1'); a.click(a.q('#r-home'));
    const open = () => { a.fire(a.q('#gear'), 'pointerdown'); a.advance(1300); };
    open();
    a.click(a.q('#p-reset'));
    assert.ok(/Tap again/.test(a.q('#p-reset').textContent));
    assert.ok(a.storage().lessons['1.1'], 'one tap erases nothing');
    a.advance(4100);
    assert.strictEqual(a.q('#p-reset').textContent, 'Reset progress', 'disarms after a few seconds');
    a.click(a.q('#p-reset')); a.click(a.q('#p-reset'));
    assert.deepStrictEqual(a.storage().lessons, {});
    assert.ok(a.q('#parent').hidden);
    assert.deepStrictEqual(a.qa('.card:not([disabled])').map(c => c.dataset.id), ['1.1']);
  });

  await test('voice picker lists good voices, saves the choice, and uses it', async () => {
    const voices = [{ name: 'Albert', lang: 'en-US' }, { name: 'Samantha', lang: 'en-US' }, { name: 'Zoe (Premium)', lang: 'en-US' }, { name: 'Amelie', lang: 'fr-FR' }];
    const a = await boot({ voices });
    a.fire(a.q('#gear'), 'pointerdown'); a.advance(1300);
    const sel = a.q('#p-voice');
    assert.deepStrictEqual([...sel.options].map(o => o.value), ['Zoe (Premium)', 'Samantha']);
    sel.value = 'Samantha'; sel.dispatchEvent(new a.win.Event('change', { bubbles: true }));
    assert.strictEqual(a.storage().voice, 'Samantha');
    assert.strictEqual(a.spoken[a.spoken.length - 1].voice, 'Samantha');
  });

  await test('sound off keeps the app silent', async () => {
    const a = await boot();
    a.fire(a.q('#gear'), 'pointerdown'); a.advance(1300);
    a.click(a.q('#p-sound')); a.click(a.q('#p-close'));
    const before = a.spoken.length;
    a.click(a.q('.card[data-id="1.1"]')); a.solve();
    assert.strictEqual(a.spoken.length, before);
  });

  await test('parent can unlock a module: its lessons open, the next module stays shut, and it persists', async () => {
    const a = await boot();
    const open = () => { a.fire(a.q('#gear'), 'pointerdown'); a.advance(1300); };
    assert.deepStrictEqual(a.qa('.card:not([disabled])').map(c => c.dataset.id), ['1.1']);
    open();
    const rows = a.qa('.modrow');
    assert.strictEqual(rows.length, L.MODULES.length, 'one row per module');
    assert.ok(rows.every(r => r.querySelector('[data-mod]')), 'every module can be unlocked at the start');
    a.click(a.q('[data-mod="3"]'));
    assert.ok(/Unlocked/.test(a.q('[data-mod="3"]').textContent), 'button shows the new state');
    assert.deepStrictEqual(a.storage().openModules, [3]);
    a.click(a.q('#p-close'));
    assert.deepStrictEqual(a.qa('.card:not([disabled])').map(c => c.dataset.id), ['1.1', '3.1', '3.2', '3.3', '3.4', '3.5'], 'cards refresh on close');
    a.click(a.q('.card[data-id="3.3"]'));
    assert.ok(a.q('.lesson'), 'an unlocked lesson can be played');
    a.click(a.q('#back'));
    open(); a.click(a.q('[data-mod="3"]')); a.click(a.q('#p-close'));
    assert.deepStrictEqual(a.qa('.card:not([disabled])').map(c => c.dataset.id), ['1.1'], 'locking it again shuts the lessons');
  });

  await test('a module the child has earned shows Open, and unlocks survive a reload and a reset clears them', async () => {
    const a = await boot();
    for (const id of ['1.1', '1.2', '1.3']) { a.playLesson(id); a.click(a.q('#r-home')); }
    a.fire(a.q('#gear'), 'pointerdown'); a.advance(1300);
    assert.strictEqual(a.qa('.modrow')[0].querySelector('[data-mod]'), null, 'module 1 is open by merit');
    assert.ok(/Open/.test(a.qa('.modrow')[0].textContent));
    a.click(a.q('[data-mod="5"]')); a.click(a.q('#p-close'));
    const b = await boot({ storage: { 'capy.progress.v1': a.win.localStorage.getItem('capy.progress.v1') } });
    assert.ok(['5.1', '5.2', '5.3'].every(id => !b.q(`.card[data-id="${id}"]`).disabled), 'unlock survives reload');
    b.fire(b.q('#gear'), 'pointerdown'); b.advance(1300);
    b.click(b.q('#p-reset')); b.click(b.q('#p-reset'));
    assert.deepStrictEqual(b.storage().openModules, []);
    assert.ok(b.q('.card[data-id="5.1"]').disabled);
  });

  const unlocked7 = extra => ({ storage: { 'capy.progress.v1': JSON.stringify({ openModules: [7], ...extra }) } });
  const isCovered = a => a.q('.soroban').classList.contains('covered');

  await test('module 7: the beads start hidden, show when he taps the eyes, hide on time, then he answers', async () => {
    const a = await boot(unlocked7());
    a.click(a.q('.card[data-id="7.1"]'));
    assert.ok(isCovered(a), 'hidden at the start'); assert.ok(a.q('#peek')); assert.strictEqual(a.qa('.choice').length, 0, 'no answers before looking');
    a.click(a.q('#peek'));
    assert.ok(!isCovered(a), 'visible while looking'); assert.strictEqual(a.qa('.choice').length, 0);
    a.advance(2900);
    assert.ok(!isCovered(a) && a.qa('.choice').length === 0, 'still looking just before the time is up');
    a.advance(200);
    assert.ok(isCovered(a), 'hidden again'); assert.strictEqual(a.qa('.choice').length, 3);
    assert.ok(/What number was it/.test(a.spoken[a.spoken.length - 1].text), 'the question is spoken');
  });

  await test('module 7: a wrong answer keeps the beads hidden; the right one shows him the beads he pictured', async () => {
    const a = await boot(unlocked7());
    a.click(a.q('.card[data-id="7.1"]'));
    a.click(a.q('#peek'));
    const seen = a.digits()[0];
    a.advance(3200);
    const wrong = a.qa('.choice').find(c => c.textContent !== String(seen));
    a.click(wrong);
    assert.ok(isCovered(a), 'still hidden after a wrong answer');
    assert.ok(a.q('.coach .capy.oops'));
    a.click(a.qa('.choice').find(c => c.textContent === String(seen)));
    assert.ok(!isCovered(a), 'beads revealed after the right answer');
    assert.deepStrictEqual(a.digits(), [seen]);
  });

  await test('module 7: building from memory starts on an empty board and accepts the number he saw', async () => {
    const a = await boot(unlocked7());
    a.click(a.q('.card[data-id="7.3"]'));
    a.click(a.q('#peek'));
    const seen = a.digits();
    assert.ok(seen.some(d => d > 0), 'two rods shown');
    a.advance(4100);
    assert.ok(!isCovered(a)); assert.deepStrictEqual(a.digits(), [0, 0], 'board cleared to build on');
    assert.ok(/build the number/.test(a.spoken[a.spoken.length - 1].text));
    a.setDigits(seen); a.advance(1600);
    assert.strictEqual(a.qa('.dots i.done').length, 1);
  });

  await test('module 7: imagining plus and minus shows the move, hides the beads, and checks the arithmetic', async () => {
    const a = await boot(unlocked7());
    a.click(a.q('.card[data-id="7.4"]'));
    a.click(a.q('#peek'));
    const start = a.digits()[0];
    a.advance(3200);
    const move = a.q('#bubble').textContent.match(/^([+\u2212])(\d)$/);
    assert.ok(move, 'the move is shown: ' + a.q('#bubble').textContent);
    assert.ok(isCovered(a));
    const right = start + (move[1] === '+' ? 1 : -1) * Number(move[2]);
    assert.ok(a.qa('.choice').some(c => c.textContent === String(right)), 'the right answer is offered');
    assert.ok(!a.spoken.some(s => new RegExp('The abacus shows ' + start).test(s.text)), 'the number to remember is never spoken');
  });

  await test('module 7: the parent can lengthen or shorten how long the picture stays', async () => {
    const a = await boot(unlocked7());
    a.fire(a.q('#gear'), 'pointerdown'); a.advance(1300);
    assert.ok(/Normal/.test(a.q('#p-peek').textContent));
    a.click(a.q('#p-peek')); assert.ok(/Long/.test(a.q('#p-peek').textContent)); assert.strictEqual(a.storage().peekScale, 1.7);
    a.click(a.q('#p-close')); a.click(a.q('.card[data-id="7.1"]')); a.click(a.q('#peek'));
    a.advance(3200); assert.ok(!isCovered(a), 'Long: still looking after the normal time');
    a.advance(2000); assert.ok(isCovered(a), 'Long: hidden after 1.7x');
    const b = await boot(unlocked7({ peekScale: 0.7 }));
    b.click(b.q('.card[data-id="7.1"]')); b.click(b.q('#peek'));
    b.advance(2200); assert.ok(isCovered(b), 'Short: hidden after 0.7x');
  });

  await test('module 7: leaving in the middle of a picture is safe and silent', async () => {
    const a = await boot(unlocked7());
    a.click(a.q('.card[data-id="7.1"]')); a.click(a.q('#peek'));
    const before = a.spoken.length;
    a.click(a.q('#back'));
    a.advance(20000);
    assert.deepStrictEqual(a.errors, []);
    assert.strictEqual(a.spoken.length, before, 'no stray question spoken on the home screen');
    assert.ok(a.q('.home'));
  });

  await test('module 7: the speaker button repeats the current question, not the first instruction', async () => {
    const a = await boot(unlocked7());
    a.click(a.q('.card[data-id="7.1"]')); a.click(a.q('#peek')); a.advance(3200);
    a.click(a.q('#again'));
    assert.ok(/What number was it/.test(a.spoken[a.spoken.length - 1].text));
  });

  await test('module 7: the curtain really covers the beads (stylesheet rule is present)', async () => {
    const a = await boot(unlocked7());
    const css = [...a.doc.querySelectorAll('style')].map(x => x.textContent).join('');
    assert.ok(/\.soroban\.covered \.curtain\s*\{\s*display:\s*inline/.test(css));
    assert.ok(/\.soroban \.curtain\s*\{\s*display:\s*none/.test(css), 'curtain is off unless covered');
    a.click(a.q('.card[data-id="7.1"]'));
    const svg = a.q('.soroban'), kids = [...svg.children];
    assert.strictEqual(kids[kids.length - 1].getAttribute('class'), 'curtain', 'curtain is drawn last, so it is on top');
  });

  // ---------------- coins ----------------
  const purseN = a => Number(a.q('#purse b').textContent);
  const coinsSaved = a => (a.storage() || {}).coins || {};
  // A wrong position for a one-rod "set" lesson that is neither the answer nor where the beads already sit.
  const wrongDigit = a => { const t = a.wanted()[0], here = a.digits()[0]; return [0, 1, 2, 3, 4, 6, 7, 8].filter(x => x !== t && x !== here)[0]; };

  await test('coins: each module heading shows its own coin and a balance, starting at zero', async () => {
    const a = await boot();
    const banks = a.qa('.module h2 .bank');
    assert.strictEqual(banks.length, L.MODULES.length);
    banks.forEach((b, i) => {
      const id = Coins.forModule(L.MODULES[i].id);
      assert.ok(b.querySelector('svg').getAttribute('aria-label').startsWith(id), `module ${L.MODULES[i].id} shows ${id}`);
      assert.strictEqual(b.querySelector('b').textContent, '0');
    });
    assert.strictEqual(new Set(banks.map(b => b.querySelector('svg').getAttribute('aria-label'))).size, banks.length, 'a different coin per module');
  });

  await test('coins: a right answer adds the question worth and shows a +N that fades', async () => {
    const a = await boot();
    a.click(a.q('.card[data-id="1.2"]'));
    assert.ok(a.q('#purse svg').getAttribute('aria-label').startsWith('copper'));
    assert.strictEqual(purseN(a), 0);
    a.setDigits(a.wanted()); a.advance(50);
    assert.strictEqual(purseN(a), 1, '1.2 pays one coin');
    assert.ok(/^\+1$/.test(a.q('#purse .pop').textContent) && a.q('#purse .pop.good'));
    a.advance(1300);
    assert.ok(!a.q('#purse .pop'), 'the +1 fades away');
    assert.strictEqual(purseN(a), 1);
    assert.strictEqual(coinsSaved(a).copper, 1, 'saved at once');
  });

  await test('coins: the first wrong try costs one coin (never below zero); later wrong tries cost nothing', async () => {
    const a = await boot({ storage: { 'capy.progress.v1': JSON.stringify({ coins: { copper: 3 } }) } });
    a.click(a.q('.card[data-id="1.2"]'));
    assert.strictEqual(purseN(a), 3);
    a.setDigits([wrongDigit(a)]); a.advance(2300);
    assert.strictEqual(purseN(a), 2, 'first wrong try costs one');
    assert.ok(a.q('#purse .pop.bad') && /^\u22121$/.test(a.q('#purse .pop').textContent));
    a.setDigits([wrongDigit(a)]); a.advance(2300);
    assert.strictEqual(purseN(a), 2, 'a second wrong try on the same question costs nothing');
    a.setDigits(a.wanted()); a.advance(50);
    assert.strictEqual(purseN(a), 3, 'then the right answer still pays');
    assert.strictEqual(coinsSaved(a).copper, 3);
  });

  await test('coins: with an empty purse a mistake cannot go negative', async () => {
    const a = await boot();
    a.click(a.q('.card[data-id="1.2"]'));
    a.setDigits([wrongDigit(a)]); a.advance(2300);
    assert.strictEqual(purseN(a), 0);
    assert.ok(!a.q('#purse .pop'), 'no -1 is shown when nothing was lost');
    assert.ok(a.q('.coach .capy.oops'));
    assert.ok(!('copper' in coinsSaved(a)) || coinsSaved(a).copper === 0);
  });

  await test('coins: a repeated question pays and costs nothing', async () => {
    const a = await boot({ storage: { 'capy.progress.v1': JSON.stringify({ coins: { copper: 5 } }) } });
    a.click(a.q('.card[data-id="1.2"]'));
    a.setDigits([wrongDigit(a)]); a.advance(2300);            // miss the first question: -1, and it is queued again
    a.setDigits(a.wanted()); a.advance(1600);                 // fix it: +1
    assert.strictEqual(purseN(a), 5);
    let n = 0; while (a.qa('.dots i').length - a.qa('.dots i.done').length > 1 && n++ < 20) a.solve();
    const before = purseN(a);
    assert.strictEqual(a.qa('.dots i').length, 11, 'the repeat is the last dot');
    a.setDigits(a.wanted()); a.advance(50);                   // the repeat
    assert.strictEqual(purseN(a), before, 'the practice repeat pays nothing');
    a.advance(1600);
    assert.ok(a.q('.result'));
  });

  await test('coins: harder lessons pay more per question, in their own coin', async () => {
    const earn = async (id, storage) => {
      const a = await boot(storage ? { storage } : {});
      a.click(a.q(`.card[data-id="${id}"]`)); let n = 0;
      while (!a.q('.result') && n++ < 40) a.solve();
      return { a, coin: coinsSaved(a), total: Object.values(coinsSaved(a)).reduce((x, y) => x + y, 0) };
    };
    const open = { 'capy.progress.v1': JSON.stringify({ unlockAll: true }) };
    const easy = await earn('1.2', open), hard = await earn('5.1', open);
    assert.deepStrictEqual(Object.keys(easy.coin), ['copper']);
    assert.deepStrictEqual(Object.keys(hard.coin), [Coins.forModule(5)], '5.1 pays only in its own module coin');
    assert.ok(hard.total > easy.total * 3, `5.1 paid ${hard.total}, 1.2 paid ${easy.total}`);
    assert.ok(easy.a.q('.result .earned') && /^\+\d+$/.test(easy.a.q('.result .earned b').textContent));
    assert.strictEqual(Number(easy.a.q('.result .earned b').textContent.slice(1)), easy.total, 'the result screen shows what this lesson paid');
    assert.ok(/You earned \d+ copper coins/.test(easy.a.spoken[easy.a.spoken.length - 1].text), 'and says it aloud');
  });

  await test('coins: every module pays its own coin, and a full playthrough earns in all seven', async () => {
    const a = await boot();
    for (const l of L.LESSONS) { a.click(a.q(`.card[data-id="${l.id}"]`)); let n = 0; while (!a.q('.result') && n++ < 40) a.solve(); a.click(a.q('#r-home')); }
    const saved = coinsSaved(a);
    assert.deepStrictEqual(Object.keys(saved).sort(), [...Coins.ORDER].sort(), 'all seven coin types earned');
    assert.ok(Object.values(saved).every(v => v > 0));
    a.qa('.module h2 .bank').forEach((b, i) => assert.strictEqual(Number(b.querySelector('b').textContent), saved[Coins.forModule(L.MODULES[i].id)], `module ${i + 1} balance on the home screen`));
    assert.ok(saved.sapphire > saved.silver, `friends of ten (sapphire ${saved.sapphire}) pays more than tens and ones (silver ${saved.silver})`);
    assert.ok(saved.ruby > saved.copper, 'bigger numbers pays more than meeting the soroban');
  });

  await test('coins: balances survive a reload, show in the parent area, and reset clears them', async () => {
    const a = await boot();
    a.playLesson('1.1'); a.click(a.q('#r-home'));
    const n = coinsSaved(a).copper; assert.ok(n > 0);
    const b = await boot({ storage: { 'capy.progress.v1': a.win.localStorage.getItem('capy.progress.v1') } });
    assert.strictEqual(Number(b.q('.module h2 .bank b').textContent), n, 'home screen after reload');
    b.fire(b.q('#gear'), 'pointerdown'); b.advance(1300);
    assert.strictEqual(Number(b.q('.modrow .bank b').textContent), n, 'parent area balance');
    b.click(b.q('#p-reset')); b.click(b.q('#p-reset'));
    assert.deepStrictEqual(coinsSaved(b), {});
    assert.strictEqual(b.q('.module h2 .bank b').textContent, '0');
  });

  await test('coins: memory lessons pay the higher price and show the coin in the lesson bar', async () => {
    const a = await boot({ storage: { 'capy.progress.v1': JSON.stringify({ openModules: [7] }) } });
    a.click(a.q('.card[data-id="7.1"]'));
    assert.ok(a.q('#purse svg').getAttribute('aria-label').startsWith('amethyst'));
    a.solve(); a.advance(50);
    assert.strictEqual(purseN(a), 2, 'remembering a digit pays 2');
  });

  console.log(`e2e: ${passed} passed${failures ? `, ${failures} FAILED` : ''}`);
  process.exit(failures ? 1 : 0);
})();
