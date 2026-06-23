// Onboarding wizard: theme → detective → tone & difficulty → players.
// Writes State.profile. These picks personalize play AND signal taste for future cases.

import { State } from '../state.js';
import { el, mount } from '../util/dom.js';
import { Media } from '../engine/media.js';

let step = 0;
let draft = null;

function initDraft(app) {
  const p = State.profile;
  const pool = app.config.detectives.pool;
  draft = p ? structuredClone(p) : {
    theme: 'noir',
    detective: { name: '', portrait: pool[0].portrait, specialty: app.config.detectives.specialties[0].id },
    tone: 'balanced', difficulty: 'detective',
    mode: 'solo', lead: null, partner: { name: 'Sam', portrait: pool[1].portrait }, activeRole: 'lead',
  };
  // normalize older/partial profiles so the wizard never dereferences null
  if (!draft.detective) draft.detective = { name: '', portrait: pool[0].portrait, specialty: app.config.detectives.specialties[0].id };
  if (!draft.partner) draft.partner = { name: 'Sam', portrait: pool[1].portrait };
}

export function renderOnboarding(app, root) {
  if (!draft) initDraft(app);
  document.documentElement.dataset.theme = draft.theme;

  const screen = el('div', { class: 'screen screen-pad grain' });
  const wiz = el('div', { class: 'wizard' });

  // progress dots
  const dots = el('div', { class: 'wizard-steps' });
  for (let i = 0; i < 4; i++) dots.append(el('div', { class: 'dot' + (i <= step ? ' on' : '') }));

  wiz.append(
    el('div', { class: 'tcenter' }, el('div', { class: 'kicker', text: 'Build your case' }),
      el('h1', { html: '<span class="fa">پرونده جنایی</span> · Criminal Case', style: { fontSize: 'clamp(1.6rem,4vw,2.4rem)', margin: '.4rem 0 0' } })),
    dots);

  wiz.append([renderTheme, renderDetective, renderToneDiff, renderPlayers][step](app));

  // nav
  const nav = el('div', { class: 'row mt2', style: { justifyContent: 'space-between' } });
  nav.append(step > 0 ? el('button', { class: 'btn btn-ghost', text: '◂ Back', onclick: () => { step--; renderOnboarding(app, root); } }) : el('span', {}));
  if (step < 3) nav.append(el('button', { class: 'btn btn-primary', text: 'Next ▸', onclick: () => { if (validate(app)) { step++; renderOnboarding(app, root); } } }));
  else nav.append(el('button', { class: 'btn btn-primary', text: 'Begin the case ▸', onclick: () => finish(app) }));
  wiz.append(nav);

  screen.append(wiz);
  mount(root, screen);
}

function validate(app) {
  if (step === 1 && !draft.detective.name.trim()) { app.toast('Give your detective a name.'); return false; }
  return true;
}

// ---- Step 0: theme ----
function renderTheme(app) {
  const box = el('div', {});
  box.append(el('h2', { text: 'Choose a visual style' }), el('p', { class: 'sub', text: 'Re-skins the whole game. You can change it later.' }));
  const grid = el('div', { class: 'choice-grid' });
  for (const t of app.config.themes) {
    const opt = el('button', { class: 'opt' + (draft.theme === t.id ? ' sel' : ''), onclick: () => { draft.theme = t.id; document.documentElement.dataset.theme = t.id; rerenderStep(app); } },
      el('h4', { text: t.name }), el('p', { text: t.desc }),
      el('div', { class: 'swatches' }, ...t.swatches.map(c => el('span', { class: 'sw', style: { background: c } }))));
    grid.append(opt);
  }
  box.append(grid);
  return box;
}

