// Visual-pass helper: drive the real game in chromium and screenshot every screen.
// Usage: node tools/shots.mjs <baseURL> <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:8090/';
const OUT = process.argv[3] || '/tmp/claude-0/-root-game1/8cc33388-7f31-4a8a-9a1a-de04f95b5609/scratchpad/shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2, locale: 'fa-IR' });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('  [console.error]', m.text()); });
page.on('pageerror', e => console.log('  [pageerror]', e.message));

let n = 0;
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/${String(++n).padStart(2,'0')}-${name}.png` }); console.log('shot', name); };
const click = async (sel) => { await page.waitForSelector(sel, { timeout: 8000 }); await page.click(sel); await page.waitForTimeout(250); };
const clickIf = async (sel) => { const el = await page.$(sel); if (el) { await el.click(); await page.waitForTimeout(250); } };
const closeModal = async () => { await page.evaluate(() => window.__PJ_APP__.closeModal()); await page.waitForTimeout(180); };

await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(BASE, { waitUntil: 'networkidle' });

// onboarding
await page.waitForSelector('[data-mode]');
await shot('onboarding');
await click('[data-mode="2p"]'); await shot('onboarding-2p');
await click('[data-mode="solo"]');
await click('[data-action="begin"]');           // -> intro
await shot('intro');
await click('.btn-primary');                      // intro Begin -> cinematic
await page.waitForSelector('.cine'); await shot('cinematic');
// advance cinematic by clicking until hub appears
for (let i = 0; i < 8; i++) { await page.click('.cine').catch(()=>{}); await page.waitForTimeout(400); if (await page.$('.hub')) break; }
await page.waitForSelector('.hub'); await shot('hub-story');

// B1: location modal
await click('[data-tab="locations"]'); await shot('tab-locations');
await click('[data-loc="loc-booth"]');
await page.waitForSelector('.modal'); await shot('modal-location');
await click('[data-hotspot="chair"]'); await shot('modal-location-hotspot');
await closeModal();                 // close
await click('[data-tab="story"]'); await click('.beat .btn-primary');  // continue -> b2

// B2: dialogue
await click('[data-tab="people"]'); await shot('tab-people');
await click('[data-person="junie"]'); await page.waitForSelector('.modal'); await shot('modal-dialogue');
await clickIf('[data-node="j2"]'); await shot('modal-dialogue-answer');
await closeModal();
await click('[data-tab="story"]'); await click('.beat .btn-primary');  // -> b3

// B3: evidence
await click('[data-tab="evidence"]'); await shot('tab-evidence');
await click('[data-ev="ev-me-note"]'); await page.waitForSelector('.modal'); await shot('modal-evidence');
await clickIf('[data-action="add-clue"]');
await closeModal();
await click('[data-tab="story"]'); await click('.beat .btn-primary');  // -> b4

// B4: waveform
await click('[data-tab="evidence"]');
await click('[data-ev="ev-waveform"]');
await page.waitForSelector('.modal'); await clickIf('[data-action="open-waveform"]');
await page.waitForTimeout(500); await shot('modal-waveform');
await clickIf('[data-action="flag-clip"]'); await page.waitForTimeout(200);
await closeModal();
await click('[data-tab="story"]'); await click('.beat .btn-primary');  // -> b5

// B5: interview theo (آرمان) then continue
await click('[data-tab="people"]');
await click('[data-person="theo"]'); await page.waitForTimeout(150); await closeModal();
await click('[data-tab="story"]'); await clickIf('.beat .btn-primary');  // -> b6

// B6: board
await click('[data-tab="board"]'); await shot('tab-board');
await clickIf('[data-clue="body-posed"]'); await clickIf('[data-clue="pmi-wrong"]'); await clickIf('[data-action="connect"]');
await shot('tab-board-deduction');
await click('[data-tab="story"]'); await clickIf('.beat .btn-primary');  // -> b7

// B7: decision
await page.waitForSelector('[data-choice]'); await shot('beat-decision');
await click('[data-choice="hold"]'); await shot('prologue-end');

// menu (desktop too)
await clickIf('.beat .btn:has-text("پرونده‌های دیگر")');
await page.waitForTimeout(300); await shot('menu');

// desktop wide shots
const wide = await browser.newContext({ viewport: { width: 1200, height: 820 }, deviceScaleFactor: 1, locale: 'fa-IR' });
const wp = await wide.newPage();
await wp.addInitScript(() => { try { localStorage.clear(); } catch {} });
await wp.goto(BASE, { waitUntil: 'networkidle' });
await wp.waitForSelector('[data-mode]'); await wp.screenshot({ path: `${OUT}/W1-onboarding.png` });
await wp.click('[data-action="begin"]'); await wp.waitForTimeout(400); await wp.screenshot({ path: `${OUT}/W2-intro.png` });

await browser.close();
console.log('DONE, shots in', OUT);
