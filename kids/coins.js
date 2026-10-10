// Coins: one coin type per module, what each question is worth, and the purse.
// No DOM, so it is fully testable.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Coins = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const f = n => Math.round(n * 10) / 10;
  const poly = (pts, fill, extra = '') => `<polygon points="${pts}" fill="${fill}" ${extra}/>`;
  const circ = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
  function starPoints(cx, cy, ro, ri, n) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? ri : ro, a = -Math.PI / 2 + (i * Math.PI) / n;
      pts.push(`${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`);
    }
    return pts.join(' ');
  }

  // ---------- emblems (centred on 24,24) ----------
  // Every coin has its own shape as well as its own colour, so colour is never the only clue.
  const EMBLEMS = {
    star: (ink) => poly(starPoints(24, 24.5, 11, 4.8, 5), ink),
    moon: (ink) => `<path d="M30 13.5 A11.5 11.5 0 1 0 30 34.5 A9 9 0 1 1 30 13.5Z" fill="${ink}"/>`,
    sun: (ink) => circ(24, 24, 5.6, ink) + [...Array(8)].map((_, i) => {
      const a = (i * Math.PI) / 4;
      return `<line x1="${f(24 + 9.5 * Math.cos(a))}" y1="${f(24 + 9.5 * Math.sin(a))}" x2="${f(24 + 13 * Math.cos(a))}" y2="${f(24 + 13 * Math.sin(a))}" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/>`;
    }).join(''),
    diamond: (ink, face) => poly('24,11 35,24 24,37 13,24', ink) + poly('24,16 30,24 24,32 18,24', face, 'opacity=".4"'),
    heart: (ink) => `<path d="M24 35 C10 26 13 14 20.5 15.5 C22.5 16 24 18 24 18 C24 18 25.5 16 27.5 15.5 C35 14 38 26 24 35Z" fill="${ink}"/>`,
    flower: (ink, face) => [...Array(5)].map((_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      return circ(f(24 + 7.2 * Math.cos(a)), f(24 + 7.2 * Math.sin(a)), 4.6, ink);
    }).join('') + circ(24, 24, 3.6, face),
    bolt: (ink) => poly('27.5,10.5 16,27 22.5,27 20,37.5 32.5,20 25.5,20', ink, 'stroke-linejoin="round"'),
  };

  // Later modules pay in rarer metals and gems.
  const COINS = {
    copper:   { name: 'copper',   rim: '#9c5a24', face: '#e0985a', ink: '#8a4a18', emblem: 'star' },
    silver:   { name: 'silver',   rim: '#7d8895', face: '#dfe4ea', ink: '#66717e', emblem: 'moon' },
    gold:     { name: 'gold',     rim: '#b88400', face: '#ffd84a', ink: '#9a6a00', emblem: 'sun' },
    emerald:  { name: 'emerald',  rim: '#168a4c', face: '#6fe0a0', ink: '#0f6d3b', emblem: 'diamond' },
    sapphire: { name: 'sapphire', rim: '#2a62c4', face: '#8bb8ff', ink: '#1c4a9e', emblem: 'heart' },
    ruby:     { name: 'ruby',     rim: '#b8203f', face: '#ff8aa0', ink: '#8f1830', emblem: 'flower' },
    amethyst: { name: 'amethyst', rim: '#6f3fb8', face: '#cfb0f7', ink: '#542c92', emblem: 'bolt' },
  };
  for (const id in COINS) COINS[id].id = id;
  const ORDER = ['copper', 'silver', 'gold', 'emerald', 'sapphire', 'ruby', 'amethyst'];

  const get = id => COINS[id] || COINS.copper;
  // Module N pays in coin N; the list wraps after the last coin.
  const forModule = n => ORDER[(((n | 0) - 1) % ORDER.length + ORDER.length) % ORDER.length];

  function svg(id) {
    const c = get(id);
    return `<svg class="coin" viewBox="0 0 48 48" role="img" aria-label="${c.name} coin">` +
      circ(24, 24, 22, c.rim) + circ(24, 24, 17.5, c.face, `stroke="${c.rim}" stroke-width="1.6"`) +
      EMBLEMS[c.emblem](c.ink, c.face) +
      '<path d="M11.5 17 A14 14 0 0 1 21 10.5" stroke="#fff" stroke-opacity=".65" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '</svg>';
  }
  const label = (id, n) => `${n} ${get(id).name} coin${n === 1 ? '' : 's'}`;

  // ---------- what a question is worth (1 to 5) ----------
  const num = ds => ds.reduce((a, d) => a * 10 + d, 0);
  const sum = ds => ds.reduce((a, d) => a + d, 0);
  // How one rod changes: the top bead and the bottom beads moving in opposite directions is a friend of five.
  function rodChange(x, y) {
    if (x === y) return 'same';
    const dh = (y >= 5 ? 1 : 0) - (x >= 5 ? 1 : 0), de = (y % 5) - (x % 5);
    return (dh > 0 && de < 0) || (dh < 0 && de > 0) ? 'five' : 'direct';
  }
  // A move from `start` to `target`: 1 for a direct move, +1 for a friend of five, +3 for a carry or borrow
  // (or +1 when both rods change without one). Counting on by one across a ten is a small carry: 2 coins.
  function moveWorth(start, target) {
    const a = num(start), b = num(target);
    let changed = 0, five = false;
    start.forEach((x, r) => {
      const k = rodChange(x, target[r]);
      if (k !== 'same') changed++;
      if (k === 'five') five = true;
    });
    const wraps = start.length === 2 && ((b > a && b % 10 < a % 10) || (b < a && b % 10 > a % 10));
    if (wraps && Math.abs(b - a) === 1) return 2;
    return Math.min(5, 1 + (five ? 1 : 0) + (wraps ? 3 : changed === 2 ? 1 : 0));
  }
  function worth(item) {
    if (!item || !item.target) return 1;
    const rods = item.rods || item.target.length;
    switch (item.kind) {
      case 'read': return rods === 2 ? 2 : 1;
      case 'flash': case 'recall': return rods === 2 ? 3 : 2;           // remembering is harder than looking
      case 'mind': return Math.min(5, moveWorth(item.start, item.target) + 2);   // and so is doing it in his head
      default: return !item.start || sum(item.start) === 0 ? (rods === 2 ? 2 : 1) : moveWorth(item.start, item.target);
    }
  }

  // ---------- earning and losing ----------
  // A right answer pays the question's worth. The first wrong try on a question costs one coin; more wrong
  // tries on the same question cost nothing more, so a question he eventually gets right never leaves him
  // behind (it is worth at least 1). A repeat of a missed question is practice: it neither pays nor costs.
  function settle(item, { ok, attemptsBefore = 0 }) {
    if (!item || item.retry) return 0;
    if (ok) return worth(item);
    return attemptsBefore === 0 ? -1 : 0;
  }

  // ---------- the purse (progress.coins, one count per coin type) ----------
  const count = (p, id) => (p.coins && p.coins[id]) || 0;
  // Returns the change that was actually applied; the purse never goes below zero.
  function add(p, id, delta) {
    if (!p.coins) p.coins = {};
    const before = count(p, id), after = Math.max(0, before + delta);
    p.coins[id] = after;
    return after - before;
  }

  // Settle one answer into the purse. Returns the change actually applied (the purse floors at zero).
  const applyAnswer = (p, coinId, item, ok, attemptsBefore) => add(p, coinId, settle(item, { ok, attemptsBefore }));

  return { COINS, ORDER, get, forModule, svg, label, worth, moveWorth, settle, count, add, applyAnswer };
});
