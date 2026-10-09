// Voice choice and spoken phrases. No DOM, so it is fully testable.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Talk = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- voices ----------
  // Browsers expose whatever voices the device has. Enhanced and Premium downloads sound far
  // more natural than the compact defaults, and some macOS voices are novelty sounds.
  const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|junior|kathy|organ|ralph|superstar|trinoids|whisper|zarvox|fred\b/i;
  const FRIENDLY = ['Ava', 'Samantha', 'Allison', 'Serena', 'Nicky', 'Karen', 'Moira', 'Tessa', 'Susan', 'Zoe', 'Daniel', 'Evan'];

  function score(v) {
    if (!/^en([-_]|$)/i.test(v.lang || '')) return -1;
    if (NOVELTY.test(v.name)) return -1;
    let s = 0;
    if (/premium/i.test(v.name)) s += 70;
    else if (/enhanced|neural|natural|siri/i.test(v.name)) s += 50;
    if (/en[-_]US/i.test(v.lang)) s += 10;
    else if (/en[-_](GB|AU|CA|IE|ZA)/i.test(v.lang)) s += 6;
    const i = FRIENDLY.findIndex(n => v.name.startsWith(n));
    if (i >= 0) s += 12 - i;
    if (v.localService) s += 3;
    return s;
  }
  const rank = voices =>
    (voices || []).map(v => ({ v, s: score(v) })).filter(x => x.s >= 0)
      .sort((a, b) => b.s - a.s || a.v.name.localeCompare(b.v.name)).map(x => x.v);
  // A saved choice wins if that voice is still installed; otherwise the best-ranked English voice.
  function pick(voices, savedName) {
    const saved = savedName && (voices || []).find(v => v.name === savedName);
    return saved || rank(voices)[0] || null;
  }

  // ---------- phrases ----------
  const FIRST = [
    'Yes!', 'You did it!', 'Great job!', 'Wonderful!', 'Super!', 'Nice work!', 'Well done!',
    'That is right!', 'Perfect!', 'Awesome!', 'Hooray!', 'Look at you go!', 'Fantastic!',
    'Brilliant!', 'High five!', 'Just right!', 'You are so good at this!', 'Exactly!',
  ];
  const WITH_NUMBER = ['Yes, {n}!', 'That is {n}!', '{n}! You got it!', 'Perfect, {n}!', 'Great job, {n}!'];
  const RETRY = [
    'There it is!', 'You got it!', 'Yes! You kept going.', 'Good thinking!', 'See? You can do it.',
    'That is it! Nice try.', 'You figured it out!',
  ];
  const STREAK = ['You are on a roll!', 'Wow, so many right!', 'You are on fire!', 'Keep it up!'];
  const OOPS = [
    'Almost! Try again.', 'So close! Try once more.', 'Not quite. You can do it.',
    'Give it another go.', 'Nearly there. Try again.', 'Oops! Let us try again.',
  ];
  const HELP = [
    'Let me help. Follow the dotted circles.', 'Here is a little help. Look at the dotted circles.',
    'Try matching the dotted circles.',
  ];
  const DONE_PASS = ['Amazing! You did it!', 'Hooray! What a great job!', 'Wow, you are a soroban star!', 'Fantastic work today!'];
  const DONE_TRY = ['Good practice! Let us try again.', 'Nice try! Practice makes it easier.', 'You worked hard! Let us play again.'];

  // Returns phrases that never repeat any of the last few used from the same pool.
  function createPhrases(rng) {
    const recent = {};
    function draw(name, pool) {
      const seen = recent[name] || (recent[name] = []);
      const keep = Math.min(4, pool.length - 1);
      const fresh = pool.filter(p => !seen.includes(p));
      const out = fresh[Math.floor(rng() * fresh.length)];
      seen.push(out);
      while (seen.length > keep) seen.shift();
      return out;
    }
    return {
      // ctx: { first: answered on the first try, streak: first-try answers in a row, n: the number, if any }
      praise(ctx = {}) {
        if (!ctx.first) return draw('retry', RETRY);
        if (ctx.streak >= 3 && ctx.streak % 3 === 0) return draw('streak', STREAK);
        if (ctx.n !== undefined && ctx.n !== null && rng() < 0.35) return draw('num', WITH_NUMBER).replace('{n}', ctx.n);
        return draw('first', FIRST);
      },
      oops: () => draw('oops', OOPS),
      help: () => draw('help', HELP),
      done: passed => (passed ? draw('pass', DONE_PASS) : draw('try', DONE_TRY)),
    };
  }

  return { rank, pick, createPhrases, pools: { FIRST, WITH_NUMBER, RETRY, STREAK, OOPS, HELP, DONE_PASS, DONE_TRY } };
});
