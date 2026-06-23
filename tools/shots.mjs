// Visual pass for the new UX: travel map + objective bar, full-screen scene with pinned
// hotspots + present people, accusation, and ending. Seeds saves to reach each state.
// Usage: node tools/shots.mjs <baseURL> <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:8090/';
const OUT = process.argv[3] || '/tmp/claude-0/-root-game1/8cc33388-7f31-4a8a-9a1a-de04f95b5609/scratchpad/shots2';
mkdirSync(OUT, { recursive: true });

const ALL_CLUES = ['body-posed','pmi-wrong','breaths-wrong','insulin-dose','rights-rider','old-room-tone','renovated','ice-crystal','cgm-curve','storage-unit','freezer-prints','toll-priya','voice-model-logs','talkback','gareth-knew'];
const PROFILE = { theme:'noir', detective:{name:'مهتاب کیانی', portrait:'https://api.dicebear.com/9.x/pixel-art/svg?seed=mara-quinn-di', specialty:'forensics'}, tone:'balanced', difficulty:'detective', mode:'solo', lead:{name:'مهتاب کیانی'}, partner:{name:'سام'}, activeRole:'lead' };
const base = (actIndex, beatIndex) => ({ phase:'play', actIndex, beatIndex, visited:[], unlocked:{ evidence:['ev-me-note','ev-waveform','ev-insulin-pen','ev-contract','ev-roomtone','ev-renovation','ev-autopsy','ev-phone','ev-cgm','ev-storage','ev-freezer','ev-toll','ev-voicemodel','ev-talkback','ev-emails'], people:['junie','theo','priya','gareth'], locations:['loc-saltwire-ext','loc-booth','loc-control-room','loc-storage','loc-office'], clues:[] }, examined:{evidence:[],hotspots:[]}, interviewed:[], dialogue:{}, board:{ clues:ALL_CLUES.slice(), conclusions:['staged-quiet','room-impossible','accidental-death','theo-architect','priya-staged'], attempts:0 }, decisions:{}, flags:{heldScene:true,heldRoom:true}, notebook:[] , tabsSeen:[] });

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-gpu'] });
let n = 0;

async function newSeeded(save) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2, locale: 'fa-IR' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  [pageerror]', e.message));
  await page.addInitScript(([prof, sv]) => { localStorage.setItem('pj:profile:v1', JSON.stringify(prof)); localStorage.setItem('pj:save:v1:the-last-clean-take', JSON.stringify(sv)); }, [PROFILE, save]);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__PJ_APP__.go('play'));
  await page.waitForTimeout(400);
  return page;
}
const shot = async (page, name) => { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${String(++n).padStart(2,'0')}-${name}.png` }); console.log('shot', name); };

// exploration state (Act 3): all locations open
let page = await newSeeded(base(2, 2));
await page.click('[data-tab="locations"]'); await shot(page, 'travel-map');
await page.click('[data-loc="loc-control-room"]'); await page.waitForSelector('.scene'); await shot(page, 'scene-view');
await page.click('.scene [data-hotspot="drives"]'); await shot(page, 'scene-hotspot');
await page.click('.scene-topbar .btn-ghost').catch(()=>{});
await page.click('[data-tab="board"]'); await shot(page, 'board');

// accusation + ending
const p2 = await newSeeded(base(3, 1));
await p2.waitForSelector('[data-q]', { timeout: 8000 });
await shot(p2, 'accusation');
for (const [q, o] of [['what','accident'],['fraud','theo'],['stage','priya'],['gareth','moral']]) { await p2.click(`[data-q="${q}"] [data-opt="${o}"]`); await p2.waitForTimeout(120); }
await shot(p2, 'accusation-filled');
await p2.click('.beat .btn-primary'); await p2.waitForTimeout(500);
await shot(p2, 'ending');

await browser.close();
console.log('DONE', OUT);
