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

let failures = 0, passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; } catch (e) { failures++; console.error(`FAIL ${name}\n  ${e.stack.split('\n').slice(0, 3).join('\n  ')}`); }
}

// A fresh page with a fake clock, a recording speech stub, and the SVG bits jsdom lacks.
async function boot(opts = {}) {
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
  function solve() {
    const choices = qa('.choice');
    if (choices.length) { const v = digits().join('').replace(/^0+(?=\d)/, ''); click(choices.find(c => c.textContent === v)); }
    else setDigits(wanted());
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
  });

  await test('1.1: the hint shows on early items only, and a drag to the bar is accepted', async () => {
    const a = await boot();
    a.click(a.q('.card[data-id="1.1"]'));
    assert.ok(a.qa('.ghost').length > 0, 'dotted hint on item 1');
    assert.strictEqual(a.qa('.soroban .bead').length, 5);
    a.solve();
    assert.ok(a.spoken.some(s => /^(Yes|You did it|Great job|Wonderful|Super|Nice work|Well done|That is|Perfect|Awesome|Hooray|Look at you|Fantastic|Brilliant|High five|Just right|You are so good|Exactly)/.test(s.text)), 'praise spoken');
    assert.strictEqual(a.qa('.dots i.done').length, 1);
    assert.deepStrictEqual(a.digits(), [0], 'board is fresh for the next problem');
  });

  await test('a wrong answer is not penalised until he pauses, then Capy encourages him', async () => {
    const a = await boot();
    a.click(a.q('.card[data-id="1.2"]'));
    const target = a.wanted(), wrong = [(target[0] + 2) % 5 || 1];
    if (wrong[0] === target[0]) wrong[0] = (wrong[0] % 4) + 1;
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
    const t = a.wanted()[0], wrongs = [1, 2, 3, 4].filter(x => x !== t);
    a.setDigits([wrongs[0]]); a.advance(2300);
    a.setDigits([wrongs[1]]); a.advance(2300);
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

  console.log(`e2e: ${passed} passed${failures ? `, ${failures} FAILED` : ''}`);
  process.exit(failures ? 1 : 0);
})();
