// Lesson data for Modules 1 and 2. Each lesson declares how to generate its items.
//
// Item shapes (all spoken via `say`; the child never has to read):
//   set  : { kind, rods, show, badge?, start[], target[], answer, say }  child sets beads to `target`
//   read : { kind, rods, target[], answer, choices[3], say }             child picks the number shown
//   part : { kind, rods, part, answer, hint, say }                       child taps a named part
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Lessons = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- small helpers ----------
  function mulberry32(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  function shuffle(rng, a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = int(rng, 0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const range = (lo, hi, step = 1) => { const r = []; for (let v = lo; v <= hi; v += step) r.push(v); return r; };
  // n values drawn evenly from a pool of unique values, never the same twice in a row.
  function balanced(rng, pool, n) {
    const out = [];
    while (out.length < n) {
      const round = shuffle(rng, pool);
      if (out.length && pool.length > 1 && round[0] === out[out.length - 1]) round.push(round.shift());
      out.push(...round);
    }
    return out.slice(0, n);
  }
  const digitsOf = (n, rods) => String(n).padStart(rods, '0').split('').map(Number);

  // ---------- item builders ----------
  const setItem = (v, rods, extra = {}) => ({
    kind: 'set', rods, show: v, start: Array(rods).fill(0), target: digitsOf(v, rods), answer: v,
    say: v === 0 ? 'Show zero. Push every bead away from the bar.' : `Show ${v} on your abacus. Then show it here.`,
    ...extra,
  });
  const readItem = (v, rods, choices) => ({
    kind: 'read', rods, target: digitsOf(v, rods), answer: v, choices, say: 'What number do you see?',
  });
  const PART_SAY = { bar: 'Tap the bar in the middle.', heaven: 'Tap the top bead.', earth: 'Tap a bottom bead.' };

  // Wrong answers a child is likely to pick.
  function digitChoices(rng, d) {
    const near = [d + 1, d - 1, d < 5 ? d + 5 : d - 5].filter(x => x >= 0 && x <= 9);
    return shuffle(rng, [d, ...shuffle(rng, near).slice(0, 2)]);
  }
  function numberChoices(rng, v) {
    const swap = (v % 10) * 10 + Math.floor(v / 10); // digits reversed: the classic place-value mix-up
    const near = [v + 1, v - 1, v + 10, v - 10].filter(x => x >= 10 && x <= 99);
    const wrong = swap !== v && swap >= 10 ? [swap] : [];
    for (const x of shuffle(rng, near)) if (wrong.length < 2 && !wrong.includes(x)) wrong.push(x);
    return shuffle(rng, [v, ...wrong]);
  }

  // ---------- curriculum ----------
  const MODULES = [
    { id: 1, title: 'Meet the soroban' },
    { id: 2, title: 'Tens and ones' },
  ];

  const LESSONS = [
    {
      id: '1.1', module: 1, icon: '👆', title: 'Parts of the soroban', rods: 1, count: 10, mastery: 9,
      intro: 'Hi! I am Capy. This is a soroban. Let us learn its parts.',
      gen: rng => balanced(rng, ['bar', 'heaven', 'earth'], 10).map((part, i) => ({
        kind: 'part', rods: 1, part, answer: part, hint: i < 3, start: [0], say: PART_SAY[part],
      })),
    },
    {
      id: '1.2', module: 1, icon: '🌱', title: 'Bottom beads, 0 to 4', rods: 1, count: 10, mastery: 9,
      intro: 'Push beads up to the bar to count them. Let us try the bottom beads.',
      gen: rng => balanced(rng, range(0, 4), 10).map(v => setItem(v, 1)),
    },
    {
      id: '1.3', module: 1, icon: '🍊', title: 'The top bead is five', rods: 1, count: 10, mastery: 9,
      intro: 'The top bead is worth five! Push it down to the bar.',
      gen: rng => balanced(rng, range(5, 9), 10).map(v => setItem(v, 1)),
    },
    {
      id: '1.4', module: 1, icon: '👀', title: 'Read the beads', rods: 1, count: 10, mastery: 9,
      intro: 'Now you read the beads. Which number is it?',
      gen: rng => balanced(rng, range(0, 9), 10).map(v => readItem(v, 1, digitChoices(rng, v))),
    },
    {
      id: '2.1', module: 2, icon: '🔟', title: 'Tens', rods: 2, count: 10, mastery: 8,
      intro: 'Two rods! The left rod is tens. The right rod is ones.',
      gen: rng => balanced(rng, range(10, 90, 10), 10).map(v =>
        setItem(v, 2, { say: `Show ${v}. Tens go on the left rod.` })),
    },
    {
      id: '2.2', module: 2, icon: '🧩', title: 'Tens and ones together', rods: 2, count: 10, mastery: 8,
      intro: 'Tens and ones together! Set the left rod, then the right rod.',
      gen: rng => {
        // Four numbers that need the top bead on both rods, six others.
        const both = range(5, 9).flatMap(t => range(5, 9).map(o => t * 10 + o));
        const heavy = shuffle(rng, both).slice(0, 4);
        const rest = range(11, 99).filter(v => v % 10 && !heavy.includes(v));
        return shuffle(rng, [...heavy, ...shuffle(rng, rest).slice(0, 6)]).map(v => setItem(v, 2));
      },
    },
    {
      id: '2.3', module: 2, icon: '🔍', title: 'Read two rods', rods: 2, count: 10, mastery: 8,
      intro: 'Which number do the beads show? Look at both rods.',
      gen: rng => shuffle(rng, range(11, 99).filter(v => v % 10))
        .slice(0, 10).map(v => readItem(v, 2, numberChoices(rng, v))),
    },
    {
      id: '2.4', module: 2, icon: '🪜', title: 'Count up and down', rods: 2, count: 10, mastery: 8,
      intro: 'Count with the beads! Move to the next number.',
      gen: rng => {
        const mk = (n, delta) => ({
          kind: 'set', rods: 2, show: n, badge: delta > 0 ? '+1' : '−1',
          start: digitsOf(n, 2), target: digitsOf(n + delta, 2), answer: n + delta,
          say: `The abacus shows ${n}. Show the number that comes right ${delta > 0 ? 'after' : 'before'}.`,
        });
        const pick = (pool, k) => shuffle(rng, pool).slice(0, k);
        const afterPlain = range(11, 88).filter(n => n % 10 >= 1 && n % 10 <= 8);
        const beforePlain = range(11, 99).filter(n => n % 10 >= 1);
        return shuffle(rng, [
          ...pick(range(19, 89, 10), 2).map(n => mk(n, +1)), // crosses a ten: 39 to 40
          ...pick(afterPlain, 3).map(n => mk(n, +1)),
          ...pick(range(20, 90, 10), 2).map(n => mk(n, -1)), // crosses a ten: 40 to 39
          ...pick(beforePlain, 3).map(n => mk(n, -1)),
        ]);
      },
    },
  ];

  const ORDER = LESSONS.map(l => l.id);
  const byId = Object.fromEntries(LESSONS.map(l => [l.id, l]));
  return { MODULES, LESSONS, ORDER, byId, mulberry32, shuffle, balanced };
});
