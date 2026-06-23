// Asymmetric 2-player: both explore freely; only the LEAD commits binding decisions.
// In solo, the Partner is an AI advisor (notebook hints, difficulty-scaled).

import { State } from '../state.js';
import { el } from '../util/dom.js';

export const TwoP = {
  isTwoPlayer() { return State.profile?.mode === '2p'; },
  activeRole() { return State.profile?.activeRole || 'lead'; },
  canCommit() { return !this.isTwoPlayer() || this.activeRole() === 'lead'; },
  leadName() { return State.profile?.lead?.name || State.profile?.detective?.name || 'Lead'; },
  partnerName() { return State.profile?.partner?.name || 'Partner'; },

  setRole(role) { State.profile.activeRole = role; State.saveProfile(); },

  addPartnerNote(text) {
    const t = (text || '').trim();
    if (!t) return;
    State.progress.notebook.push({ by: this.isTwoPlayer() ? 'partner' : 'you', text: t });
    State.saveProgress();
  },

  /** Add an advisor hint once (deduped by text). */
  advise(text) {
    if (!text) return;
    if (State.progress.notebook.some(n => n.text === text)) return;
    State.progress.notebook.push({ by: 'advisor', text });
    State.saveProgress();
  },

  /** Header role chips with a switch / pass-the-device. */
  roleChips(app) {
    if (!this.isTwoPlayer()) return null;
    const make = (role, name) => el('button', {
      class: 'role-chip' + (this.activeRole() === role ? ' active' : ''),
      text: `${role === 'lead' ? '★ Lead' : '✎ Partner'}: ${name}`,
      onclick: () => this.handoff(app, role),
    });
    return el('div', { class: 'row', style: { gap: '.4rem' } },
      make('lead', this.leadName()), make('partner', this.partnerName()));
  },

  /** Full-screen "pass the device" splash, then switch role + rerender. */
  handoff(app, toRole) {
    if (this.activeRole() === toRole) return;
    const name = toRole === 'lead' ? this.leadName() : this.partnerName();
    const splash = el('div', { class: 'handoff grain' },
      el('div', { class: 'kicker', text: 'Pass the device' }),
      el('h2', { text: `Hand to ${name}` }),
      el('p', { class: 'muted', text: toRole === 'lead'
        ? 'The Lead Detective makes the binding calls.'
        : 'The Partner explores and advises — but cannot commit decisions.' }),
      el('button', { class: 'btn btn-primary mt', text: `I'm ${name} — continue`,
        onclick: () => { this.setRole(toRole); splash.remove(); app.rerender(); } }));
    document.body.append(splash);
  },

  /** Prompt shown in place of a Lead-only commit when the Partner is active. */
  passToLeadPrompt(app) {
    return el('div', { class: 'callout' },
      el('span', { class: 'label', text: 'Lead decision' }),
      el('div', { text: `Only ${this.leadName()} (Lead Detective) can make this call. ${this.partnerName()}, log your advice in the Notebook, then pass the device.` }),
      el('button', { class: 'btn mt', text: `Pass to ${this.leadName()}`, onclick: () => this.handoff(app, 'lead') }));
  },
};
