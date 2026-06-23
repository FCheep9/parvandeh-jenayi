// The play screen: header (clock, roles, notebook), tab bar, and the active surface.
// Also hosts the cinematic cold-open before play begins.

import { State } from '../state.js';
import { el, mount } from '../util/dom.js';
import { Story } from '../engine/story.js';
import { Investigation } from '../engine/investigation.js';
import { Board } from '../engine/board.js';
import { TwoP } from '../engine/twoplayer.js';
import { Sound } from '../util/audio.js';

let activeTab = 'story';

const TABS = [
  { id: 'story', label: 'داستان' },
  { id: 'evidence', label: 'مدارک' },
  { id: 'people', label: 'اشخاص' },
  { id: 'locations', label: 'مکان‌ها' },
  { id: 'board', label: 'تابلو' },
];

function objectiveText() {
  const P = State.progress;
  if (P.phase !== 'play') return null;
  const a = State.caseData.acts[P.actIndex];
  const b = a && a.beats[P.beatIndex];
  return b ? (b.objective || b.title || null) : null;
}

function badge(tab) {
  const P = State.progress;
  if (tab === 'evidence') { const n = P.unlocked.evidence.filter(id => !P.examined.evidence.includes(id)).length; return n || ''; }
  if (tab === 'people') { const n = P.unlocked.people.filter(id => !P.interviewed.includes(id)).length; return n || ''; }
  if (tab === 'board') { return Board.collected().length || ''; }
  return '';
}

export function renderHub(app, root) {
  if (State.progress.phase === 'cinematic') { renderCinematic(app, root); return; }
  Sound.scene('amb-booth');

  const hub = el('div', { class: 'hub grain' });

  // header
  const header = el('div', { class: 'hub-header' },
    el('div', { class: 'hub-title' }, el('span', { html: State.caseData.meta.title }), el('small', { text: State.caseData.meta.act_label || 'پرده ۱' })),
    el('div', { class: 'spacer' }),
    State.caseData.meta.clock ? el('div', { class: 'clock', html: State.caseData.meta.clock }) : null,
    TwoP.roleChips(app),
    el('button', { class: 'btn btn-sm btn-ghost', text: '✎ دفترچه', onclick: () => openNotebook(app) }),
    el('button', { class: 'btn btn-sm btn-ghost', text: '☰', onclick: () => app.go('menu') }));
  hub.append(header);

  // tabbar
  const tabbar = el('div', { class: 'tabbar' });
  for (const t of TABS) {
    const b = badge(t.id);
    tabbar.append(el('button', {
      class: 'tab' + (activeTab === t.id ? ' active' : ''),
      dataset: { tab: t.id },
      onclick: () => { setTab(t.id, app); },
    }, el('span', { text: t.label }), b ? el('span', { class: 'badge', text: '●' + b }) : null));
  }
  hub.append(tabbar);

  // body
  const body = el('div', { class: 'hub-body' });
  const inner = el('div', { class: 'wrap-wide' });
  const obj = objectiveText();
  if (obj && activeTab !== 'story') inner.append(el('div', { class: 'objective-bar' }, el('span', { class: 'label', text: 'هدف:' }), el('span', { text: obj })));
  const content = el('div', {});
  inner.append(content);
  body.append(inner);
  hub.append(body);

  mount(root, hub);
  renderActive(app, content);

  // expose refreshers
  app.refreshTabs = () => { /* re-render tabbar badges */ renderHub(app, root); };
  app.setTab = (name) => setTab(name, app);
  app.showStory = () => setTab('story', app);
}

function setTab(name, app) {
  activeTab = name;
  if (!State.progress.tabsSeen.includes(name)) { State.progress.tabsSeen.push(name); State.saveProgress(); }
  // full re-render to refresh badges + active surface
  const root = document.getElementById('app');
  renderHub(app, root);
}

function renderActive(app, content) {
  switch (activeTab) {
    case 'story': Story.render(app, content); break;
    case 'evidence': Investigation.renderEvidence(app, content); break;
    case 'people': Investigation.renderPeople(app, content); break;
    case 'locations': Investigation.renderLocations(app, content); break;
    case 'board': Board.render(app, content); break;
  }
}

