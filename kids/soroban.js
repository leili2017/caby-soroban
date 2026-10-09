// Soroban engine: pure bead logic (shared with tests) plus an SVG renderer.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Soroban = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- pure logic: one rod holds a digit 0-9 ----------
  const beadsFor = d => ({ heaven: d >= 5, earth: d % 5 });
  const digitFrom = ({ heaven, earth }) => (heaven ? 5 : 0) + earth;
  // Earth bead 0 is the one nearest the bar.
  const isActive = (d, kind, i) => (kind === 'heaven' ? d >= 5 : i < d % 5);
  // Push a bead toward (true) or away from (false) the bar. Earth beads move as a stack.
  function move(d, kind, i, toward) {
    const { heaven, earth } = beadsFor(d);
    if (kind === 'heaven') return digitFrom({ heaven: toward, earth });
    return digitFrom({ heaven, earth: toward ? Math.max(earth, i + 1) : Math.min(earth, i) });
  }
  const tap = (d, kind, i) => move(d, kind, i, !isActive(d, kind, i));
  const toValue = digits => digits.reduce((a, d) => a * 10 + d, 0);
  const toDigits = (n, rods) => String(n).padStart(rods, '0').slice(-rods).split('').map(Number);

  // ---------- geometry (SVG units) ----------
  const G = { rodW: 120, pad: 14, labelH: 34, bar: 140, barH: 12, bw: 88, bh: 54, pitch: 58 };
  G.deckEnd = G.bar + G.barH + 5 * G.pitch;
  G.H = G.deckEnd + 10;
  const heavenY = on => (on ? G.bar - G.bh - 3 : G.bar - G.bh - G.pitch);
  const earthY = (i, on) => (on ? G.bar + G.barH + 3 + i * G.pitch : G.deckEnd - G.bh - (3 - i) * G.pitch);
  // The two resting heights of a bead: against the bar (on) and away from it (off).
  const bounds = (kind, i) => (kind === 'heaven'
    ? { on: heavenY(true), off: heavenY(false) }
    : { on: earthY(i, true), off: earthY(i, false) });

  // A bead dragged to height y (top edge). It cannot leave its track, and it settles
  // on whichever end is nearer. `digit` is the rod's value if it were released there.
  function drag(d0, kind, i, y) {
    const { on, off } = bounds(kind, i);
    const cy = Math.min(Math.max(y, Math.min(on, off)), Math.max(on, off));
    const toward = Math.abs(cy - on) < Math.abs(cy - off);
    return { y: cy, toward, digit: move(d0, kind, i, toward) };
  }

  // ---------- SVG renderer ----------
  const NS = 'http://www.w3.org/2000/svg';
  const TAP_PX = 8; // movement under this many screen pixels counts as a tap

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // opts: { rods, labels, onChange(digits) }. onChange fires when a finger lifts and the
  // rods hold a different value than before it touched down.
  function create(host, opts = {}) {
    const rods = opts.rods || 1;
    const digits = Array(rods).fill(0);
    let locked = false;
    const W = rods * G.rodW + 2 * G.pad;

    const svg = el('svg', { viewBox: `0 0 ${W} ${G.labelH + G.H + 2 * G.pad}`, class: 'soroban' });
    el('rect', { x: 0, y: G.labelH, width: W, height: G.H + 2 * G.pad, rx: 22, class: 'frame' }, svg);
    const board = el('g', { transform: `translate(${G.pad},${G.labelH + G.pad})` }, svg);

    const centerX = r => r * G.rodW + G.rodW / 2;
    for (let r = 0; r < rods; r++) {
      el('line', { x1: centerX(r), x2: centerX(r), y1: 0, y2: G.H, class: 'rod' }, board);
      if (opts.labels) {
        const t = el('text', { x: G.pad + centerX(r), y: G.labelH - 10, class: 'rod-label', 'text-anchor': 'middle' }, svg);
        t.textContent = opts.labels[r];
      }
    }
    el('rect', { x: 0, y: G.bar, width: rods * G.rodW, height: G.barH, class: 'bar' }, board);

    const bead = kind => {
      const g = el('g', { class: `bead part-${kind}` }, board);
      el('ellipse', { rx: G.bw / 2, ry: G.bh / 2, class: 'shape' }, g);
      el('ellipse', { cx: -14, cy: -11, rx: 18, ry: 7, class: 'shine' }, g);
      return g;
    };
    const refs = [];
    for (let r = 0; r < rods; r++) {
      refs.push({ heaven: bead('heaven'), earth: [0, 1, 2, 3].map(() => bead('earth')) });
    }

    const place = (g, cx, y, on) => {
      g.style.transform = `translate(${cx}px,${y + G.bh / 2}px)`;
      g.classList.toggle('on', on);
    };
    // `skip` is the bead under a finger; it is positioned by the drag, not by its digit.
    const layout = skip => digits.forEach((d, r) => {
      const cx = centerX(r);
      if (refs[r].heaven !== skip) place(refs[r].heaven, cx, heavenY(d >= 5), d >= 5);
      refs[r].earth.forEach((g, i) => { if (g !== skip) place(g, cx, earthY(i, i < d % 5), i < d % 5); });
    });
    const scale = () => {
      const b = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
      return Math.min(b.width / vb.width, b.height / vb.height) || 1;
    };

    // The bead follows the finger along its track and pushes the beads it touches, like a
    // real soroban. Lifting settles it at the nearer end. A short touch toggles it.
    function bindBead(g, r, kind, i) {
      let d = null;
      g.addEventListener('pointerdown', e => {
        if (locked || d) return;
        e.preventDefault();
        const d0 = digits[r];
        const b = bounds(kind, i);
        d = { id: e.pointerId, y0: e.clientY, d0, base: isActive(d0, kind, i) ? b.on : b.off, moved: false };
        g.setPointerCapture(e.pointerId);
        g.classList.add('drag');
      });
      g.addEventListener('pointermove', e => {
        if (!d || e.pointerId !== d.id) return;
        const dy = e.clientY - d.y0;
        if (Math.abs(dy) > TAP_PX) d.moved = true;
        if (!d.moved) return;
        const s = drag(d.d0, kind, i, d.base + dy / scale());
        if (s.digit !== digits[r]) { digits[r] = s.digit; layout(g); }
        place(g, centerX(r), s.y, s.toward);
      });
      const end = (e, cancelled) => {
        if (!d || e.pointerId !== d.id) return;
        const { d0, moved } = d;
        d = null;
        g.classList.remove('drag');
        if (cancelled) digits[r] = d0;
        else if (!moved) digits[r] = tap(d0, kind, i);
        layout();
        if (!cancelled && digits[r] !== d0 && opts.onChange) opts.onChange(digits.slice());
      };
      g.addEventListener('pointerup', e => end(e, false));
      g.addEventListener('pointercancel', e => end(e, true));
    }
    refs.forEach((ref, r) => {
      bindBead(ref.heaven, r, 'heaven', 0);
      ref.earth.forEach((g, i) => bindBead(g, r, 'earth', i));
    });

    host.replaceChildren(svg);
    layout();

    return {
      el: svg,
      get digits() { return digits.slice(); },
      get value() { return toValue(digits); },
      // Programmatic changes never fire onChange.
      set(ds) { digits.splice(0, rods, ...ds); layout(); },
      setValue(n) { this.set(toDigits(n, rods)); },
      lock(v) { locked = v; },
      // Outline where the beads should be for `target` digits, or clear with null.
      ghost(target) {
        board.querySelectorAll('.ghost').forEach(n => n.remove());
        if (!target) return;
        target.forEach((d, r) => {
          const spots = [];
          if (d >= 5) spots.push(heavenY(true));
          for (let i = 0; i < d % 5; i++) spots.push(earthY(i, true));
          spots.forEach(y => el('ellipse', { class: 'ghost', cx: centerX(r), cy: y + G.bh / 2, rx: G.bw / 2, ry: G.bh / 2 }, board));
        });
      },
    };
  }

  return { beadsFor, digitFrom, isActive, move, tap, toValue, toDigits, bounds, drag, create };
});
