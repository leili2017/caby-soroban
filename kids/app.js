// Capy Soroban: screens, speech, and the parent panel. Logic lives in soroban.js, lessons.js, runner.js.
(function () {
  'use strict';
  const { LESSONS, MODULES, ORDER, byId, mulberry32 } = Lessons;
  const app = document.getElementById('app');
  const parentEl = document.getElementById('parent');

  let store;
  try { store = window.localStorage; store.getItem('x'); } catch (e) { store = { getItem: () => null, setItem() {} }; }
  const progress = Runner.load(store);
  const persist = () => Runner.save(store, progress);

  // ---------- speech and sound ----------
  const phrases = Talk.createPhrases(Math.random);
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  const allVoices = () => (synth && synth.getVoices ? synth.getVoices() : []);
  const voice = () => Talk.pick(allVoices(), progress.voice);
  function say(text) {
    if (!progress.sound || !synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = voice();
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = 0.9; u.pitch = 1;   // natural pitch: raising it is what makes voices sound synthetic
    synth.speak(u);
  }
  let ac;
  function chime(good) {
    if (!progress.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      (good ? [523, 659, 784] : [330]).forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.11;
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.32);
      });
    } catch (e) { /* audio is optional */ }
  }
  let streak = 0;

  // ---------- capybara ----------
  const capy = (mood = '') => `
    <svg class="capy ${mood}" viewBox="0 0 200 160" role="img" aria-label="Capy the capybara">
      <ellipse cx="100" cy="128" rx="80" ry="30" fill="#a9743f"/>
      <ellipse cx="100" cy="82" rx="54" ry="46" fill="#b9814a"/>
      <ellipse cx="60" cy="46" rx="12" ry="14" fill="#a9743f"/><ellipse cx="140" cy="46" rx="12" ry="14" fill="#a9743f"/>
      <ellipse cx="60" cy="48" rx="6" ry="8" fill="#e8b98e"/><ellipse cx="140" cy="48" rx="6" ry="8" fill="#e8b98e"/>
      <ellipse cx="100" cy="100" rx="36" ry="25" fill="#cf9d68"/>
      <ellipse cx="100" cy="89" rx="12" ry="7.5" fill="#4a2e18"/>
      <circle cx="76" cy="70" r="7" fill="#2b1a0e"/><circle cx="124" cy="70" r="7" fill="#2b1a0e"/>
      <circle cx="78.5" cy="67.5" r="2.4" fill="#fff"/><circle cx="126.5" cy="67.5" r="2.4" fill="#fff"/>
      <ellipse class="blush" cx="64" cy="90" rx="9" ry="5.5" fill="#f08c7a" opacity=".7"/>
      <ellipse class="blush" cx="136" cy="90" rx="9" ry="5.5" fill="#f08c7a" opacity=".7"/>
      <path class="m-happy" d="M87 105 Q100 118 113 105" stroke="#4a2e18" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path class="m-oops" d="M90 110 Q100 104 110 110" stroke="#4a2e18" stroke-width="4" fill="none" stroke-linecap="round"/>
    </svg>`;
  const setMood = (mood) => { const c = app.querySelector('.coach .capy'); if (c) c.setAttribute('class', `capy ${mood}`); };

  // ---------- home ----------
  const stars = n => '⭐'.repeat(n) + '☆'.repeat(3 - n);
  function home() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    const nextId = ORDER.find(id => !(progress.lessons[id] && progress.lessons[id].passed));
    app.innerHTML = `
      <section class="home">
        <div class="hero">${capy('')}<div><h1>Capy Soroban</h1><p>Pick a game!</p></div></div>
        ${MODULES.map(m => `
          <div class="module"><h2><span class="num">${m.id}</span>${m.title}</h2>
          <div class="path">${LESSONS.filter(l => l.module === m.id).map(l => {
            const ok = Runner.unlocked(progress, ORDER, l.id);
            const st = (progress.lessons[l.id] || {}).stars || 0;
            return `<button class="card ${l.id === nextId ? 'next' : ''}" data-id="${l.id}" ${ok ? '' : 'disabled'} aria-label="${l.title}${ok ? '' : ', locked'}">
              <span class="icon">${ok ? l.icon : '🔒'}</span><span class="name">${l.title}</span><span class="stars">${ok ? stars(st) : ''}</span></button>`;
          }).join('')}</div></div>`).join('')}
      </section>
      <button class="gear" id="gear" aria-label="Parent area. Press and hold.">⚙️</button>`;
    app.querySelectorAll('.card').forEach(b => b.addEventListener('click', () => play(b.dataset.id)));
    holdToOpen(document.getElementById('gear'), () => openParent());
  }

  // ---------- lesson ----------
  let session = null, sb = null, locked = false, current = null;

  function play(id) {
    const lesson = byId[id];
    session = Runner.start(lesson, mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0));
    streak = 0;
    app.innerHTML = `
      <section class="lesson">
        <div class="top">
          <button class="round" id="back" aria-label="Back">‹</button>
          <div class="dots" id="dots"></div>
          <button class="round" id="again" aria-label="Say it again">🔊</button>
        </div>
        <div class="stage">
          <div class="coach">${capy('')}<div class="bubble" id="bubble"></div></div>
          <div class="work"><div class="board" id="board"></div><div class="actions" id="actions"></div></div>
        </div>
      </section>
      <button class="gear" id="gear" aria-label="Parent area. Press and hold.">⚙️</button>`;
    document.getElementById('back').addEventListener('click', home);
    document.getElementById('again').addEventListener('click', () => current && say(current.say));
    holdToOpen(document.getElementById('gear'), () => openParent());
    introPending = lesson.intro;
    item();
  }

  let itemTimer = null, idleTimer = null, introPending = '';
  function item() {
    clearTimeout(itemTimer);
    clearTimeout(idleTimer);
    const it = Runner.current(session);
    if (!it) return finish();
    current = it; locked = false;
    renderDots();
    setMood('');
    const lesson = session.lesson;
    const board = document.getElementById('board'), actions = document.getElementById('actions'), bubble = document.getElementById('bubble');
    if (!board) return;
    const labels = it.rods === 2 ? ['10', '1'] : null;
    bubble.className = 'bubble';
    bubble.innerHTML = '';
    actions.innerHTML = '';

    if (it.kind === 'set') {
      bubble.innerHTML = `${it.show}${it.badge ? `<span class="delta">${it.badge}</span>` : ''}`;
      // The board starts fresh for every problem, so nothing carries over from the last one.
      sb = Soroban.create(board, { rods: it.rods, labels, onChange: ds => onBeads(it, ds) });
      sb.set(it.start);
      if (it.hint) sb.ghost(it.target);
    } else {
      bubble.className = 'bubble sm'; bubble.textContent = '?';
      sb = Soroban.create(board, { rods: it.rods, labels });
      sb.set(it.target); sb.lock(true);
      actions.innerHTML = it.choices.map(c => `<button class="choice" data-v="${c}">${c}</button>`).join('');
      actions.querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => {
        if (locked) return;
        const ok = Number(b.dataset.v) === it.answer;
        if (ok) b.classList.add('right'); else b.classList.add('gone');
        answer(ok);
      }));
    }
    say(introPending ? `${introPending} ${it.say}` : it.say);
    introPending = '';
  }

  function renderDots() {
    const d = document.getElementById('dots');
    if (!d) return;
    d.innerHTML = session.queue.map((_, i) => `<i class="${i < session.pos ? 'done' : i === session.pos ? 'now' : ''}"></i>`).join('');
  }

  function hint(it) {
    if (it.kind === 'set') sb.ghost(it.target);
    else app.querySelectorAll('.choice').forEach(b => { if (Number(b.dataset.v) === it.answer) b.classList.add('pulse'); });
  }

  // Beads settle when a finger lifts. A match is right straight away. Anything else is
  // given a moment, so a move that is still in progress is never counted as a mistake.
  const SETTLE_MS = 2200;
  function onBeads(it, digits) {
    if (locked || it !== current) return;
    clearTimeout(idleTimer);
    if (digits.join('') === it.target.join('')) return answer(true);
    idleTimer = setTimeout(() => { if (!locked && it === current) answer(false); }, SETTLE_MS);
  }

  function answer(ok) {
    if (locked) return;
    clearTimeout(idleTimer);
    const it = current;
    const first = session.attempts === 0 && !it.retry;   // read before submit() resets it
    const r = Runner.submit(session, ok);
    if (r.outcome === 'correct') {
      locked = true; sb.lock(true);
      streak = first ? streak + 1 : 0;
      setMood('happy'); chime(true);
      say(phrases.praise({ first, streak, n: typeof it.answer === 'number' ? it.answer : undefined }));
      itemTimer = setTimeout(() => (r.done ? finish() : item()), 1500);
    } else {
      streak = 0;
      setMood('oops'); chime(false);
      say(r.outcome === 'hint' ? phrases.help() : phrases.oops());
      if (r.outcome === 'hint') hint(it);
      setTimeout(() => setMood(''), 900);
    }
  }

  function finish() {
    const res = Runner.result(session);
    Runner.record(progress, session.lesson.id, res, Date.now());
    persist();
    const next = ORDER[ORDER.indexOf(session.lesson.id) + 1];
    app.innerHTML = `
      <section class="result">
        ${capy(res.passed ? 'happy' : '')}
        <h1>${res.passed ? 'Amazing!' : 'Good practice!'}</h1>
        <div class="stars" aria-label="${res.stars} stars">${stars(res.stars)}</div>
        <div class="row">
          <button class="big alt" id="r-again" aria-label="Play again">↻</button>
          ${res.passed && next ? '<button class="big" id="r-next" aria-label="Next game">›</button>' : ''}
          <button class="big alt" id="r-home" aria-label="Home">⌂</button>
        </div>
      </section>`;
    chime(res.passed);
    say(phrases.done(res.passed));
    document.getElementById('r-again').addEventListener('click', () => play(session.lesson.id));
    document.getElementById('r-home').addEventListener('click', home);
    const n = document.getElementById('r-next');
    if (n) n.addEventListener('click', () => play(next));
  }

  // ---------- parent area ----------
  function holdToOpen(btn, fn) {
    let t = null;
    const stop = () => { clearTimeout(t); t = null; };
    btn.addEventListener('pointerdown', () => { stop(); t = setTimeout(fn, 1200); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
  }

  function openParent() {
    const inLesson = session && document.querySelector('.lesson');
    const rows = LESSONS.map(l => {
      const p = progress.lessons[l.id];
      return `<tr><td>${l.id} ${l.title}</td><td>${p ? p.plays : 0}</td><td>${p ? `${p.best}/${l.count}` : '-'}</td><td>${p && p.passed ? 'passed' : '-'}</td></tr>`;
    }).join('');
    parentEl.hidden = false;
    const ranked = Talk.rank(allVoices());
    const current_ = voice();
    const voiceRow = ranked.length
      ? `<div class="voice"><label for="p-voice">Voice</label>
          <select id="p-voice">${ranked.map(v => `<option value="${v.name.replace(/"/g, '&quot;')}" ${current_ && v.name === current_.name ? 'selected' : ''}>${v.name} (${v.lang})</option>`).join('')}</select>
          <button class="pbtn" id="p-hear">Hear it</button></div>
         <p class="tip">For a more natural voice, install an Enhanced or Premium one: Settings > Accessibility > Spoken Content > Voices.</p>`
      : '<p class="tip">No English voices were found on this device.</p>';
    parentEl.innerHTML = `
      <div class="panel" role="dialog" aria-label="Parent area">
        <h2>Parent area</h2>
        <p>Best score counts only first-try answers. A lesson opens once the one before it is passed.</p>
        <table><tr><th>Game</th><th>Plays</th><th>Best</th><th></th></tr>${rows}</table>
        ${voiceRow}
        <div class="row">
          ${inLesson && current ? '<button class="pbtn go" id="p-show">Show answer</button><button class="pbtn" id="p-skip">Skip this one</button>' : ''}
          <button class="pbtn" id="p-sound">Sound: ${progress.sound ? 'on' : 'off'}</button>
          <button class="pbtn" id="p-unlock">Unlock all: ${progress.unlockAll ? 'on' : 'off'}</button>
          <button class="pbtn danger" id="p-reset">Reset progress</button>
          <button class="pbtn go" id="p-close">Close</button>
        </div>
      </div>`;
    const $ = id => document.getElementById(id);
    const close = () => { parentEl.hidden = true; parentEl.innerHTML = ''; };
    $('p-close').addEventListener('click', close);
    if ($('p-voice')) {
      $('p-voice').addEventListener('change', e => { progress.voice = e.target.value; persist(); say(phrases.praise({ first: true })); });
      $('p-hear').addEventListener('click', () => say(phrases.praise({ first: true })));
    }
    $('p-sound').addEventListener('click', () => { progress.sound = !progress.sound; persist(); openParent(); });
    $('p-unlock').addEventListener('click', () => { progress.unlockAll = !progress.unlockAll; persist(); openParent(); });
    $('p-reset').addEventListener('click', () => {
      if (!confirm('Erase all saved progress?')) return;
      progress.lessons = {}; persist(); close(); home();
    });
    if ($('p-show')) $('p-show').addEventListener('click', () => {
      hint(current);   // outline only: the child still makes the move himself
      close();
    });
    if ($('p-skip')) $('p-skip').addEventListener('click', () => {
      // Counts as a miss so the score stays honest, then moves on.
      Runner.submit(session, false); Runner.submit(session, false);
      session.pos++; session.attempts = 0; close(); item();
    });
    parentEl.onclick = e => { if (e.target === parentEl) close(); };
  }

  home();
})();
