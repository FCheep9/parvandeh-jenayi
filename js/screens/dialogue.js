// Branching interview UI (opened as a modal). Topics gate on evidence/clues/flags;
// "press" topics are highlighted on Casual.

import { State } from '../state.js';
import { el, mount } from '../util/dom.js';
import { Media } from '../engine/media.js';
import { Board } from '../engine/board.js';
import { diff } from '../engine/difficulty.js';

function satisfied(req) {
  if (!req) return true;
  if (req.flag && !State.flag(req.flag)) return false;
  if (req.evidence && !State.has('evidence', req.evidence)) return false;
  if (req.clue && !Board.collected().includes(req.clue)) return false;
  return true;
}

function applyReveals(rev, app) {
  if (!rev) return;
  for (const bucket of ['evidence', 'people', 'locations']) if (rev[bucket]) State.unlock(bucket, rev[bucket]);
  if (rev.clue) Board.collect(rev.clue, app);
  if (rev.clues) rev.clues.forEach(c => Board.collect(c, app));
  if (rev.flag) State.flag(rev.flag, true);
  State.saveProgress();
  if (app.onProgress) app.onProgress();
}

export function openDialogue(app, personId) {
  const p = State.caseData.people[personId];
  if (!p) return;
  if (!State.progress.interviewed.includes(personId)) State.progress.interviewed.push(personId);
  State.progress.dialogue[personId] = State.progress.dialogue[personId] || { revealed: [] };
  State.saveProgress();
  const dstate = State.progress.dialogue[personId];

  const body = el('div', { class: 'modal-pad' });

  const render = () => {
    const lines = el('div', { class: 'dlg-lines' });
    // intro
    lines.append(speaker(p, p.intro));
    // revealed answers in order
    for (const nodeId of dstate.revealed) {
      const node = (p.dialogue || []).find(n => n.id === nodeId);
      if (node) { lines.append(askedBubble(node.topic)); lines.append(speaker(p, node.line)); }
    }

    // available topics
    const opts = el('div', { class: 'dlg-options' });
    let any = false;
    for (const node of (p.dialogue || [])) {
      if (!satisfied(node.requires)) continue;
      if (node.once && dstate.revealed.includes(node.id)) continue;
      if (!node.once && dstate.revealed.includes(node.id)) continue; // ask once each; re-asking adds nothing
      any = true;
      const hot = node.press && diff().contradictionHints;
      opts.append(el('button', {
        class: 'opt' + (hot ? ' sel' : ''),
        onclick: () => {
          if (!dstate.revealed.includes(node.id)) dstate.revealed.push(node.id);
          applyReveals(node.reveals, app);
          State.saveProgress();
          render();
        },
      }, el('h4', { text: (node.press ? '⚡ ' : '') + node.topic })));
    }
    if (!any) opts.append(el('p', { class: 'muted', text: 'Nothing more to ask right now. New evidence may open new questions.' }));

    mount(body,
      el('div', { class: 'row mb', style: { justifyContent: 'space-between' } },
        el('div', { class: 'person-row' }, Media.portrait(personId, { size: 56 }),
          el('div', {}, el('div', { class: 'card-title', text: p.name }), el('div', { class: 'card-sub', text: p.role || '' }))),
        el('button', { class: 'btn btn-ghost btn-sm', text: 'Done', onclick: () => app.closeModal() })),
      lines,
      el('div', { class: 'label mt', text: 'Ask about' }),
      opts);
  };

  render();
  app.modal(body);
}

function speaker(p, text) {
  return el('div', { class: 'speaker' },
    Media.portrait(p.id, { size: 40 }),
    el('div', {}, el('div', { class: 'who', text: p.name }), el('div', { class: 'bubble', html: text })));
}
function askedBubble(text) {
  return el('div', { class: 'speaker', style: { flexDirection: 'row-reverse' } },
    el('div', {}, el('div', { class: 'who', text: 'You' }), el('div', { class: 'bubble me', text: '“' + text + '”' })));
}
