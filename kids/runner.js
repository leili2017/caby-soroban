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
  const fresh = () => ({ lessons: {}, unlockAll: false, sound: true });

  function load(storage) {
    try {
      const p = JSON.parse(storage.getItem(KEY));
      return p && typeof p === 'object' ? { ...fresh(), ...p, lessons: { ...(p.lessons || {}) } } : fresh();
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
  // A lesson opens once the one before it is passed.
  function unlocked(p, order, id) {
    const i = order.indexOf(id);
    return p.unlockAll || i <= 0 || Boolean(p.lessons[order[i - 1]] && p.lessons[order[i - 1]].passed);
  }

  return { start, current, submit, result, load, save, record, unlocked, KEY };
});