// ---- Step 1: detective ----
function renderDetective(app) {
  const box = el('div', {});
  box.append(el('h2', { text: 'Who are you?' }), el('p', { class: 'sub', text: 'Your name and face. Each case gives your detective a story of their own.' }));
  const name = el('input', { type: 'text', value: draft.detective.name, placeholder: 'e.g., Mara Quinn', maxlength: 28,
    oninput: (e) => { draft.detective.name = e.target.value; } });
  box.append(el('label', { class: 'field' }, el('span', { text: 'Detective name' }), name));

  box.append(el('div', { class: 'field' }, el('span', { text: 'Portrait' })));
  const pg = el('div', { class: 'portrait-grid' });
  for (const c of app.config.detectives.pool) {
    const img = Media.portraitByUrl(c.portrait, { size: 80, cls: 'pick' + (draft.detective.portrait === c.portrait ? ' sel' : '') });
    img.addEventListener('click', () => { draft.detective.portrait = c.portrait; rerenderStep(app); });
    pg.append(img);
  }
  box.append(pg);

  box.append(el('div', { class: 'field mt' }, el('span', { text: 'Specialty (a small in-case perk)' })));
  const sg = el('div', { class: 'choice-grid' });
  for (const s of app.config.detectives.specialties) {
    sg.append(el('button', { class: 'opt' + (draft.detective.specialty === s.id ? ' sel' : ''), onclick: () => { draft.detective.specialty = s.id; rerenderStep(app); } },
      el('h4', { text: s.name }), el('p', { text: s.desc })));
  }
  box.append(sg);
  return box;
}

// ---- Step 2: tone & difficulty ----
function renderToneDiff(app) {
  const box = el('div', {});
  box.append(el('h2', { text: 'Tone & difficulty' }));
  box.append(el('div', { class: 'field' }, el('span', { text: 'Story tone' })));
  const tones = [['grim', 'Grim', 'Bleak and serious.'], ['balanced', 'Balanced', 'Grounded, with air to breathe.'], ['pulpy', 'Pulpy', 'Heightened, noir-flavored.']];
  box.append(grid(tones, draft.tone, v => { draft.tone = v; rerenderStep(app); }));
  box.append(el('div', { class: 'field mt' }, el('span', { text: 'Difficulty' })));
  const diffs = [['casual', 'Casual', 'Hints on, generous gates. Story-first.'], ['detective', 'Detective', 'No auto-help. Connect it yourself.'], ['hardcore', 'Hardcore', 'No hints, strict deductions.']];
  box.append(grid(diffs, draft.difficulty, v => { draft.difficulty = v; rerenderStep(app); }));
  return box;
}

// ---- Step 3: players ----
function renderPlayers(app) {
  const box = el('div', {});
  box.append(el('h2', { text: 'Players' }), el('p', { class: 'sub', text: 'Both players explore freely. Only the Lead Detective commits decisions and the accusation.' }));
  const modes = [['solo', 'Solo', 'Just you. A built-in advisor offers difficulty-scaled hints.'], ['2p', 'Two players', 'Lead Detective + Partner, same device, pass-and-play.']];
  box.append(grid(modes, draft.mode, v => { draft.mode = v; rerenderStep(app); }));
  if (draft.mode === '2p') {
    box.append(el('hr', { class: 'divider' }));
    box.append(el('label', { class: 'field' }, el('span', { text: `Lead Detective (that's the detective you built: ${draft.detective.name || '—'})` }),
      el('input', { type: 'text', value: draft.detective.name, disabled: true })));
    const pn = el('input', { type: 'text', value: draft.partner?.name || 'Sam', placeholder: 'Partner name', maxlength: 28, oninput: e => { draft.partner.name = e.target.value; } });
    box.append(el('label', { class: 'field' }, el('span', { text: 'Partner name' }), pn));
    box.append(el('div', { class: 'field' }, el('span', { text: 'Partner portrait' })));
    const pg = el('div', { class: 'portrait-grid' });
    for (const c of app.config.detectives.pool) {
      const img = Media.portraitByUrl(c.portrait, { size: 80, cls: 'pick' + (draft.partner?.portrait === c.portrait ? ' sel' : '') });
      img.addEventListener('click', () => { draft.partner.portrait = c.portrait; rerenderStep(app); });
      pg.append(img);
    }
    box.append(pg);
  }
  return box;
}

function grid(items, current, onpick) {
  const g = el('div', { class: 'choice-grid' });
  for (const [v, name, desc] of items) g.append(el('button', { class: 'opt' + (current === v ? ' sel' : ''), onclick: () => onpick(v) }, el('h4', { text: name }), el('p', { text: desc })));
  return g;
}

function rerenderStep(app) { renderOnboarding(app, document.getElementById('app')); }

function finish(app) {
  draft.lead = { name: draft.detective.name, portrait: draft.detective.portrait };
  draft.activeRole = 'lead';
  State.setProfile(structuredClone(draft));
  // fresh progress for the case
  State.resetProgress(app.config.firstCase);
  app.go('intro');
}
