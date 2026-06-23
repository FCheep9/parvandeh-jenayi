// Story engine: drives Acts → beats, tutorial gates, Lead-only decisions, and the
// end-of-prologue screen. Beat schema is documented in docs/DATA-SCHEMA.md.

import { State } from '../state.js';
import { el, mount, paragraphs } from '../util/dom.js';
import { Media } from './media.js';
import { Board } from './board.js';
import { TwoP } from './twoplayer.js';
import { diff } from './difficulty.js';

function curAct() { return State.caseData?.acts?.[State.progress.actIndex]; }
function curBeat() { const a = curAct(); return a && a.beats[State.progress.beatIndex]; }

function applyBeat(beat, app) {
  if (State.progress.visited.includes(beat.id)) return;
  State.progress.visited.push(beat.id);
  if (beat.unlock) for (const [b, ids] of Object.entries(beat.unlock)) State.unlock(b, ids);
  if (beat.collect) beat.collect.forEach(c => Board.collect(c, app));
  if (beat.advise) {
    beat.advise.forEach(t => TwoP.advise(t));
    if (diff().proactiveHints && beat.advise[0]) app.toast('Partner: ' + beat.advise[0]);
  }
  State.saveProgress();
}

function gate(beat) {
  const req = beat.require;
  if (!req) return { ok: true };
  if (diff().softRequire) return { ok: true };
  const P = State.progress;
  switch (req.type) {
    case 'open-tab': return { ok: P.tabsSeen.includes(req.target), hint: `Open the ${req.target[0].toUpperCase() + req.target.slice(1)} tab to continue.` };
    case 'examine-evidence':
      if (req.target) return { ok: P.examined.evidence.includes(req.target), hint: 'Examine the new evidence, then return here.' };
      return { ok: P.examined.evidence.length >= (req.n || 1), hint: `Examine ${req.n || 1} piece(s) of evidence.` };
    case 'interview': return { ok: P.interviewed.includes(req.target), hint: 'Interview the person in the People tab, then return.' };
    case 'search':
      if (req.target) return { ok: P.examined.hotspots.includes(req.target), hint: 'Search the location for clues.' };
      return { ok: P.examined.hotspots.length >= (req.n || 1), hint: `Search ${req.n || 1} spot(s) in a location.` };
    case 'collect-clue': return { ok: Board.collected().includes(req.target), hint: 'Add the relevant clue to your board.' };
    case 'conclusion': return { ok: Board.hasConclusion(req.target), hint: 'Connect clues on the Deduction board to form the needed deduction.' };
    default: return { ok: true };
  }
}

function advance(app, goto) {
  const P = State.progress, act = curAct();
  if (goto) {
    const idx = act.beats.findIndex(b => b.id === goto);
    if (idx >= 0) { P.beatIndex = idx; State.saveProgress(); app.showStory(); return; }
  }
  P.beatIndex++;
  if (P.beatIndex >= act.beats.length) {
    if (P.actIndex < State.caseData.acts.length - 1) { P.actIndex++; P.beatIndex = 0; }
    else { P.phase = 'prologue-end'; }
  }
  State.saveProgress();
  app.showStory();
}

