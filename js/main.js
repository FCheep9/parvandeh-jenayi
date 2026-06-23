// Bootstrap + router + app context. Vanilla ES modules, no build step.

import { State } from './state.js';
import { el, mount, paragraphs } from './util/dom.js';
import { Media } from './engine/media.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderHub } from './screens/casehub.js';
import { openDialogue } from './screens/dialogue.js';
import { openWaveform } from './screens/waveform.js';
import { Sound } from './util/audio.js';

const root = document.getElementById('app');

async function getJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return res.json();
}

const app = {
  route: 'loading',
  config: null,           // { registry, themes, detectives, firstCase }
  go, rerender, toast, modal, closeModal,
  openDialogue: (id) => openDialogue(app, id),
  openWaveform: () => openWaveform(app),
  openCredits,
};
if (typeof window !== 'undefined') window.__PJ_APP__ = app; // debug/test handle

// ---------------- config + case loading ----------------
async function loadConfig() {
  const [registry, themes, detectives] = await Promise.all([
    getJSON('data/registry.json'), getJSON('data/themes.json'), getJSON('data/detectives.json'),
  ]);
  let sounds = { slots: {} };
  try { sounds = await getJSON('data/sounds.json'); } catch {}
  app.config = { registry, themes, detectives, sounds, firstCase: registry.firstCase };
}

async function loadCase(caseId) {
  if (State.caseData && State.caseId === caseId) return;
  const base = `data/cases/${caseId}/`;
  const [main, evidence, people, locations, clues, media] = await Promise.all([
    getJSON(base + 'case.json'), getJSON(base + 'evidence.json'), getJSON(base + 'people.json'),
    getJSON(base + 'locations.json'), getJSON(base + 'clues.json'), getJSON(base + 'media.json'),
  ]);
  State.caseId = caseId;
  State.caseData = { meta: main.meta, acts: main.acts, evidence, people, locations, clues, media };
}

// ---------------- router ----------------
async function go(route, params) {
  app.route = route; app.params = params || {};
  if (document.documentElement.dataset.theme == null && State.profile) document.documentElement.dataset.theme = State.profile.theme;
  try {
    if (route === 'onboarding') return renderOnboarding(app, root);
    if (route === 'menu') return renderMenu();
    if (route === 'intro') { await loadCase(app.config.firstCase); return renderIntro(); }
    if (route === 'play') {
      await loadCase(app.config.firstCase);
      if (!State.loadProgress(State.caseId)) { State.progress = State.freshProgress(); State.saveProgress(); }
      document.documentElement.dataset.theme = State.profile?.theme || 'noir';
      return renderHub(app, root);
    }
  } catch (err) {
    console.error(err);
    mount(root, el('div', { class: 'screen screen-pad center' },
      el('div', { class: 'wrap-narrow' }, el('h2', { text: 'در بارگذاری پرونده مشکلی پیش آمد.' }),
        el('p', { class: 'muted', text: String(err.message || err) }),
        el('button', { class: 'btn btn-primary mt', text: 'بارگذاری دوباره', onclick: () => location.reload() }))));
  }
}

function rerender() { go(app.route, app.params); }

// ---------------- menu / intro ----------------
function renderMenu() {
  document.documentElement.dataset.theme = State.profile?.theme || 'noir';
  Sound.scene('amb-menu');
  const reg = app.config.registry;
  const hasSave = State.hasSave(app.config.firstCase);
  const screen = el('div', { class: 'screen screen-pad center grain' });
  const box = el('div', { class: 'wrap-narrow tcenter' });
  box.append(
    el('div', { class: 'kicker', text: 'Criminal Case' }),
    el('h1', { html: '<span class="fa">پرونده جنایی</span>', style: { fontSize: 'clamp(2.4rem,8vw,4rem)', margin: '.3rem 0' } }),
    el('p', { class: 'muted', text: State.profile ? `کارآگاه ${State.profile.detective.name} · ${DIFF_FA[State.profile.difficulty] || ''} · ${State.profile.mode === '2p' ? 'دونفره' : 'تک‌نفره'}` : '' }));

  const actions = el('div', { class: 'stack mt2', style: { gap: '.6rem', maxWidth: '360px', margin: '2rem auto 0' } });
  if (hasSave) actions.append(el('button', { class: 'btn btn-primary btn-block', text: 'ادامه‌ی پرونده ◂', onclick: () => go('play') }));
  actions.append(el('button', { class: 'btn btn-block', text: hasSave ? 'شروع دوباره‌ی پرونده' : 'شروع پرونده ◂', onclick: () => { if (hasSave) { State.resetProgress(app.config.firstCase); } go('intro'); } }));
  actions.append(el('button', { class: 'btn btn-block', text: State.profile ? 'تنظیمات بازی' : 'تنظیم بازی', onclick: () => go('onboarding') }));
  actions.append(el('button', { class: 'btn btn-ghost btn-block', text: 'منابع و دست‌اندرکاران', onclick: openCredits }));
  box.append(actions);

  // case list
  box.append(el('hr', { class: 'divider mt2' }), el('div', { class: 'label mb', text: 'پرونده‌ها' }));
  const list = el('div', { class: 'stack', style: { gap: '.5rem', textAlign: 'left' } });
  for (const c of reg.cases) {
    list.append(el('div', { class: 'card', style: { cursor: c.playable ? 'pointer' : 'default' }, onclick: () => { if (c.playable) go('intro'); } },
      el('div', { class: 'card-pad' },
        el('div', { class: 'row', style: { justifyContent: 'space-between' } },
          el('div', { class: 'card-title', text: c.title }),
          el('span', { class: 'pill' + (c.playable ? ' done' : ''), text: c.playable ? 'قابل بازی' : 'به‌زودی' })),
        el('div', { class: 'card-sub', text: c.logline }))));
  }
  box.append(list);
  screen.append(box);
  mount(root, screen);
}