// ---------------- Notebook ----------------
function openNotebook(app) {
  const body = el('div', { class: 'modal-pad' });
  const render = () => {
    const list = el('ul', { class: 'note-list' });
    const notes = State.progress.notebook;
    if (!notes.length) list.append(el('li', { class: 'muted', text: 'هنوز یادداشتی نیست.' }));
    for (const n of notes) {
      const who = n.by === 'advisor' ? 'همکار (مشاور)' : n.by === 'partner' ? TwoP.partnerName() : 'تو';
      list.append(el('li', { class: 'note-item' + (n.by === 'advisor' ? ' hint' : '') },
        el('div', { class: 'by', text: who }), el('div', { text: n.text })));
    }
    const ta = el('textarea', { placeholder: TwoP.isTwoPlayer() ? `${TwoP.partnerName()}، یک ظن یا مشورت برای ارشد بنویس…` : 'یادداشتی بنویس…' });
    mount(body,
      el('div', { class: 'row mb', style: { justifyContent: 'space-between' } },
        el('div', { class: 'label', text: 'دفترچه‌ی کارآگاه' }),
        el('button', { class: 'btn btn-ghost btn-sm', text: 'بستن', onclick: () => app.closeModal() })),
      list,
      el('div', { class: 'mt' }, ta,
        el('button', { class: 'btn btn-primary mt', text: 'افزودن یادداشت', onclick: () => { TwoP.addPartnerNote(ta.value); render(); } })));
  };
  render();
  app.modal(body);
}

// ---------------- Cinematic cold open (click/tap to advance) ----------------
function renderCinematic(app, root) {
  Sound.scene('amb-tension');
  const slides = State.caseData.meta.coldOpen || [{ text: '…' }];
  let i = 0, animating = false, raf = null;
  const cine = el('div', { class: 'cine' });
  const textEl = el('div', { class: 'cine-text' });
  const subEl = el('div', { class: 'cine-sub' });
  const canvas = el('canvas', { width: 640, height: 80 });
  const hint = el('div', { class: 'cine-hint', text: 'برای ادامه ضربه بزن' });
  const skip = el('button', { class: 'btn btn-ghost btn-sm skip', text: 'رد کردن ◂', onclick: (e) => { e.stopPropagation(); finish(); } });
  cine.append(textEl, subEl, canvas, hint, skip);
  mount(root, cine);

  function drawCine(even) {
    cancelAnimationFrame(raf);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const w = canvas.width, h = canvas.height, mid = h / 2;
    let phase = 0;
    const tick = () => {
      phase += 0.04;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#c8a14a'; ctx.globalAlpha = .8;
      for (let x = 0; x < w; x += 3) {
        const t = x / w;
        const gap = even ? (Math.abs((t * 7) % 1 - 0.5) < 0.04) : (Math.sin(t * 50 + phase) > 0.96);
        const a = gap ? 2 : (10 + Math.abs(Math.sin(t * (even ? 40 : 23) + (even ? phase * 0.5 : t * 9 + phase))) * (h * 0.4));
        ctx.beginPath(); ctx.moveTo(x, mid - a); ctx.lineTo(x, mid + a); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    tick();
  }
  function show() {
    const s = slides[i];
    animating = true;
    textEl.style.opacity = 0; subEl.style.opacity = 0;
    setTimeout(() => {
      textEl.textContent = s.text || ''; subEl.textContent = s.sub || '';
      textEl.style.transition = 'opacity .5s'; subEl.style.transition = 'opacity .5s';
      textEl.style.opacity = 1; subEl.style.opacity = 1;
      drawCine(i >= slides.length - 2);   // last two slides go "even/synthetic"
      hint.textContent = (i >= slides.length - 1) ? 'برای ورود به پرونده ضربه بزن' : 'برای ادامه ضربه بزن';
      animating = false;
    }, 220);
  }
  function next() { if (animating) return; i++; (i < slides.length) ? show() : finish(); }
  function finish() {
    cancelAnimationFrame(raf);
    cine.remove();
    Sound.scene('amb-booth');
    State.progress.phase = 'play'; State.saveProgress();
    activeTab = 'story';
    renderHub(app, root);
  }
  cine.addEventListener('click', next);
  show();
}
