// Deduction board: collect clue cards, connect two into a conclusion.
// Valid links are defined per case; invalid links are rejected (teaching gut != proof).

import { State } from '../state.js';
import { el, mount } from '../util/dom.js';
import { diff } from './difficulty.js';
import { TwoP } from './twoplayer.js';

let selected = [];   // transient selection of clue ids

export const Board = {
  defs() { return State.caseData?.clues || { clues: {}, links: [], conclusions: {} }; },
  collected() { return State.progress.board.clues; },
  conclusions() { return State.progress.board.conclusions; },

  /** Add a clue card to the board (idempotent). Returns true if newly added. */
  collect(id, app) {
    if (!id || !this.defs().clues[id]) return false;
    if (this.collected().includes(id)) return false;
    this.collected().push(id);
    State.saveProgress();
    if (app) app.toast(`Clue added to board: ${this.defs().clues[id].title}`);
    return true;
  },

  hasConclusion(id) { return this.conclusions().includes(id); },

  /** Which collected, unused clues participate in an as-yet-unformed valid link. */
  _hintableSet() {
    const set = new Set();
    for (const link of this.defs().links) {
      if (this.hasConclusion(link.conclusion)) continue;
      const [a, b] = link.pair;
      if (this.collected().includes(a) && this.collected().includes(b)) { set.add(a); set.add(b); }
    }
    return set;
  },

  _findLink(a, b) {
    return this.defs().links.find(l =>
      (l.pair[0] === a && l.pair[1] === b) || (l.pair[0] === b && l.pair[1] === a));
  },

  _formConclusion(cid, app) {
    if (this.hasConclusion(cid)) return;
    this.conclusions().push(cid);
    const c = this.defs().conclusions[cid];
    if (c?.unlocks) for (const [bucket, ids] of Object.entries(c.unlocks)) State.unlock(bucket, ids);
    if (c?.collectClue) this.collect(c.collectClue, null);
    if (c?.setFlag) State.flag(c.setFlag, true);
    State.saveProgress();
    app.toast(`Deduction formed: ${c?.title || cid}`);
    if (app.onProgress) app.onProgress();
  },

  tryConnect(app, container) {
    if (selected.length !== 2) return;
    State.progress.board.attempts++;
    const [a, b] = selected;
    const link = this._findLink(a, b);
    if (link) {
      this._formConclusion(link.conclusion, app);
      selected = [];
      this.render(app, container);
    } else {
      selected = [];
      this.render(app, container);
      // shake the cards briefly
      container.querySelectorAll('.clue').forEach(n => { n.classList.add('shake'); setTimeout(() => n.classList.remove('shake'), 400); });
      app.toast("These don't connect — yet. Keep digging.");
    }
  },

  render(app, container) {
    const d = this.defs();
    const collected = this.collected();
    const hintable = diff().autoLinkHints ? this._hintableSet() : new Set();
    const wrap = el('div', { class: 'board-area' });

    // instructions
    wrap.append(el('p', { class: 'muted small',
      text: 'Select two clues, then Connect. Real links form a deduction; a hunch that isn\'t supported won\'t.' }));

    // selection + connect bar
    const bar = el('div', { class: 'row mb' },
      el('button', {
        class: 'btn btn-primary btn-sm', text: 'Connect selected',
        disabled: selected.length !== 2,
        onclick: () => this.tryConnect(app, container),
      }),
      selected.length ? el('button', { class: 'btn btn-ghost btn-sm', text: 'Clear',
        onclick: () => { selected = []; this.render(app, container); } }) : null,
      el('span', { class: 'muted small', text: `${selected.length}/2 selected` }));
    wrap.append(bar);

    // clue cards
    if (!collected.length) {
      wrap.append(el('div', { class: 'empty', text: 'No clues yet. Examine evidence, interview people, and search locations — then "Add to board".' }));
    } else {
      const grid = el('div', { class: 'board-cards' });
      for (const id of collected) {
        const c = d.clues[id]; if (!c) continue;
        const isSel = selected.includes(id);
        const card = el('div', {
          class: 'clue' + (isSel ? ' sel' : '') + (hintable.has(id) && !isSel ? ' hintable' : ''),
          onclick: () => {
            if (isSel) selected = selected.filter(x => x !== id);
            else { selected.push(id); if (selected.length > 2) selected.shift(); }
            this.render(app, container);
          },
        },
          el('div', { class: 'clue-ico', text: c.icon || '🔍' }),
          el('div', { class: 'clue-title', text: c.title }),
          el('div', { class: 'clue-src', text: c.src || '' }));
        grid.append(card);
      }
      wrap.append(grid);
    }

    // conclusions
    const conc = this.conclusions();
    if (conc.length) {
      wrap.append(el('hr', { class: 'divider' }));
      wrap.append(el('div', { class: 'label mb', text: 'Deductions' }));
      const cg = el('div', { class: 'conclusions' });
      for (const id of conc) {
        const c = d.conclusions[id]; if (!c) continue;
        cg.append(el('div', { class: 'conclusion' },
          el('div', { class: 'clue-ico', text: '✦' }),
          el('div', { class: 'clue-title', text: c.title }),
          el('div', { class: 'small muted', text: c.text || '' })));
      }
      wrap.append(cg);
    }

    mount(container, wrap);
    return container;
  },
};
