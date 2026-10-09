// Themes: one animal friend and color palette per module. No DOM, so it is fully testable.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Themes = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const INK = '#2b1a0e', MOUTH = '#4a2e18';
  const f = n => Math.round(n * 10) / 10;

  // ---------- drawing helpers (the face parts every animal shares) ----------
  const eyes = (ax, ay, bx, by, r) =>
    `<circle cx="${ax}" cy="${ay}" r="${r}" fill="${INK}"/><circle cx="${bx}" cy="${by}" r="${r}" fill="${INK}"/>` +
    `<circle cx="${f(ax + r * 0.35)}" cy="${f(ay - r * 0.4)}" r="${f(r * 0.33)}" fill="#fff"/>` +
    `<circle cx="${f(bx + r * 0.35)}" cy="${f(by - r * 0.4)}" r="${f(r * 0.33)}" fill="#fff"/>`;
  const blush = (ax, ay, bx, by, c = '#f08c7a', rx = 8, ry = 5) =>
    `<ellipse class="blush" cx="${ax}" cy="${ay}" rx="${rx}" ry="${ry}" fill="${c}" opacity=".7"/>` +
    `<ellipse class="blush" cx="${bx}" cy="${by}" rx="${rx}" ry="${ry}" fill="${c}" opacity=".7"/>`;
  const stroke = `stroke="${MOUTH}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const mouth = (happy, oops) => `<path class="m-happy" d="${happy}" ${stroke}/><path class="m-oops" d="${oops}" ${stroke}/>`;
  const oval = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
  // Top half of a zigzag dome (hedgehog spines), closed along a flat base.
  function spikes(cx, cy, rOut, rIn, teeth, base) {
    const n = teeth * 2, pts = [];
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (Math.PI * i) / n, r = i % 2 ? rIn : rOut;
      pts.push(`${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`);
    }
    pts.push(`${f(cx + rOut)},${base}`, `${f(cx - rOut)},${base}`);
    return pts.join(' ');
  }
  const tri = (pts, fill, w = 6) => `<polygon points="${pts}" fill="${fill}" stroke="${fill}" stroke-width="${w}" stroke-linejoin="round"/>`;

  // ---------- the animals ----------
  const capybara = () =>
    oval(100, 124, 80, 33, '#a9743f') + oval(52, 152, 15, 7, '#8f5f33') + oval(148, 152, 15, 7, '#8f5f33') +
    '<rect x="52" y="30" width="96" height="86" rx="34" fill="#b9814a"/>' +
    oval(57, 40, 8, 5.5, '#9a6836', 'transform="rotate(-25 57 40)"') + oval(143, 40, 8, 5.5, '#9a6836', 'transform="rotate(25 143 40)"') +
    oval(57, 41, 4, 2.6, '#d9a07a', 'transform="rotate(-25 57 41)"') + oval(143, 41, 4, 2.6, '#d9a07a', 'transform="rotate(25 143 41)"') +
    '<rect x="58" y="72" width="84" height="46" rx="23" fill="#cf9d68"/>' +
    '<rect x="82" y="68" width="36" height="22" rx="11" fill="#5b3a22"/>' +
    '<path d="M91 75 q-3 5 0 8 M109 75 q3 5 0 8" stroke="#241509" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<path d="M100 90 V96" stroke="#7a5233" stroke-width="3" stroke-linecap="round"/>' +
    [[74, 84], [68, 88], [126, 84], [132, 88]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#8a5d36"/>`).join('') +
    eyes(73, 56, 127, 56, 6) + blush(68, 92, 132, 92) +
    mouth('M90 99 Q100 108 110 99', 'M91 105 Q100 99 109 105');

  const hedgehog = () =>
    `<polygon points="${spikes(100, 96, 78, 64, 11, 103)}" fill="#6b4630" stroke="#6b4630" stroke-width="4" stroke-linejoin="round"/>` +
    `<polygon points="${spikes(100, 98, 62, 50, 9, 104)}" fill="#85583c" stroke="#85583c" stroke-width="3" stroke-linejoin="round"/>` +
    oval(72, 140, 17, 9, '#e6bf92') + oval(128, 140, 17, 9, '#e6bf92') + oval(100, 112, 62, 30, '#e9c699') +
    oval(56, 58, 11, 11, '#e9c699') + oval(144, 58, 11, 11, '#e9c699') + oval(56, 59, 6, 6, '#f2a8a0') + oval(144, 59, 6, 6, '#f2a8a0') +
    oval(100, 92, 46, 38, '#f4dcb8') + oval(100, 103, 21, 15, '#fbebd2') + oval(100, 95, 6.5, 5, INK) +
    eyes(78, 82, 122, 82, 6.5) + blush(64, 98, 136, 98) +
    mouth('M92 105 Q100 112 108 105', 'M93 110 Q100 104 107 110');

  const axolotl = () => {
    const gills = [[44, 58, 55], [34, 78, 8], [42, 98, -35]].map(([x, y, r]) =>
      oval(x, y, 20, 6, '#ee6c98', `transform="rotate(${r} ${x} ${y})"`) +
      oval(200 - x, y, 20, 6, '#ee6c98', `transform="rotate(${-r} ${200 - x} ${y})"`)).join('');
    return gills + oval(100, 130, 58, 28, '#ffb3cc') + oval(48, 140, 12, 7, '#ff9fbf') + oval(152, 140, 12, 7, '#ff9fbf') +
      oval(100, 86, 52, 40, '#ffc4d7') + eyes(74, 78, 126, 78, 5.5) +
      '<circle cx="95" cy="92" r="1.6" fill="#c9738f"/><circle cx="105" cy="92" r="1.6" fill="#c9738f"/>' +
      blush(60, 94, 140, 94, '#ff7ea6', 9, 5) +
      mouth('M70 99 Q100 118 130 99', 'M76 108 Q100 96 124 108');
  };

  const fennec = () =>
    tri('56,74 34,10 90,52', '#efc28a', 8) + tri('144,74 166,10 110,52', '#efc28a', 8) +
    tri('58,64 44,26 80,52', '#f3a9a0', 5) + tri('142,64 156,26 120,52', '#f3a9a0', 5) +
    oval(100, 136, 52, 24, '#f0c78f') + oval(74, 150, 14, 7, '#e5b87c') + oval(126, 150, 14, 7, '#e5b87c') +
    oval(100, 90, 50, 40, '#f2cc94') + oval(100, 104, 30, 22, '#fff0dc') + oval(100, 95, 6, 4.5, INK) +
    eyes(74, 82, 126, 82, 7) + blush(62, 100, 138, 100) +
    mouth('M92 106 Q100 113 108 106', 'M93 111 Q100 105 107 111');

  const hamster = () =>
    oval(58, 42, 15, 15, '#e29a4b') + oval(142, 42, 15, 15, '#e29a4b') + oval(58, 43, 8, 8, '#f4b3b0') + oval(142, 43, 8, 8, '#f4b3b0') +
    oval(100, 120, 60, 34, '#f2b36b') + oval(100, 130, 38, 22, '#fff3e0') + oval(74, 150, 15, 7, '#e9a45a') + oval(126, 150, 15, 7, '#e9a45a') +
    oval(100, 86, 64, 50, '#f4b872') + oval(100, 58, 30, 14, '#e59d52') +
    oval(68, 100, 26, 20, '#fff3e0') + oval(132, 100, 26, 20, '#fff3e0') +
    oval(100, 90, 5, 3.6, '#e98aa0') + '<path d="M100 93 V98" stroke="#b9704d" stroke-width="3" stroke-linecap="round"/>' +
    eyes(80, 78, 120, 78, 6.5) + blush(62, 96, 138, 96) +
    mouth('M92 99 Q100 107 108 99', 'M93 105 Q100 99 107 105');

  const rabbit = () =>
    oval(74, 40, 14, 34, '#e9d3b4', 'transform="rotate(-8 74 40)"') + oval(126, 40, 14, 34, '#e9d3b4', 'transform="rotate(8 126 40)"') +
    oval(74, 42, 7, 25, '#f4a9b8', 'transform="rotate(-8 74 42)"') + oval(126, 42, 7, 25, '#f4a9b8', 'transform="rotate(8 126 42)"') +
    oval(100, 138, 46, 24, '#e9d3b4') + oval(76, 152, 14, 7, '#dcc4a2') + oval(124, 152, 14, 7, '#dcc4a2') +
    oval(100, 94, 50, 42, '#ecd8ba') + oval(100, 106, 26, 19, '#fff8ee') + oval(100, 97, 6, 4.5, '#f08aa5') +
    eyes(77, 88, 123, 88, 6) + blush(64, 104, 136, 104) +
    mouth('M100 101 V106 Q94 112 89 107 M100 106 Q106 112 111 107', 'M93 111 Q100 105 107 111');

  // A friendly green dragon: horns, little wings, round snout.
  const dragon = () =>
    oval(36, 92, 24, 13, '#48b356', 'transform="rotate(35 36 92)"') + oval(164, 92, 24, 13, '#48b356', 'transform="rotate(-35 164 92)"') +
    tri('72,46 62,16 90,38', '#ffe08a', 5) + tri('128,46 138,16 110,38', '#ffe08a', 5) +
    oval(100, 132, 56, 28, '#62d26b') + oval(100, 138, 32, 18, '#fff0b8') + oval(72, 152, 15, 7, '#4fb85a') + oval(128, 152, 15, 7, '#4fb85a') +
    oval(100, 78, 50, 42, '#62d26b') + oval(100, 98, 34, 24, '#86e48a') +
    '<circle cx="90" cy="92" r="2.6" fill="#1f5a2c"/><circle cx="110" cy="92" r="2.6" fill="#1f5a2c"/>' +
    eyes(78, 66, 122, 66, 6.5) + blush(62, 92, 138, 92, '#ff8f8f') +
    mouth('M82 104 Q100 118 118 104', 'M86 112 Q100 102 114 112');

  // ---------- registry ----------
  const THEMES = {
    capybara: { name: 'Capy', animal: 'capybara', art: capybara,
      palette: { bg: '#fff4dc', brand: '#3aa17e', brandDark: '#2b7f61', edge: '#e6d2a8', dot: '#ead9b6' } },
    hedgehog: { name: 'Hedgie', animal: 'hedgehog', art: hedgehog,
      palette: { bg: '#efe6f7', brand: '#7b52b8', brandDark: '#5a3a92', edge: '#d5c6e8', dot: '#e0d3ef' } },
    axolotl: { name: 'Axo', animal: 'axolotl', art: axolotl,
      palette: { bg: '#dff4f7', brand: '#1b93a3', brandDark: '#136e7a', edge: '#b5dde2', dot: '#cdeaee' } },
    fennec: { name: 'Fenny', animal: 'fennec fox', art: fennec,
      palette: { bg: '#e1eefc', brand: '#3b7fc8', brandDark: '#285f9f', edge: '#bdd3ee', dot: '#d3e2f4' } },
    hamster: { name: 'Hammy', animal: 'hamster', art: hamster,
      palette: { bg: '#fff9d6', brand: '#b88200', brandDark: '#8f6700', edge: '#eadf9c', dot: '#f2e9b8' } },
    rabbit: { name: 'Bun', animal: 'rabbit', art: rabbit,
      palette: { bg: '#ffe7ef', brand: '#d9558b', brandDark: '#ad3d6c', edge: '#f0c3d3', dot: '#f5d6e1' } },
    dragon: { name: 'Draco', animal: 'green dragon', art: dragon,
      palette: { bg: '#e2f6df', brand: '#2e9e4f', brandDark: '#217a3b', edge: '#bfe0b9', dot: '#d2ebcd' } },
  };
  for (const id in THEMES) THEMES[id].id = id;
  // Module 1 gets the first friend, module 2 the next, and so on; it wraps after the last.
  const ORDER = ['capybara', 'hedgehog', 'axolotl', 'fennec', 'hamster', 'rabbit', 'dragon'];

  const get = id => THEMES[id] || THEMES.capybara;
  const forModule = n => ORDER[(((n | 0) - 1) % ORDER.length + ORDER.length) % ORDER.length];
  const vars = t => ({
    '--bg': t.palette.bg, '--brand': t.palette.brand, '--brand-dark': t.palette.brandDark,
    '--edge': t.palette.edge, '--dot': t.palette.dot,
  });
  const css = t => Object.entries(vars(t)).map(([k, v]) => `${k}:${v}`).join(';');
  const svg = (id, mood = '') => {
    const t = get(id);
    return `<svg class="capy ${mood}" viewBox="0 0 200 160" role="img" aria-label="${t.name} the ${t.animal}">${t.art()}</svg>`;
  };

  return { THEMES, ORDER, get, forModule, vars, css, svg };
});
