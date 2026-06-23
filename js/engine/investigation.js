// Evidence locker, People, Locations — the free-browse investigation surfaces.

import { State } from '../state.js';
import { el, mount, paragraphs } from '../util/dom.js';
import { Media } from './media.js';
import { Board } from './board.js';

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
      wrap.append(el('div', { class: 'empty', text: 'The evidence locker is empty. Follow the story to collect evidence.' }));
    } else {
      const grid = el('div', { class: 'card-grid' });
      for (const it of items) {
        const examined = State.progress.examined.evidence.includes(it.id);
        const card = el('div', { class: 'card selectable', onclick: () => this.openEvidence(app, it) },
          Media.img(it.slot, { alt: it.name, glyph: it.glyph || '🗎', cls: 'thumb' }),
          el('div', { class: 'card-pad' },
            el('div', { class: 'row', style: { justifyContent: 'space-between' } },
              el('div', { class: 'card-title', text: it.name }),
              examined ? el('span', { class: 'pill done', text: 'examined' }) : el('span', { class: 'pill', text: 'new' })),
            el('div', { class: 'card-sub', text: it.summary || '' })));
        grid.append(card);
      }
      wrap.append(grid);
      if (items.length < total) wrap.append(el('p', { class: 'muted small mt', text: `${total - items.length} more piece(s) of evidence still to discover.` }));
    }
    mount(container, wrap);
  },

  openEvidence(app, it) {
    if (!State.progress.examined.evidence.includes(it.id)) State.progress.examined.evidence.push(it.id);
    State.saveProgress();
    const body = el('div', { class: 'modal-pad' },
      el('div', { class: 'label mb', text: 'Evidence' }),
      el('h3', { text: it.name, style: { marginTop: 0 } }),
      Media.img(it.slot, { alt: it.name, glyph: it.glyph || '🗎', cls: '' }) ,
      ...paragraphs(it.description || it.summary || '', 'lead'),
      it.notes?.length ? el('div', { class: 'label mt', text: 'Forensic notes' }) : null,
      it.notes?.length ? el('ul', { class: 'notes' }, ...it.notes.map(n => el('li', { html: n }))) : null);

    const actions = el('div', { class: 'row mt', style: { flexWrap: 'wrap' } });
    if (it.tool === 'waveform') {
      actions.append(el('button', { class: 'btn', text: '🎧 Open waveform viewer',
        onclick: () => { app.closeModal(); app.openWaveform(); } }));
    }
    if (it.clue) {
      const have = Board.collected().includes(it.clue);
      actions.append(el('button', { class: 'btn btn-primary', text: have ? '✓ On the board' : '+ Add to board', disabled: have,
        onclick: (e) => { Board.collect(it.clue, app); e.target.disabled = true; e.target.textContent = '✓ On the board'; } }));
    }
    if (it.unlocks) {
      // examining can reveal more (e.g., a gated follow-up) — applied once
      if (!State.progress.flags['ev-unlocked:' + it.id]) {
        for (const [bucket, ids] of Object.entries(it.unlocks)) State.unlock(bucket, ids);
        State.flag('ev-unlocked:' + it.id, true); State.saveProgress();
      }
    }
    actions.append(el('button', { class: 'btn btn-ghost', text: 'Close', onclick: () => app.closeModal() }));
    body.append(actions);
    app.modal(body);
  },

  // ---------------- PEOPLE ----------------
  renderPeople(app, container) {
    const map = State.caseData.people;
    const items = unlockedItems(map, 'people');
    const wrap = el('div', {});
    if (!items.length) { mount(container, el('div', { class: 'empty', text: 'No one to interview yet.' })); return; }
    const grid = el('div', { class: 'card-grid' });
    for (const p of items) {
      const done = State.progress.interviewed.includes(p.id);
      const card = el('div', { class: 'card', onclick: () => app.openDialogue(p.id) },
        el('div', { class: 'card-pad person-row' },
          Media.portrait(p.id, { size: 64 }),
          el('div', {},
            el('div', { class: 'card-title', text: p.name }),
            el('div', { class: 'card-sub', text: p.role || '' }),
            done ? el('span', { class: 'pill done', text: 'interviewed' }) : el('span', { class: 'pill', text: 'not interviewed' }))));
      grid.append(card);
    }
    mount(container, wrap.appendChild(grid) && wrap);
  },

  // ---------------- LOCATIONS ----------------
  renderLocations(app, container) {
    const map = State.caseData.locations;
    const items = unlockedItems(map, 'locations');
    const wrap = el('div', {});
    if (!items.length) { mount(container, el('div', { class: 'empty', text: 'No locations to search yet.' })); return; }
    const grid = el('div', { class: 'card-grid' });
    for (const loc of items) {
      const card = el('div', { class: 'card', onclick: () => this.openLocation(app, loc) },
        Media.img(loc.slot, { alt: loc.name, glyph: '🏠', cls: 'thumb' }),
        el('div', { class: 'card-pad' },
          el('div', { class: 'card-title', text: loc.name }),
          el('div', { class: 'card-sub', text: loc.summary || '' })));
      grid.append(card);
    }
    mount(container, wrap.appendChild(grid) && wrap);
  },

  openLocation(app, loc) {
    const body = el('div', { class: 'modal-pad' });
    const render = () => {
      mount(body,
        el('div', { class: 'label mb', text: 'Location' }),
        el('h3', { text: loc.name, style: { marginTop: 0 } }),
        Media.img(loc.slot, { alt: loc.name, glyph: '🏠' }),
        el('p', { class: 'muted', text: loc.description || loc.summary || '' }),
        el('div', { class: 'label mt', text: 'Search the scene' }),
        hotspotList(),
        el('div', { class: 'row mt' }, el('button', { class: 'btn btn-ghost', text: 'Close', onclick: () => app.closeModal() })));
    };
    const hotspotList = () => {
      const list = el('div', { class: 'stack', style: { gap: '.5rem' } });
      for (const h of (loc.hotspots || [])) {
        const key = `${loc.id}:${h.id}`;
        const seen = State.progress.examined.hotspots.includes(key);
        const btn = el('button', { class: 'opt', onclick: () => {
          if (!seen) {
            State.progress.examined.hotspots.push(key);
            if (h.unlock) for (const [bucket, ids] of Object.entries(h.unlock)) State.unlock(bucket, ids);
            if (h.clue) Board.collect(h.clue, app);
            State.saveProgress();
            if (app.onProgress) app.onProgress();
          }
          render();
        } },
          el('h4', { text: (seen ? '✓ ' : '🔎 ') + h.label }),
          seen ? el('p', { html: h.text }) : el('p', { class: 'muted', text: 'Examine…' }));
        list.append(btn);
      }
      if (!(loc.hotspots || []).length) list.append(el('p', { class: 'muted', text: 'Nothing else stands out here.' }));
      return list;
    };
    render();
    app.modal(body);
  },
};
