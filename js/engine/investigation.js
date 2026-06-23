// Evidence locker, People, Locations — the free-browse investigation surfaces.

import { State } from '../state.js';
import { el, mount, paragraphs } from '../util/dom.js';
import { Media } from './media.js';
import { Board } from './board.js';
import { Sound } from '../util/audio.js';

const LOC_SOUND = { 'loc-booth': 'amb-booth', 'loc-control-room': 'amb-control', 'loc-saltwire-ext': 'amb-rain' };

function unlockedItems(map, bucket) {
  const ids = State.progress.unlocked[bucket];
  return ids.map(id => map[id]).filter(Boolean);
}

export const Investigation = {
  // ---------------- EVIDENCE ----------------
  renderEvidence(app, container) {
    const map = State.caseData.evidence;
    const items = unlockedItems(map, 'evidence');
    const total = Object.keys(map).length;
    const wrap = el('div', {});
    if (!items.length) {
      wrap.append(el('div', { class: 'empty', text: 'گنجه‌ی مدارک خالی است. داستان را دنبال کن تا مدرک جمع شود.' }));
    } else {
      const grid = el('div', { class: 'card-grid' });
      for (const it of items) {
        const examined = State.progress.examined.evidence.includes(it.id);
        const card = el('div', { class: 'card selectable', dataset: { ev: it.id }, onclick: () => this.openEvidence(app, it) },
          Media.img(it.slot, { alt: it.name, glyph: it.glyph || '🗎', cls: 'thumb' }),
          el('div', { class: 'card-pad' },
            el('div', { class: 'row', style: { justifyContent: 'space-between' } },
              el('div', { class: 'card-title', text: it.name }),
              examined ? el('span', { class: 'pill done', text: 'بررسی‌شده' }) : el('span', { class: 'pill', text: 'تازه' })),
            el('div', { class: 'card-sub', text: it.summary || '' })));
        grid.append(card);
      }
      wrap.append(grid);
      if (items.length < total) wrap.append(el('p', { class: 'muted small mt', text: `${total - items.length} مدرک دیگر هنوز کشف نشده است.` }));
    }
    mount(container, wrap);
  },

  openEvidence(app, it) {
    if (!State.progress.examined.evidence.includes(it.id)) State.progress.examined.evidence.push(it.id);
    State.saveProgress();
    const body = el('div', { class: 'modal-pad' },
      el('div', { class: 'label mb', text: 'مدرک' }),
      el('h3', { text: it.name, style: { marginTop: 0 } }),
      Media.img(it.slot, { alt: it.name, glyph: it.glyph || '🗎', cls: '' }) ,
      ...paragraphs(it.description || it.summary || '', 'lead'),
      it.notes?.length ? el('div', { class: 'label mt', text: 'یادداشت‌های پزشکی‌قانونی' }) : null,
      it.notes?.length ? el('ul', { class: 'notes' }, ...it.notes.map(n => el('li', { html: n }))) : null);

    const actions = el('div', { class: 'row mt', style: { flexWrap: 'wrap' } });
    if (it.tool === 'waveform') {
      actions.append(el('button', { class: 'btn', text: '🎧 باز کردن نمایشگر موج صوتی', dataset: { action: 'open-waveform' },
        onclick: () => { app.closeModal(); app.openWaveform(); } }));
    }
    if (it.clue) {
      const have = Board.collected().includes(it.clue);
      actions.append(el('button', { class: 'btn btn-primary', dataset: { action: 'add-clue' }, text: have ? '✓ روی تابلو' : '+ افزودن به تابلو', disabled: have,
        onclick: (e) => { Board.collect(it.clue, app); e.target.disabled = true; e.target.textContent = '✓ روی تابلو'; } }));
    }
    if (it.unlocks) {
      // examining can reveal more (e.g., a gated follow-up) — applied once
      if (!State.progress.flags['ev-unlocked:' + it.id]) {
        for (const [bucket, ids] of Object.entries(it.unlocks)) State.unlock(bucket, ids);
        State.flag('ev-unlocked:' + it.id, true); State.saveProgress();
      }
    }
    actions.append(el('button', { class: 'btn btn-ghost', text: 'بستن', onclick: () => app.closeModal() }));
    body.append(actions);
    app.modal(body);
  },

  // ---------------- PEOPLE ----------------
  renderPeople(app, container) {
    const map = State.caseData.people;
    const items = unlockedItems(map, 'people');
    const wrap = el('div', {});
    if (!items.length) { mount(container, el('div', { class: 'empty', text: 'هنوز کسی برای مصاحبه نیست.' })); return; }
    const grid = el('div', { class: 'card-grid' });
    for (const p of items) {
      const done = State.progress.interviewed.includes(p.id);
      const card = el('div', { class: 'card', dataset: { person: p.id }, onclick: () => app.openDialogue(p.id) },
        el('div', { class: 'card-pad person-row' },
          Media.portrait(p.id, { size: 64 }),
          el('div', {},
            el('div', { class: 'card-title', text: p.name }),
            el('div', { class: 'card-sub', text: p.role || '' }),
            done ? el('span', { class: 'pill done', text: 'مصاحبه‌شده' }) : el('span', { class: 'pill', text: 'مصاحبه‌نشده' }))));
      grid.append(card);
    }
    mount(container, wrap.appendChild(grid) && wrap);
  },

  // ---------------- LOCATIONS (travel map) ----------------
  renderLocations(app, container) {
    const map = State.caseData.locations;
    const items = unlockedItems(map, 'locations');
    if (!items.length) { mount(container, el('div', { class: 'empty', text: 'هنوز مکانی برای رفتن نیست.' })); return; }
    const objLoc = objectiveLocation();
    const wrap = el('div', {});
    wrap.append(el('p', { class: 'muted small mb', text: 'به یک محل برو تا صحنه را از نزدیک بگردی. نشانه‌های روی تصویر را بزن تا چیزها را بررسی کنی.' }));
    const grid = el('div', { class: 'card-grid' });
    for (const loc of items) {
      const isObj = loc.id === objLoc;
      const present = presentPeople(loc);
      const card = el('div', { class: 'card loc-card' + (isObj ? ' objective' : ''), dataset: { loc: loc.id }, onclick: () => this.openLocation(app, loc) },
        el('div', { class: 'loc-thumb-wrap' },
          Media.img(loc.slot, { alt: loc.name, glyph: '🏠', cls: 'thumb' }),
          isObj ? el('span', { class: 'loc-flag', text: '◂ برو اینجا' }) : null),
        el('div', { class: 'card-pad' },
          el('div', { class: 'card-title', text: loc.name }),
          el('div', { class: 'card-sub', text: loc.summary || '' }),
          present.length ? el('div', { class: 'loc-people' }, ...present.map(p => Media.portrait(p.id, { size: 26 })), el('span', { class: 'muted small', text: `${present.length} نفر اینجاست` }) ) : null,
          el('div', { class: 'loc-enter', text: 'ورود به صحنه ◂' })));
      grid.append(card);
    }
    wrap.append(grid);
    mount(container, wrap);
  },

  // full-screen scene: hotspots pinned on the photo + people present
  openLocation(app, loc) {
    Sound.scene(LOC_SOUND[loc.id] || 'amb-booth');
    const overlay = el('div', { class: 'scene grain' });

    const caption = el('div', { class: 'scene-caption' }, el('span', { class: 'muted', html: loc.description || loc.summary || '' }));
    const stage = el('div', { class: 'scene-stage' });
    stage.append(Media.img(loc.slot, { alt: loc.name, glyph: '🏠', cls: 'scene-img' }));

    (loc.hotspots || []).forEach((h, i) => {
      const key = `${loc.id}:${h.id}`;
      const seen = () => State.progress.examined.hotspots.includes(key);
      const pos = (h.x != null && h.y != null) ? { left: h.x + '%', top: h.y + '%' } : { left: (16 + (i * 24) % 68) + '%', top: (82 - (i % 2) * 12) + '%' };
      const pin = el('button', { class: 'scene-hotspot' + (seen() ? ' done' : ''), dataset: { hotspot: h.id }, style: pos, 'aria-label': h.label },
        el('span', { class: 'dot', text: seen() ? '✓' : '؟' }), el('span', { class: 'lbl', text: h.label }));
      pin.addEventListener('click', () => {
        if (!seen()) {
          State.progress.examined.hotspots.push(key);
          if (h.unlock) for (const [b, ids] of Object.entries(h.unlock)) State.unlock(b, ids);
          if (h.clue) Board.collect(h.clue, app);
          State.saveProgress(); if (app.onProgress) app.onProgress();
        }
        pin.classList.add('done'); pin.querySelector('.dot').textContent = '✓';
        mount(caption, el('span', { html: `<b>${h.label}:</b> ${h.text}` }));
      });
      stage.append(pin);
    });

    // people present here
    const present = presentPeople(loc);
    const peopleStrip = present.length ? el('div', { class: 'scene-people' },
      el('span', { class: 'label', text: 'اینجا حاضرند:' }),
      ...present.map(p => el('button', { class: 'scene-person', dataset: { person: p.id }, onclick: () => app.openDialogue(p.id) },
        Media.portrait(p.id, { size: 40 }), el('span', { text: p.name })))) : null;

    const back = () => { Sound.scene('amb-booth'); overlay.remove(); if (app.refreshTabs) app.refreshTabs(); };
    const topbar = el('div', { class: 'scene-topbar' },
      el('button', { class: 'btn btn-sm btn-ghost', text: 'بازگشت ▸', onclick: back }),
      el('div', { class: 'scene-title' }, el('span', { class: 'card-title', text: loc.name }), el('span', { class: 'muted small', text: 'روی نشانه‌ها بزن تا بررسی کنی' })));

    overlay.append(topbar, stage, peopleStrip, caption);
    document.body.append(overlay);
  },
};

function currentBeat() {
  const P = State.progress; const a = State.caseData.acts[P.actIndex]; return a && a.beats[P.beatIndex];
}
function objectiveLocation() {
  const b = currentBeat(); if (!b) return null;
  if (b.goLocation) return b.goLocation;
  if (b.require && b.require.type === 'search' && b.require.target) return String(b.require.target).split(':')[0];
  return null;
}
function presentPeople(loc) {
  return (loc.people || []).filter(id => State.has('people', id) && State.caseData.people[id]).map(id => State.caseData.people[id]);
}