function renderIntro() {
  const m = State.caseData.meta;
  Sound.scene('amb-menu');
  const screen = el('div', { class: 'screen screen-pad center grain' });
  const box = el('div', { class: 'wrap-narrow tcenter' },
    el('div', { class: 'kicker', text: m.act_label || 'پرونده ۰۱' }),
    el('h1', { html: m.title, style: { fontSize: 'clamp(1.8rem,5vw,3rem)', margin: '.4rem 0 1rem' } }),
    Media.img('loc-booth', { alt: 'استودیوی آوای نقره', glyph: '🎙', cls: 'beat-img' }),
    el('div', { class: 'beat-body mt', style: { textAlign: 'start' } }, ...paragraphs(m.logline, 'lead')),
    el('p', { class: 'muted small', text: `نقش ${State.profile?.detective?.name || 'کارآگاه'} را بازی می‌کنی. ${m.protagonist_note || ''}` }),
    el('div', { class: 'row mt2', style: { justifyContent: 'center', gap: '.6rem' } },
      el('button', { class: 'btn btn-primary', text: 'شروع ◂', onclick: () => { State.resetProgress(app.config.firstCase); State.progress = State.freshProgress(); State.saveProgress(); go('play'); } }),
      el('button', { class: 'btn btn-ghost', text: 'بازگشت', onclick: () => go('menu') })));
  screen.append(box);
  mount(root, screen);
}

// ---------------- credits ----------------
function openCredits() {
  const body = el('div', { class: 'modal-pad' });
  const creds = Media.credits();
  const list = el('ul', { class: 'notes' });
  list.append(el('li', { html: 'پرتره‌ی شخصیت‌ها: پیکسل‌آرت از <b>DiceBear</b> (سبک pixel-art، رایگان).' }));
  for (const c of creds) {
    list.append(el('li', { html: `${c.title} — اثرِ ${c.creator} · ${c.license || ''} ${c.landing ? `· <a href="${c.landing}" target="_blank" rel="noopener">منبع</a>` : ''}` }));
  }
  mount(body,
    el('div', { class: 'row mb', style: { justifyContent: 'space-between' } },
      el('div', { class: 'label', text: 'منابع و دست‌اندرکاران' }),
      el('button', { class: 'btn btn-ghost btn-sm', text: 'بستن', onclick: closeModal })),
    el('p', { class: 'muted small', text: 'عکس‌ها از طریق API اوپن‌ورس (کریتیو کامنز / مالکیت عمومی) گرفته شده‌اند. ساخته‌شده با Claude Code.' }),
    list);
  modal(body);
}

// ---------------- modal / toast ----------------
function modal(contentNode) {
  closeModal();
  const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) closeModal(); } },
    el('div', { class: 'modal' }, contentNode));
  back.id = 'modal-host';
  document.body.append(back);
}
function closeModal() { document.getElementById('modal-host')?.remove(); }

let toastHost = null;
function toast(msg) {
  if (!toastHost) { toastHost = el('div', { class: 'toast-host' }); document.body.append(toastHost); }
  const t = el('div', { class: 'toast', text: msg });
  toastHost.append(t);
  setTimeout(() => t.remove(), 3200);
}

const DIFF_FA = { casual: 'آسان', detective: 'کارآگاه', hardcore: 'سخت‌گیرانه' };

// ---------------- boot ----------------
(async function boot() {
  try {
    await loadConfig();
    State.loadProfile();
    Sound.setSources(app.config.sounds); Sound.init(); Sound.mountControl();
    go(State.profile ? 'menu' : 'onboarding');
  } catch (err) {
    console.error(err);
    mount(root, el('div', { class: 'loading', text: 'خطا در اجرا: ' + (err.message || err) }));
  }
})();
