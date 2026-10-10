// Session runner (one pass through a lesson) and saved progress. No DOM, so it is fully testable.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Runner = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- session ----------
  // Score counts first-try answers only. A missed item comes back once at the end as practice.
  function start(lesson, rng) {
    const queue = lesson.gen(rng);
    return { lesson, queue, pos: 0, attempts: 0, firstTry: 0, total: queue.length };
  }
  const current = s => s.queue[s.pos] || null;

  // Returns { outcome: 'correct' | 'retry' | 'hint', done }.
  function submit(s, ok) {
    const item = s.queue[s.pos];
    if (ok) {
      if (s.attempts === 0 && !item.retry) s.firstTry++;
      s.pos++;
      s.attempts = 0;
      return { outcome: 'correct', done: s.pos >= s.queue.length };
    }
    s.attempts++;
    if (!item.retry && !item.requeued) {
      item.requeued = true;
      s.queue.push({ ...item, retry: true });
    }
    return { outcome: s.attempts >= 2 ? 'hint' : 'retry', done: false };
  }

  function result(s) {
    const score = s.firstTry, of = s.total;
    const passed = score >= s.lesson.mastery;
    return { score, of, passed, stars: score === of ? 3 : passed ? 2 : 1 };
  }

  // ---------- progress ----------
  const KEY = 'capy.progress.v1';
  // How long a picture stays on screen in the memory lessons. A parent can lengthen or shorten it.
  const PEEKS = [{ scale: 1, label: 'Normal' }, { scale: 1.7, label: 'Long' }, { scale: 0.7, label: 'Short' }];
  // coins: { copper: 12, ... } one count per coin type. Anything that is not a positive whole number is dropped.
  function cleanCoins(c) {
    const out = {};
    if (c && typeof c === 'object' && !Array.isArray(c)) for (const k of Object.keys(c)) if (Number.isInteger(c[k]) && c[k] > 0) out[k] = c[k];
    return out;
  }
  const fresh = () => ({ lessons: {}, unlockAll: false, openModules: [], sound: true, voice: '', peekScale: 1, coins: {} });

  function load(storage) {
    try {
      const p = JSON.parse(storage.getItem(KEY));
      return p && typeof p === 'object'
        ? { ...fresh(), ...p, lessons: { ...(p.lessons || {}) }, openModules: Array.isArray(p.openModules) ? p.openModules.filter(Number.isInteger) : [],
            peekScale: PEEKS.some(x => x.scale === p.peekScale) ? p.peekScale : 1, coins: cleanCoins(p.coins) }
        : fresh();
    } catch (e) {
      return fresh();
    }
  }
  function save(storage, p) {
    try { storage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* storage unavailable: keep playing */ }
  }
  function record(p, id, res, now) {
    const c = p.lessons[id] || { plays: 0, best: 0, stars: 0, passed: false };
    p.lessons[id] = {
      plays: c.plays + 1,
      best: Math.max(c.best, res.score),
      stars: Math.max(c.stars, res.stars),
      passed: c.passed || res.passed,
      last: now,
    };
    return p;
  }
  // Erase scores, unlocks and coins but keep the settings a parent chose (sound, voice, memory time).
  function wipe(p) {
    p.lessons = {};
    p.unlockAll = false;
    p.openModules = [];
    p.coins = {};
    return p;
  }
  // A lesson opens once the one before it is passed.
  // A parent can also open a whole module (`module` is the lesson's module number).
  function unlocked(p, order, id, module) {
    const i = order.indexOf(id);
    return p.unlockAll || (module !== undefined && p.openModules.includes(module)) || i <= 0 ||
      Boolean(p.lessons[order[i - 1]] && p.lessons[order[i - 1]].passed);
  }
  const peekLabel = p => (PEEKS.find(x => x.scale === p.peekScale) || PEEKS[0]).label;
  function cyclePeek(p) {
    const at = PEEKS.findIndex(x => x.scale === p.peekScale);
    p.peekScale = PEEKS[(at + 1) % PEEKS.length].scale;
    return p.peekScale;
  }
  // Open or close a module for the child. Returns true when it is now open.
  function toggleModule(p, module) {
    const at = p.openModules.indexOf(module);
    if (at >= 0) p.openModules.splice(at, 1); else p.openModules.push(module);
    return at < 0;
  }

  return { start, current, submit, result, load, save, record, wipe, unlocked, toggleModule, peekLabel, cyclePeek, PEEKS, KEY };
});
