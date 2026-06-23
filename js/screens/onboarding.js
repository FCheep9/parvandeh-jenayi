// Setup screen (Persian/RTL). The visual theme and the detective are FIXED (chosen for the
// player); only gameplay choices remain: difficulty and solo/two-player.

import { State } from '../state.js';
import { el, mount } from '../util/dom.js';
import { Media } from '../engine/media.js';

const MARA_PORTRAIT = 'https://api.dicebear.com/9.x/pixel-art/svg?seed=mara-quinn-di&backgroundColor=141a22,1f2733&radius=6';

let draft = null;

function initDraft() {
  const p = State.profile;
  draft = {
    theme: 'noir',
    detective: { name: 'مهتاب کیانی', portrait: MARA_PORTRAIT, specialty: 'forensics' },
    tone: 'balanced',
    difficulty: p?.difficulty || 'detective',
    mode: p?.mode || 'solo',
    partner: { name: p?.partner?.name || '' },
    activeRole: 'lead',
  };
}

export function renderOnboarding(app, root) {
  if (!draft) initDraft();          // init once; re-renders must preserve the player's picks
  document.documentElement.dataset.theme = draft.theme;

  const screen = el('div', { class: 'screen screen-pad grain' });
  const box = el('div', { class: 'wrap-narrow' });

  box.append(
    el('div', { class: 'tcenter' },
      el('div', { class: 'kicker', text: 'پرونده تازه' }),
      el('h1', { class: 'fa', text: 'پرونده جنایی', style: { fontSize: 'clamp(2rem,7vw,3.4rem)', margin: '.3rem 0 .2rem' } })),
    el('div', { class: 'person-row mt2', style: { justifyContent: 'center' } },
      Media.portraitByUrl(MARA_PORTRAIT, { size: 72, alt: 'پرتره کارآگاه' }),
      el('div', {},
        el('div', { class: 'card-title', text: 'کارآگاه مهتاب کیانی' }),
        el('div', { class: 'card-sub', text: 'در بدترین سال زندگی‌ات، صدای او همدمت بود. حالا به گوش خودت هم اطمینان نداری.' }))),
    el('hr', { class: 'divider' }));

  // difficulty
  box.append(el('div', { class: 'label mb', text: 'درجهٔ سختی' }));
  box.append(optionGrid([
    ['casual', 'آسان', 'راهنمایی روشن، گذرگاه‌های آسان. داستان در اولویت.'],
    ['detective', 'کارآگاه', 'بدون کمک خودکار؛ خودت سرنخ‌ها را وصل می‌کنی.'],
    ['hardcore', 'سخت‌گیرانه', 'بدون راهنمایی، استنتاج‌های سخت‌گیرانه.'],
  ], draft.difficulty, v => { draft.difficulty = v; rerender(app, root); }, 'diff'));

  // players
  box.append(el('div', { class: 'label mb mt2', text: 'تعداد بازیکنان' }));
  box.append(optionGrid([
    ['solo', 'تک‌نفره', 'فقط تو. یک مشاور درون‌بازی، متناسب با سختی، راهنمایی می‌دهد.'],
    ['2p', 'دونفره', 'کارآگاه ارشد + همکار، روی یک دستگاه، نوبتی.'],
  ], draft.mode, v => { draft.mode = v; rerender(app, root); }, 'mode'));

  if (draft.mode === '2p') {
    box.append(el('div', { class: 'callout', style: { marginTop: '1rem' } },
      el('span', { class: 'label', text: 'نقش‌ها' }),
      el('div', { text: 'هر دو بازیکن آزادانه مدارک، اشخاص و صحنه‌ها را بررسی می‌کنند؛ اما فقط کارآگاه ارشد (مهتاب) تصمیم‌های نهایی و اتهام را قطعی می‌کند. همکار کاوش می‌کند و مشورت می‌دهد.' })));
    const pn = el('input', { type: 'text', value: draft.partner.name, placeholder: 'نام همکار (مثلاً: سام)', maxlength: 28,
      'data-test': 'partner-name', oninput: e => { draft.partner.name = e.target.value; } });
    box.append(el('label', { class: 'field mt' }, el('span', { text: 'نام همکار' }), pn));
  }

  box.append(el('button', { class: 'btn btn-primary btn-block mt2', text: 'شروع پرونده ◂', 'data-action': 'begin', onclick: () => finish(app) }));
  if (State.profile) box.append(el('button', { class: 'btn btn-ghost btn-block mt', text: 'بازگشت', onclick: () => app.go('menu') }));

  screen.append(box);
  mount(root, screen);
}

function optionGrid(items, current, onpick, kind) {
  const g = el('div', { class: 'choice-grid' });
  for (const [v, name, desc] of items) {
    g.append(el('button', { class: 'opt' + (current === v ? ' sel' : ''), dataset: { [kind]: v }, onclick: () => onpick(v) },
      el('h4', { text: name }), el('p', { text: desc })));
  }
  return g;
}

function rerender(app, root) { renderOnboarding(app, root); }

function finish(app) {
  draft.lead = { name: draft.detective.name, portrait: draft.detective.portrait };
  if (draft.mode === '2p' && !draft.partner.name.trim()) draft.partner.name = 'همکار';
  draft.activeRole = 'lead';
  State.setProfile(structuredClone(draft));
  State.resetProgress(app.config.firstCase);
  draft = null;                     // so re-entering setup reloads from the saved profile
  app.go('intro');
}
