// Media resolution: real photos (Openverse, baked into media.json) + portraits (randomuser),
// with a styled SVG placeholder fallback so a missing/blocked image never looks broken.

import { State } from '../state.js';
import { el } from '../util/dom.js';

function svgPlaceholder(label = '', glyph = '◆') {
  const txt = String(label).slice(0, 28);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='%23161b22'/><stop offset='1' stop-color='%230d1014'/></linearGradient></defs>` +
    `<rect width='100%25' height='100%25' fill='url(%23g)'/>` +
    `<text x='50%25' y='44%25' fill='%23c8a14a' font-size='46' text-anchor='middle' font-family='Georgia,serif'>${glyph}</text>` +
    `<text x='50%25' y='66%25' fill='%238b8d93' font-size='17' text-anchor='middle' font-family='monospace'>${encodeURIComponent(txt).replace(/%20/g,' ')}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${svg}`;
}

export const Media = {
  slots() { return State.caseData?.media?.slots || {}; },
  people() { return State.caseData?.media?.people || {}; },

  photoUrl(slotId) { return this.slots()[slotId]?.url || null; },
  portraitUrl(personId) { return this.people()[personId]?.portrait || null; },

  /** <img> for a scene/evidence slot, with placeholder fallback + theme filter. */
  img(slotId, { alt = '', glyph = '◆', cls = '' } = {}) {
    const url = this.photoUrl(slotId);
    const fallback = svgPlaceholder(alt || slotId, glyph);
    const node = el('img', {
      class: `photo-filter ${cls}`.trim(),
      alt, loading: 'lazy', src: url || fallback,
    });
    if (url) node.addEventListener('error', () => { node.src = fallback; node.classList.remove('photo-filter'); }, { once: true });
    return node;
  },

  /** Circular portrait <img> for a character. */
  portrait(personId, { size = 64, cls = '' } = {}) {
    const url = this.portraitUrl(personId);
    const fallback = svgPlaceholder('', '☻');
    const node = el('img', {
      class: `portrait ${cls}`.trim(), width: size, height: size,
      style: { width: size + 'px', height: size + 'px' },
      alt: personId, loading: 'lazy', src: url || fallback,
    });
    if (url) node.addEventListener('error', () => { node.src = fallback; }, { once: true });
    return node;
  },

  /** Pass-through portrait by absolute URL (onboarding detective pool). */
  portraitByUrl(url, { size = 80, cls = '', alt = 'Detective portrait' } = {}) {
    const fallback = svgPlaceholder('', '☻');
    const node = el('img', { class: `portrait ${cls}`.trim(), style: { width: size + 'px', height: size + 'px' }, src: url || fallback, alt, loading: 'lazy' });
    node.addEventListener('error', () => { node.src = fallback; }, { once: true });
    return node;
  },

  credits() {
    const out = [];
    for (const [id, s] of Object.entries(this.slots())) if (s.credit) out.push({ id, ...s.credit });
    return out;
  },
};
