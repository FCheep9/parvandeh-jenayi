// Headless full-game test: boots in jsdom and plays the WHOLE case (Acts 1–4 + accusation +
// ending) on Detective difficulty via real DOM interactions, proving every gate is reachable.
// Run: node tests/smoke.mjs

import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
let failures = 0;
const ok = (c, m) => { if (c) console.log('  ✓ ' + m); else { console.log('  ✗ ' + m); failures++; } };

const dom = new JSDOM('<!DOCTYPE html><html data-theme="noir" dir="rtl"><body><div id="app"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
Object.assign(global, { window, document: window.document, navigator: window.navigator, localStorage: window.localStorage, HTMLElement: window.HTMLElement, Node: window.Node });
global.getComputedStyle = window.getComputedStyle.bind(window);
global.requestAnimationFrame = (fn) => setTimeout(() => fn(16), 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
window.devicePixelRatio = 1;
window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

global.fetch = async (url) => {
  try { const txt = readFileSync(resolve(ROOT, url), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(txt), text: async () => txt }; }
  catch (e) { return { ok: false, status: 404, json: async () => { throw e; } }; }
};

localStorage.setItem('pj:profile:v1', JSON.stringify({
  theme: 'noir', detective: { name: 'مهتاب کیانی', portrait: 'x', specialty: 'forensics' },
  tone: 'balanced', difficulty: 'detective', mode: 'solo', lead: { name: 'مهتاب کیانی' }, partner: { name: 'سام' }, activeRole: 'lead',
}));

const { State } = await import('../js/state.js');
const { Board } = await import('../js/engine/board.js');
const { Investigation } = await import('../js/engine/investigation.js');
const { renderHub } = await import('../js/screens/casehub.js');
const { renderOnboarding } = await import('../js/screens/onboarding.js');
await import('../js/main.js');

for (let i = 0; i < 40 && !(window.__PJ_APP__ && window.__PJ_APP__.config); i++) await sleep(25);
const app = window.__PJ_APP__;
ok(!!app && !!app.config, 'app booted');
const root = document.getElementById('app');

try { renderOnboarding(app, root); ok(!!document.querySelector('[data-mode]'), 'setup screen renders'); } catch (e) { ok(false, 'onboarding threw: ' + e.message); }

await app.go('play');
State.progress.phase = 'play';
renderHub(app, root);
ok(beatId() === 'b1-arrival', 'starts at b1 (got ' + beatId() + ')');

// ---------- ACT 1 ----------
step('A1', () => {
  searchHotspot('loc-booth', 'chair'); ok(Board.collected().includes('body-posed'), 'body-posed from scene'); cont();
  interview('junie'); cont(); ok(beatId() === 'b3-first-evidence', 'b3');
  addClue('ev-me-note'); cont();
  flagWave(); ok(Board.collected().includes('breaths-wrong'), 'breaths-wrong'); cont();
  interview('theo'); cont(); ok(beatId() === 'b6-the-board', 'b6');
  form('body-posed', 'pmi-wrong', 'staged-quiet'); cont();
  decide('hold');
});
ok(beatId() === 'a2-1', 'entered Act 2 (got ' + beatId() + ')');

// ---------- ACT 2 ----------
step('A2', () => {
  addClue('ev-roomtone'); addClue('ev-renovation'); addClue('ev-autopsy'); cont();   // a2-1 -> a2-2
  cont();                                                                              // a2-2 -> a2-3
  form('old-room-tone', 'renovated', 'room-impossible'); cont();                       // a2-3 -> a2-4
  decide('truth');
});
ok(beatId() === 'a3-1', 'entered Act 3 (got ' + beatId() + ')');

// ---------- ACT 3 ----------
step('A3', () => {
  examine('ev-phone'); addClue('ev-cgm'); addClue('ev-insulin-pen'); addClue('ev-contract');
  ok(Board.collected().includes('cgm-curve'), 'cgm-curve via phone->cgm'); cont();      // a3-1 -> a3-2
  form('cgm-curve', 'insulin-dose', 'accidental-death'); cont();                        // a3-2 -> a3-3
  ['ev-freezer','ev-storage','ev-toll','ev-voicemodel','ev-talkback','ev-emails'].forEach(addClue); cont(); // a3-3 -> a3-4
  cont();                                                                                // a3-4 -> a3-5
  decide('enter');                                                                       // a3-5 -> a3-6
  form('voice-model-logs', 'rights-rider', 'theo-architect'); cont();                    // a3-6 -> act4
});
ok(beatId() === 'a4-1', 'entered Act 4 (got ' + beatId() + ')');

// ---------- ACT 4: accusation ----------
step('A4', () => {
  form('freezer-prints', 'toll-priya', 'priya-staged'); cont();                          // a4-1 -> a4-accuse
  ok(beatId() === 'a4-accuse', 'reached accusation');
  pick('what', 'accident'); pick('fraud', 'theo'); pick('stage', 'priya'); pick('gareth', 'moral');
  clickSel('#app .beat .btn-primary');                                                    // submit
});
ok(State.flag('verdict') === 'true', 'correct accusation -> true verdict');
ok(beatId() === 'prologue-end' || !!document.querySelector('#app .beat'), 'ending screen rendered');
ok(State.hasSave('the-last-clean-take'), 'progress persisted');

console.log(`\n${failures ? '✗ ' + failures + ' FAILURE(S)' : '✓ ALL SMOKE CHECKS PASSED'}`);
process.exit(failures ? 1 : 0);

// ---------- helpers ----------
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function beat() { const P = State.progress; return State.caseData.acts[P.actIndex]?.beats[P.beatIndex]; }
function beatId() { return State.progress.phase === 'prologue-end' ? 'prologue-end' : beat()?.id; }
function clickSel(sel) { const n = document.querySelector(sel); if (!n) throw new Error('no ' + sel + ' (beat ' + beatId() + ')'); n.click(); return n; }
function cont() { app.showStory(); const b = document.querySelector('#app .beat button.btn-primary'); if (!b) throw new Error('no continue @ ' + beatId()); if (b.disabled) throw new Error('continue disabled @ ' + beatId()); b.click(); }
function decide(id) { app.showStory(); clickSel(`#app [data-choice="${id}"]`); }
function interview(id) { app.openDialogue(id); app.closeModal(); }
function addClue(ev) { Investigation.openEvidence(app, State.caseData.evidence[ev]); const b = document.querySelector('#modal-host [data-action="add-clue"]'); if (b) b.click(); app.closeModal(); }
function examine(ev) { Investigation.openEvidence(app, State.caseData.evidence[ev]); app.closeModal(); }
function flagWave() { app.openWaveform(); clickSel('#modal-host [data-action="flag-clip"]'); app.closeModal(); }
function searchHotspot(loc, hs) { Investigation.openLocation(app, State.caseData.locations[loc]); clickSel(`.scene [data-hotspot="${hs}"]`); document.querySelector('.scene')?.remove(); }
function form(a, b, conc) { app.setTab('board'); clickSel(`#app [data-clue="${a}"]`); clickSel(`#app [data-clue="${b}"]`); clickSel('#app [data-action="connect"]'); ok(Board.hasConclusion(conc), 'formed ' + conc); }
function pick(q, opt) { clickSel(`#app [data-q="${q}"] [data-opt="${opt}"]`); }
function step(name, fn) { try { fn(); } catch (e) { ok(false, `${name} threw: ${e.message}`); } }
