// Headless smoke test: boots the app in jsdom with a file-reading fetch, then plays the
// entire Act 1 prologue through real DOM interactions on Detective difficulty, asserting the
// gates work and we reach the end without throwing. Run: node tests/smoke.mjs

import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.log('  ✗ ' + msg); failures++; } };

// ---- jsdom environment ----
const dom = new JSDOM('<!DOCTYPE html><html data-theme="noir"><body><div id="app"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.localStorage = window.localStorage;
global.getComputedStyle = window.getComputedStyle.bind(window);
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;
global.requestAnimationFrame = (fn) => setTimeout(() => fn(16), 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
window.devicePixelRatio = 1;
// canvas stub (jsdom has no 2d context)
window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });

// ---- fetch -> local files ----
global.fetch = async (url) => {
  try {
    const txt = readFileSync(resolve(ROOT, url), 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(txt), text: async () => txt };
  } catch (e) {
    return { ok: false, status: 404, json: async () => { throw e; } };
  }
};

// ---- seed a profile so boot lands on the menu ----
const profile = {
  theme: 'noir',
  detective: { name: 'Mara Quinn', portrait: 'https://randomuser.me/api/portraits/women/44.jpg', specialty: 'forensics' },
  tone: 'balanced', difficulty: 'detective',
  mode: 'solo', lead: { name: 'Mara Quinn' }, partner: { name: 'Sam' }, activeRole: 'lead',
};
localStorage.setItem('pj:profile:v1', JSON.stringify(profile));

// ---- imports (after globals) ----
const { State } = await import('../js/state.js');
const { Board } = await import('../js/engine/board.js');
const { Investigation } = await import('../js/engine/investigation.js');
const { renderHub } = await import('../js/screens/casehub.js');
const { renderOnboarding } = await import('../js/screens/onboarding.js');
await import('../js/main.js'); // runs boot()

// wait for boot
for (let i = 0; i < 40 && !(window.__PJ_APP__ && window.__PJ_APP__.config); i++) await sleep(25);
const app = window.__PJ_APP__;
ok(!!app && !!app.config, 'app booted and config loaded');

const root = document.getElementById('app');

// ---- onboarding renders without throwing ----
try { renderOnboarding(app, root); ok(!!document.querySelector('.wizard'), 'onboarding wizard renders'); }
catch (e) { ok(false, 'onboarding render threw: ' + e.message); }

// ---- start play ----
await app.go('play');
State.progress.phase = 'play';     // skip the timed cinematic in the harness
renderHub(app, root);
ok(beatId() === 'b1-arrival', 'play starts on beat b1-arrival (got ' + beatId() + ')');
ok(continueDisabled(), 'Continue is gated before the requirement is met');

// ---- B1: search the booth chair ----
step('B1 arrival', () => {
  Investigation.openLocation(app, State.caseData.locations['loc-booth']);
  clickByText('#modal-host', '.opt', "reader's chair");
  app.closeModal();
  ok(Board.collected().includes('body-posed'), 'examining the chair collected body-posed');
  app.showStory();
  ok(!continueDisabled(), 'Continue unlocks after searching the chair');
  clickContinue();
});
ok(beatId() === 'b2-the-ear', 'advanced to b2-the-ear');

// ---- B2: interview Junie ----
step('B2 the ear', () => {
  app.openDialogue('junie');
  clickByText('#modal-host', '.opt', 'strange about the new books');
  app.closeModal();
  ok(State.progress.interviewed.includes('junie'), 'Junie interviewed');
  app.showStory(); clickContinue();
});
ok(beatId() === 'b3-first-evidence', 'advanced to b3-first-evidence');

// ---- B3: examine ME note + add to board ----
step('B3 first evidence', () => {
  Investigation.openEvidence(app, State.caseData.evidence['ev-me-note']);
  clickByText('#modal-host', 'button', 'Add to board');
  app.closeModal();
  ok(Board.collected().includes('pmi-wrong'), 'pmi-wrong added to board');
  app.showStory(); clickContinue();
});
ok(beatId() === 'b4-the-audio', 'advanced to b4-the-audio');

// ---- B4: waveform flag ----
step('B4 the audio', () => {
  app.openWaveform();
  clickByText('#modal-host', 'button', 'Flag this clip');
  app.closeModal();
  ok(Board.collected().includes('breaths-wrong'), 'breaths-wrong flagged onto board');
  app.showStory(); clickContinue();
});
ok(beatId() === 'b5-meet-others', 'advanced to b5-meet-others');

// ---- B5: interview Theo ----
step('B5 meet others', () => {
  app.openDialogue('theo'); app.closeModal();
  ok(State.progress.interviewed.includes('theo'), 'Theo interviewed');
  app.showStory(); clickContinue();
});
ok(beatId() === 'b6-the-board', 'advanced to b6-the-board');

// ---- B6: deduction board ----
step('B6 the board', () => {
  app.setTab('board');
  clickByText('#app', '.clue', 'Body posed');
  clickByText('#app', '.clue', "Death doesn't fit");
  clickByText('#app', 'button', 'Connect selected');
  ok(Board.hasConclusion('staged-quiet'), 'formed conclusion staged-quiet');
  app.showStory(); clickContinue();
});
ok(beatId() === 'b7-decision', 'advanced to b7-decision');

// ---- B7: Lead decision ----
step('B7 decision', () => {
  clickByText('#app', '.opt', 'Hold the scene');
});
ok(State.progress.phase === 'prologue-end', 'reached prologue-end after the Lead decision');
ok(State.progress.flags.heldScene === true, 'heldScene flag recorded');

// ---- persistence ----
ok(!!localStorage.getItem('pj:save:v1:the-last-clean-take'), 'progress persisted to localStorage');

console.log(`\n${failures ? '✗ ' + failures + ' FAILURE(S)' : '✓ ALL SMOKE CHECKS PASSED'}`);
process.exit(failures ? 1 : 0);

// ---------- helpers ----------
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function beat() { return State.caseData.acts[State.progress.actIndex].beats[State.progress.beatIndex]; }
function beatId() { return State.progress.phase === 'prologue-end' ? 'prologue-end' : beat()?.id; }
function continueDisabled() { const b = document.querySelector('#app .beat button.btn-primary'); return !b || b.disabled; }
function clickContinue() { const b = document.querySelector('#app .beat button.btn-primary'); if (!b) throw new Error('no Continue button'); if (b.disabled) throw new Error('Continue is disabled'); b.click(); }
function clickByText(scope, sel, text) {
  const nodes = [...document.querySelectorAll(`${scope} ${sel}`)];
  const n = nodes.find(x => (x.textContent || '').toLowerCase().includes(text.toLowerCase()));
  if (!n) throw new Error(`no ${sel} matching "${text}" in ${scope}`);
  n.click();
  return n;
}
function step(name, fn) { try { fn(); } catch (e) { ok(false, `${name} threw: ${e.message}`); } }