export const Story = {
  render(app, container) {
    if (State.progress.phase === 'prologue-end') return this.renderEnd(app, container);
    const beat = curBeat();
    if (!beat) { mount(container, el('div', { class: 'empty', text: 'Story complete.' })); return; }
    applyBeat(beat, app);

    const node = el('div', { class: 'beat' });
    if (beat.act_label) node.append(el('div', { class: 'kicker mb', text: beat.act_label }));
    if (beat.image) node.append(Media.img(beat.image, { alt: beat.title || '', glyph: '🎬', cls: 'beat-img' }), el('div', { style: { height: '1rem' } }));
    if (beat.title) node.append(el('h2', { text: beat.title, style: { marginTop: 0 } }));

    if (beat.speaker) {
      const p = State.caseData.people[beat.speaker];
      if (p) node.append(el('div', { class: 'speaker mb' }, Media.portrait(p.id, { size: 44 }),
        el('div', {}, el('div', { class: 'who', text: p.name }), el('div', { class: 'bubble', html: Array.isArray(beat.body) ? beat.body.join(' ') : beat.body }))));
    } else if (beat.body) {
      node.append(el('div', { class: 'beat-body' }, ...paragraphs(beat.body, 'lead')));
    }

    if (beat.callout) node.append(el('div', { class: 'callout' }, el('span', { class: 'label', text: 'How to play' }), el('div', { html: beat.callout })));

    // choices (decision) or continue
    if (beat.choices) {
      if (beat.lead_only && !TwoP.canCommit()) {
        node.append(TwoP.passToLeadPrompt(app));
      } else {
        if (beat.lead_only) node.append(el('div', { class: 'label mb', text: '★ Lead Detective decides' }));
        const opts = el('div', { class: 'dlg-options mt' });
        for (const ch of beat.choices) {
          opts.append(el('button', { class: 'opt', onclick: () => {
            State.progress.decisions[beat.id] = ch.id;
            if (ch.setFlag) State.flag(ch.setFlag, ch.flagValue === undefined ? true : ch.flagValue);
            if (ch.unlock) for (const [b, ids] of Object.entries(ch.unlock)) State.unlock(b, ids);
            if (ch.advise) ch.advise.forEach(t => TwoP.advise(t));
            State.saveProgress();
            advance(app, ch.goto);
          } }, el('h4', { text: ch.label }), ch.detail ? el('p', { text: ch.detail }) : null));
        }
        node.append(opts);
      }
    } else {
      const g = gate(beat);
      const btn = el('button', { class: 'btn btn-primary mt', text: beat.continueLabel || 'Continue ▸', disabled: !g.ok, onclick: () => advance(app, beat.goto) });
      node.append(btn);
      if (!g.ok) node.append(el('div', { class: 'gate-hint mt', text: g.hint }));
    }

    mount(container, node);
  },

  renderEnd(app, container) {
    const meta = State.caseData.meta;
    const node = el('div', { class: 'beat tcenter' },
      el('div', { class: 'kicker', text: 'End of Act 1 — Prologue' }),
      el('h2', { text: 'The room that doesn’t exist' }),
      el('div', { class: 'beat-body', style: { textAlign: 'left' } },
        ...paragraphs(
          'The tox screen comes back clean. The medical examiner wants a full post-mortem — the readings are stranger than a stopped heart.\n\n' +
          'And the voice on the studio monitors, the one the mourners are weeping to: you’ve heard it your whole recovery, and tonight it is *wrong*. Too even. Breaths like a metronome. A room-tone hum that belongs to a booth that was torn out and rewired weeks ago.\n\n' +
          'If those recordings were made in a room that no longer exists… then Della Voss did not die last night. The question was never *who killed her*. It’s *when she actually died* — and who has been wearing her voice ever since.',
          'lead')),
      el('div', { class: 'callout', style: { textAlign: 'left' } },
        el('span', { class: 'label', text: 'This prologue is the first chapter' }),
        el('div', { html: 'You’ve learned every tool you’ll need: <b>Evidence</b>, <b>People</b>, <b>Locations</b>, the <b>Deduction board</b>, the <b>audio forensics</b> viewer, and the <b>Lead/Partner</b> split. Acts 2–4 — the storage unit, the frozen truth, the talkback recording, and the final accusation — are in production.' })),
      el('div', { class: 'row mt2', style: { justifyContent: 'center', flexWrap: 'wrap' } },
        el('button', { class: 'btn btn-primary', text: '↻ Replay prologue', onclick: () => { State.resetProgress(); State.progress = State.freshProgress(); State.saveProgress(); app.go('play'); } }),
        el('button', { class: 'btn', text: 'Change detective / theme', onclick: () => app.go('onboarding') }),
        el('button', { class: 'btn', text: 'Other cases', onclick: () => app.go('menu') }),
        el('button', { class: 'btn btn-ghost', text: 'Credits', onclick: () => app.openCredits() })));
    mount(container, node);
  },
};
