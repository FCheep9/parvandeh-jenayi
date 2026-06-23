// Audio-forensics viewer — the case's signature mechanic, done *visually* (no audio assets).
// The player compares a real archival recording (irregular human breaths) against a "new"
// release (metronomically even breaths + a constant room-tone hum). Optional Web Audio
// playback adds flavor but is never required to deduce.

import { State } from '../state.js';
import { el, mount } from '../util/dom.js';
import { Board } from '../engine/board.js';
import { diff } from '../engine/difficulty.js';
import { Sound } from '../util/audio.js';

// deterministic pseudo-random
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function drawWave(canvas, { gaps, hum = 0, seed = 7 }) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 560, h = canvas.clientHeight || 90;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  const mid = h / 2;
  const rand = rng(seed);
  // amplitude profile
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim() || '#6fb3c9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x++) {
    const t = x / w;
    // breath gap: amplitude dips near each gap center
    let env = 1;
    for (const g of gaps) { const d = Math.abs(t - g); if (d < 0.018) env = Math.min(env, 0.06 + d * 3); }
    const speech = (0.55 + 0.45 * Math.sin(t * 90 + rand() * 0.6)) * (0.5 + rand() * 0.5);
    let a = env * speech * (h * 0.42);
    if (hum) a += hum * (h * 0.10) * Math.sin(t * 600); // faint constant ripple = mains hum
    ctx.moveTo(x, mid - a); ctx.lineTo(x, mid + a);
  }
  ctx.stroke();
  // breath markers
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#888';
  for (const g of gaps) { ctx.fillRect(g * w - 1, h - 8, 2, 6); }
}


const CLIPS = [
  {
    id: 'archival', title: 'دل‌آرا وثوقی — نسخه‌ی مادرِ بایگانی (سال گذشته)',
    gaps: [0.10, 0.26, 0.47, 0.61, 0.83], hum: 0, seed: 31,
    voxText: 'شب از نیمه گذشته بود و شهر زیر باران نفس می‌کشید؛ او در را پشت سرش بست و چراغ را خاموش کرد.',
    truth: 'نفس‌های نامنظم — یک گوینده‌ی زنده. اینجا چیزی ناجور نیست.', anomaly: false,
  },
  {
    id: 'new-release', title: 'دل‌آرا وثوقی — انتشار «تازه» (این هفته)',
    gaps: [0.14, 0.29, 0.43, 0.57, 0.71, 0.85], hum: 1, seed: 99,
    voxText: 'صبح که از راه رسید، هیچ‌کس نمی‌دانست دیشب در آن خانه‌ی ساکت دقیقاً چه گذشته است.',
    truth: 'نفس‌ها روی یک مترونومِ کاملاً منظم فرود می‌آیند و یک وزوزِ ثابتِ کم‌فرکانس زیرشان جریان دارد — هیچ گوینده‌ی زنده‌ای این‌طور نفس نمی‌کشد.',
    anomaly: true, clue: 'breaths-wrong',
  },
];

export function openWaveform(app) {
  const body = el('div', { class: 'modal-pad' });
  const auto = diff().autoAnnotate;
  const tool = el('div', { class: 'wave-tool' });

  for (const clip of CLIPS) {
    const row = el('div', { class: 'wave-row' });
    const canvas = el('canvas', { class: 'wave-canvas' });
    row.append(
      el('h4', {}, el('span', { text: clip.title }),
        el('button', { class: 'btn btn-sm btn-ghost', text: '▶ پخش', onclick: () => Sound.playVox(clip.voxText || clip.title) })),
      canvas);
    if (clip.anomaly) {
      const have = Board.collected().includes(clip.clue);
      const note = el('div', { class: 'wave-note' + (auto ? ' flag' : '') });
      if (auto) note.textContent = '⚑ ' + clip.truth;
      else note.textContent = 'فاصله‌ی نفس‌ها را با کلیپ بایگانیِ بالا مقایسه کن. چیزی می‌بینی؟';
      row.append(note);
      row.append(el('button', {
        class: 'btn btn-sm ' + (have ? '' : 'btn-primary'), dataset: { action: 'flag-clip' },
        text: have ? '✓ روی تابلو نشان‌گذاری شد' : '⚑ این کلیپ را مشکوک نشان‌گذاری کن', disabled: have,
        style: { marginTop: '.6rem' },
        onclick: (e) => {
          Board.collect(clip.clue, app);
          State.flag('flagged-audio', true); State.saveProgress();
          if (app.onProgress) app.onProgress();
          e.target.disabled = true; e.target.textContent = '✓ روی تابلو نشان‌گذاری شد';
          note.classList.add('flag'); note.textContent = '⚑ ' + clip.truth;
        },
      }));
    } else {
      row.append(el('div', { class: 'wave-note', text: auto ? clip.truth : 'یک ضبط مرجع.' }));
    }
    tool.append(row);
    requestAnimationFrame(() => drawWave(canvas, clip));
  }

  mount(body,
    el('div', { class: 'label mb', text: 'تحلیل صوتی' }),
    el('h3', { text: 'مقایسه‌ی موج صوتی', style: { marginTop: 0 } }),
    el('p', { class: 'muted small', text: 'هر خط عمودی، صدا در طول زمان است. ستون‌های بلندتر گفتارند؛ دره‌های باریک، نفس‌ها.' }),
    tool,
    el('div', { class: 'row mt' }, el('button', { class: 'btn btn-ghost', text: 'بستن', onclick: () => app.closeModal() })));
  app.modal(body);
}
