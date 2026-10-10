// Lesson data for Modules 1 and 2. Each lesson declares how to generate its items.
//
// Item shapes (all spoken via `say`; the child never has to read):
//   set  : { kind, rods, show, badge?, hint?, start[], target[], answer, say }  child moves the beads to `target`
//   read : { kind, rods, target[], answer, choices[3], say }                    child picks the number shown
//   flash  : { kind, rods, target[], answer, choices[3], showMs, say, ask }          beads show, then hide; he picks the number
//   recall : { kind, rods, start[], target[], answer, showMs, say, ask }             beads show, then clear; he builds the number
//   mind   : { kind, rods, show, badge, start[], target[], answer, choices[3], showMs, say, ask }
//                                                                                    beads show, then hide; he adds or takes away in his head.
//                                                                                    `show` is the number to remember and is never displayed.
//   Add/take-away items are `set` items too: `start` is the number already on the beads, `badge` shows
//   the move (+3, -2), and the child moves the beads to `target`.
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
    say: `Show ${v} on your abacus. Then show it here.`,
    ...extra,
  });
  const readItem = (v, rods, choices) => ({
    kind: 'read', rods, target: digitsOf(v, rods), answer: v, choices, say: 'What number do you see?',
  });


  // "Start on `a`, then add or take away `d`." The beads begin at `a`.
  const moveItem = (a, d, rods, extra = {}) => {
    const b = a + d;
    const item = {
      kind: 'set', rods, show: a, badge: (d > 0 ? '+' : '\u2212') + Math.abs(d),
      start: digitsOf(a, rods), target: digitsOf(b, rods), answer: b,
      say: `The abacus shows ${a}. ${d > 0 ? 'Add' : 'Take away'} ${Math.abs(d)}. What is ${a} ${d > 0 ? 'plus' : 'minus'} ${Math.abs(d)}?`,
      ...extra,
    };
    if (item.how && item.hint) item.say += ' ' + item.how;   // the method is spoken only where the dotted hint shows
    return item;
  };
  // Every (a, d) pair whose result stays on one rod and passes `ok`.
  const pairs = (aLo, aHi, dSign, ok) => {
    const out = [];
    for (let a = aLo; a <= aHi; a++) for (let m = 1; m <= 9; m++) {
      const d = dSign * m, b = a + d;
      if (b >= 0 && b <= 9 && ok(a, d, b)) out.push([a, d]);
    }
    return out;
  };
  // Pick n pairs, spreading across different starting numbers and amounts.
  function spread(rng, pool, n) {
    const out = [], used = new Set();
    for (const [a, d] of shuffle(rng, pool)) {
      if (out.length >= n) break;
      const k = a + ':' + d;
      if (!used.has(k)) { used.add(k); out.push([a, d]); }
    }
    return out;
  }

  // A move the beads allow directly: no complement, no carry, no borrow.
  const isDirect = (a, d, b) => (d > 0
    ? (b <= 4 || (a >= 5 && d <= 4) || (d === 5 && a <= 4))
    : (a <= 4 || (b >= 5 && d >= -4) || d === -5));
  const how5 = d => { const k = 5 - Math.abs(d); return d > 0 ? `Try it: add 5, then take away ${k}.` : `Try it: take away 5, then put back ${k}.`; };
  const how10 = d => { const k = 10 - Math.abs(d); return d > 0 ? `Try it: add 10, then take away ${k}.` : `Try it: take away 10, then put back ${k}.`; };
  // Friends of five: the move crosses 5, so the top bead and the bottom beads move in opposite directions.
  const ADD5 = pairs(1, 4, +1, (a, d, b) => d <= 4 && b >= 5);
  const SUB5 = pairs(5, 8, -1, (a, d, b) => -d <= 4 && b <= 4);
  // Friends of ten: carry or borrow exactly one ten. The tens rod always moves one step directly.
  // onesDirect keeps the ones rod gentle too, for the first lessons.
  function tenPool(sign, onesDirect) {
    const out = [];
    for (let n = sign > 0 ? 1 : 10; n <= (sign > 0 ? 89 : 99); n++) {
      const t = Math.floor(n / 10), a = n % 10;
      for (let m = 1; m <= 9; m++) {
        const b = n + sign * m;
        if (b < 0 || b > 99) continue;
        const bt = Math.floor(b / 10), ba = b % 10;
        if (bt !== t + sign) continue;
        if (!isDirect(t, sign, bt)) continue;
        if (onesDirect && !isDirect(a, ba - a, ba)) continue;
        out.push([n, sign * m]);
      }
    }
    return out;
  }

  // ---- module 6: bigger numbers ----
  const onesOf = n => n % 10, tensOf = n => Math.floor(n / 10);
  const tag = (list, five) => list.map(([x, d]) => ({ x, d, five }));
  // The method for a friend-of-five move, said for one named rod. `d` is the change on that rod.
  const howRod = (rod, d) => {
    const k = 5 - Math.abs(d);
    return d > 0 ? `Try it on the ${rod} rod: add 5, then take away ${k}.` : `Try it on the ${rod} rod: take away 5, then put back ${k}.`;
  };
  // The ones rod runs past 9 (carry) or below 0 (borrow). Only meaningful when the amount's ones digit is not 0.
  const wraps = (n, b, sign) => (sign > 0 ? onesOf(b) < onesOf(n) : onesOf(b) > onesOf(n));
  // Every (n, +/-amount): start 1..99, a two-digit amount whose ones digit is not 0, result kept in 1..99
  // (never an empty board, which would read as a trivial x minus x).
  function twoRod(sign, ok) {
    const out = [];
    for (let n = 1; n <= 99; n++) for (let m = 11; m <= 99; m++) {
      const b = n + sign * m;
      if (m % 10 !== 0 && b >= 1 && b <= 99 && ok(n, b)) out.push([n, sign * m]);
    }
    return out;
  }

  // ---- module 7: picture the beads ----
  const flashItem = (v, rods, choices, showMs) => ({
    kind: 'flash', rods, target: digitsOf(v, rods), answer: v, choices, showMs,
    say: 'Tap the eyes. Look at the beads and remember the number.',
    ask: 'What number was it?',
  });
  const recallItem = (v, rods, showMs) => ({
    kind: 'recall', rods, start: Array(rods).fill(0), target: digitsOf(v, rods), answer: v, showMs,
    say: 'Tap the eyes. Look at the beads, then build the same number.',
    ask: 'Now build the number you saw.',
  });
  // "Remember `a`, then add or take away `d` in your head." The wrong choices are the mistakes a child
  // actually makes: going the wrong way, being off by one, or forgetting to move at all.
  function mindItem(rng, a, d, rods = 1, showMs = 3000) {
    const b = a + d, max = rods === 2 ? 99 : 9, wrong = [];
    const add = x => { if (x >= 0 && x <= max && x !== b && !wrong.includes(x)) wrong.push(x); };
    add(a - d); add(b + (rng() < 0.5 ? 1 : -1)); add(a); add(b + 1); add(b - 1);
    return {
      kind: 'mind', rods, show: a, badge: (d > 0 ? '+' : '\u2212') + Math.abs(d),
      start: digitsOf(a, rods), target: digitsOf(b, rods), answer: b,
      choices: shuffle(rng, [b, ...wrong.slice(0, 2)]), showMs,
      say: 'Tap the eyes. Remember the number on the beads.',
      ask: `Now ${d > 0 ? 'add' : 'take away'} ${Math.abs(d)} in your head. What is the answer?`,
    };
  }
  const takeAway1 = (a, d, b) => b >= 1 && isDirect(a, d, b);   // a mental answer is never an empty board

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
    { id: 3, title: 'Adding and taking away' },
    { id: 4, title: 'Friends of five' },
    { id: 5, title: 'Friends of ten' },
    { id: 6, title: 'Bigger numbers' },
    { id: 7, title: 'Picture the beads' },
  ];

  const LESSONS = [
    {
      id: '1.1', module: 1, icon: '👆', title: 'Push to the bar', rods: 1, count: 10, mastery: 9,
      intro: 'Hi! I am Capy. This is a soroban. Beads count when they touch the bar in the middle.',
      gen: rng => balanced(rng, [1, 5], 10).map((v, i) => setItem(v, 1, {
        hint: i < 3,
        say: v === 1 ? 'Push one bottom bead up to the bar.' : 'Push the top bead down to the bar.',
      })),
    },
    {
      id: '1.2', module: 1, icon: '🌱', title: 'Bottom beads, 0 to 4', rods: 1, count: 10, mastery: 9,
      intro: 'Push beads up to the bar to count them. Let us try the bottom beads.',
      // Zero means clearing: start with beads at the bar and push them all away.
      gen: rng => balanced(rng, range(0, 4), 10).map(v => setItem(v, 1, v === 0
        ? { start: [int(rng, 1, 4)], say: 'Clear the beads. Push every bead away from the bar.' }
        : {})),
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

    // ---------- Module 3: add and take away, no complements ----------
    // Each move stays inside what the beads allow directly: bottom beads for 1-4, the top bead for 5.
    {
      id: '3.1', module: 3, icon: '➕', title: 'Add with bottom beads', rods: 1, count: 10, mastery: 8,
      intro: 'Now we add! Start with the number on the beads, then push more beads up.',
      gen: rng => spread(rng, pairs(0, 3, +1, (a, d, b) => b <= 4), 10).map(([a, d], i) => moveItem(a, d, 1, { hint: i < 3 })),
    },
    {
      id: '3.2', module: 3, icon: '➖', title: 'Take away bottom beads', rods: 1, count: 10, mastery: 8,
      intro: 'Now we take away! Push beads back down, away from the bar.',
      gen: rng => spread(rng, pairs(1, 4, -1, (a, d, b) => a <= 4), 10).map(([a, d], i) => moveItem(a, d, 1, { hint: i < 3 })),
    },
    {
      id: '3.3', module: 3, icon: '🖐️', title: 'Add with the top bead', rods: 1, count: 10, mastery: 8,
      intro: 'The top bead helps us add! Five plus some more.',
      // Adding 5 uses the top bead; adding 1-4 on top of a 5 uses the bottom beads.
      gen: rng => spread(rng, [
        ...pairs(0, 4, +1, (a, d, b) => d === 5 && b <= 9),
        ...pairs(5, 8, +1, (a, d, b) => d <= 4 && b <= 9),
      ], 10).map(([a, d], i) => moveItem(a, d, 1, { hint: i < 3 })),
    },
    {
      id: '3.4', module: 3, icon: '🎈', title: 'Take away with the top bead', rods: 1, count: 10, mastery: 8,
      intro: 'The top bead helps us take away too! Lift it away from the bar.',
      gen: rng => spread(rng, [
        ...pairs(5, 9, -1, (a, d, b) => d === -5),
        ...pairs(6, 9, -1, (a, d, b) => d >= -4 && b >= 5),
      ], 10).map(([a, d], i) => moveItem(a, d, 1, { hint: i < 3 })),
    },
    {
      id: '3.5', module: 3, icon: '🎯', title: 'Add and take away mix', rods: 1, count: 12, mastery: 10,
      intro: 'Plus and minus together! Watch the sign, then move the beads.',
      gen: rng => {
        // Only moves a child can do directly, with both signs in equal measure.
        const up = spread(rng, pairs(0, 9, +1, isDirect), 6);
        const down = spread(rng, pairs(1, 9, -1, isDirect), 6);
        return shuffle(rng, [...up, ...down]).map(([a, d]) => moveItem(a, d, 1));
      },
    },

    // ---------- Module 4: friends of five ----------
    // Not enough bottom beads? The top bead and a bottom bead move in opposite directions.
    {
      id: '4.1', module: 4, icon: '🤝', title: 'Friends of five: adding', rods: 1, count: 10, mastery: 8,
      intro: 'Friends of five! When there are not enough bottom beads, the top bead helps.',
      gen: rng => spread(rng, ADD5, 10).map(([a, d], i) => moveItem(a, d, 1, { hint: i < 3, how: how5(d) })),
    },
    {
      id: '4.2', module: 4, icon: '🪁', title: 'Friends of five: taking away', rods: 1, count: 10, mastery: 8,
      intro: 'Taking away needs the friends of five too. Lift the top bead, then put some bottom beads back.',
      gen: rng => spread(rng, SUB5, 10).map(([a, d], i) => moveItem(a, d, 1, { hint: i < 3, how: how5(d) })),
    },
    {
      id: '4.3', module: 4, icon: '🎲', title: 'Friends of five mix', rods: 1, count: 12, mastery: 10,
      intro: 'A mix of everything you know so far!',
      gen: rng => shuffle(rng, [
        ...spread(rng, ADD5, 4), ...spread(rng, SUB5, 4),
        ...spread(rng, pairs(0, 9, +1, isDirect), 2), ...spread(rng, pairs(1, 9, -1, isDirect), 2),
      ]).map(([a, d]) => moveItem(a, d, 1)),
    },

    // ---------- Module 5: friends of ten (two rods) ----------
    {
      id: '5.1', module: 5, icon: '🔟', title: 'Friends of ten: carrying', rods: 2, count: 10, mastery: 8,
      intro: 'Friends of ten! When the ones rod is full, we carry one bead to the tens rod.',
      gen: rng => spread(rng, tenPool(+1, true), 10).map(([n, d], i) => moveItem(n, d, 2, { hint: i < 3, how: how10(d) })),
    },
    {
      id: '5.2', module: 5, icon: '🏠', title: 'Friends of ten: borrowing', rods: 2, count: 10, mastery: 8,
      intro: 'Taking away needs the friends of ten too. We borrow one bead from the tens rod.',
      gen: rng => spread(rng, tenPool(-1, true), 10).map(([n, d], i) => moveItem(n, d, 2, { hint: i < 3, how: how10(d) })),
    },
    {
      id: '5.3', module: 5, icon: '🌈', title: 'Carrying and borrowing', rods: 2, count: 12, mastery: 10,
      intro: 'Carry and borrow together! Watch the sign.',
      gen: rng => shuffle(rng, [
        ...spread(rng, tenPool(+1, false), 6), ...spread(rng, tenPool(-1, false), 6),
      ]).map(([n, d]) => moveItem(n, d, 2)),
    },

    // ---------- Module 6: bigger numbers (two rods, every technique) ----------
    // Lessons 6.1 and 6.2 move one rod and leave the other alone; 6.3 to 6.5 bring them together.
    {
      id: '6.1', module: 6, icon: '🌼', title: 'Big numbers: ones rod', rods: 2, count: 10, mastery: 8,
      intro: 'Bigger numbers! Only the ones rod changes. The tens rod stays where it is.',
      gen: rng => shuffle(rng, [
        ...tag(spread(rng, ADD5, 3), true), ...tag(spread(rng, SUB5, 3), true),
        ...tag(spread(rng, pairs(0, 9, +1, isDirect), 2), false), ...tag(spread(rng, pairs(1, 9, -1, isDirect), 2), false),
      ]).map(({ x: a, d, five }, i) =>
        moveItem(int(rng, 1, 9) * 10 + a, d, 2, { hint: i < 3, how: five ? howRod('ones', d) : undefined })),
    },
    {
      id: '6.2', module: 6, icon: '🍀', title: 'Big numbers: tens rod', rods: 2, count: 10, mastery: 8,
      intro: 'Now only the tens rod changes. The ones rod stays where it is.',
      gen: rng => shuffle(rng, [
        ...tag(spread(rng, ADD5, 3), true), ...tag(spread(rng, SUB5, 3), true),
        ...tag(spread(rng, pairs(0, 9, +1, isDirect), 2), false), ...tag(spread(rng, pairs(1, 9, -1, isDirect), 2), false),
      ]).map(({ x: t, d, five }, i) =>
        moveItem(t * 10 + int(rng, 1, 9), d * 10, 2, { hint: i < 3, how: five ? howRod('tens', d) : undefined })),
    },
    {
      id: '6.3', module: 6, icon: '🌻', title: 'Both rods together', rods: 2, count: 10, mastery: 8,
      intro: 'Both rods change this time! Do the tens, then the ones.',
      gen: rng => shuffle(rng, [
        ...spread(rng, twoRod(+1, (n, b) => !wraps(n, b, +1)), 5),
        ...spread(rng, twoRod(-1, (n, b) => !wraps(n, b, -1)), 5),
      ]).map(([n, d], i) => moveItem(n, d, 2, { hint: i < 3 })),
    },
    {
      id: '6.4', module: 6, icon: '🥕', title: 'Big number mix', rods: 2, count: 12, mastery: 10,
      intro: 'A mix of everything! Look at the sign and the number, then move the beads.',
      gen: rng => {
        const four = () => [
          ...spread(rng, ADD5, 1), ...spread(rng, SUB5, 1),
          ...spread(rng, pairs(0, 9, +1, isDirect), 1), ...spread(rng, pairs(1, 9, -1, isDirect), 1),
        ];
        const onesRod = four().map(([a, d]) => [int(rng, 1, 9) * 10 + a, d]);
        const tensRod = four().map(([t, d]) => [t * 10 + int(rng, 1, 9), d * 10]);
        const carry = [...spread(rng, tenPool(+1, false), 1), ...spread(rng, tenPool(-1, false), 1)];
        const both = [...spread(rng, twoRod(+1, (n, b) => !wraps(n, b, +1)), 1), ...spread(rng, twoRod(-1, (n, b) => !wraps(n, b, -1)), 1)];
        return shuffle(rng, [...onesRod, ...tensRod, ...carry, ...both]).map(([n, d]) => moveItem(n, d, 2));
      },
    },
    {
      id: '6.5', module: 6, icon: '🏆', title: 'Big number challenge', rods: 2, count: 10, mastery: 8,
      intro: 'Big carrying and borrowing! Take your time.',
      gen: rng => shuffle(rng, [
        ...spread(rng, twoRod(+1, (n, b) => wraps(n, b, +1)), 5),
        ...spread(rng, twoRod(-1, (n, b) => wraps(n, b, -1)), 5),
      ]).map(([n, d], i) => moveItem(n, d, 2, { hint: i < 3 })),
    },

    // ---------- Module 7: picture the beads (the bridge to mental abacus) ----------
    // The beads show for a few seconds, then hide. First he remembers a number, then builds it,
    // then adds and takes away in his head. A parent can change how long the picture stays.
    {
      id: '7.1', module: 7, icon: '👀', title: 'Peek and pick', rods: 1, count: 10, mastery: 8,
      intro: 'Draco has a secret! The beads will hide, so remember the number.',
      gen: rng => balanced(rng, range(1, 9), 10).map(v => flashItem(v, 1, digitChoices(rng, v), 3000)),
    },
    {
      id: '7.2', module: 7, icon: '🧱', title: 'Peek and build', rods: 1, count: 10, mastery: 8,
      intro: 'Look at the beads. They will hide, and then you build the same number!',
      gen: rng => balanced(rng, range(1, 9), 10).map(v => recallItem(v, 1, 2500)),
    },
    {
      id: '7.3', module: 7, icon: '🏰', title: 'Peek and build two rods', rods: 2, count: 10, mastery: 8,
      intro: 'Two rods this time! Look at the tens and the ones, then build the number.',
      gen: rng => {
        const heavy = shuffle(rng, range(5, 9).flatMap(t => range(5, 9).map(o => t * 10 + o))).slice(0, 4);
        const rest = range(11, 99).filter(v => v % 10 && !heavy.includes(v));
        return shuffle(rng, [...heavy, ...shuffle(rng, rest).slice(0, 6)]).map(v => recallItem(v, 2, 4000));
      },
    },
    {
      id: '7.4', module: 7, icon: '🧠', title: 'Imagine plus and minus', rods: 1, count: 10, mastery: 8,
      intro: 'Now use your imagination! See the beads in your head, then add or take away.',
      gen: rng => shuffle(rng, [
        ...spread(rng, pairs(1, 8, +1, isDirect), 5),
        ...spread(rng, pairs(2, 9, -1, takeAway1), 5),
      ]).map(([a, d]) => mindItem(rng, a, d)),
    },
    {
      id: '7.5', module: 7, icon: '✨', title: 'Imagine friends of five', rods: 1, count: 10, mastery: 8,
      intro: 'Friends of five in your imagination! See the top bead and the bottom beads move.',
      gen: rng => shuffle(rng, [
        ...spread(rng, ADD5, 3), ...spread(rng, SUB5, 3),
        ...spread(rng, pairs(1, 8, +1, isDirect), 2), ...spread(rng, pairs(2, 9, -1, takeAway1), 2),
      ]).map(([a, d]) => mindItem(rng, a, d)),
    },
  ];

  const ORDER = LESSONS.map(l => l.id);
  const byId = Object.fromEntries(LESSONS.map(l => [l.id, l]));
  return { MODULES, LESSONS, ORDER, byId, mulberry32, shuffle, balanced };
});
