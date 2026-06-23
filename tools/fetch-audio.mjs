// Build-time ambient-audio fetcher: pulls subtle, soft, loopable CC tracks from the keyless
// Openverse audio API and bakes verified-reachable URLs into data/sounds.json (with credit).
// Run: node tools/fetch-audio.mjs

import { writeFileSync } from 'node:fs';

const OV = 'https://api.openverse.org/v1/audio/';
const LICENSES = 'cc0,pdm,by';

// one ambient bed per "vibe"
const slots = [
  { id: 'amb-menu',    q: 'dark ambient drone' },
  { id: 'amb-booth',   q: 'quiet room tone hum' },
  { id: 'amb-rain',    q: 'gentle rain ambient' },
  { id: 'amb-control', q: 'ambient electronic hum' },
  { id: 'amb-tension', q: 'suspense dark ambient' },
];

function timeout(ms) { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return { signal: c.signal, done: () => clearTimeout(t) }; }

async function reachable(url) {
  if (!url || !/^https?:/.test(url)) return false;
  const t = timeout(12000);
  try {
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-2048' }, signal: t.signal, redirect: 'follow' });
    const ct = res.headers.get('content-type') || '';
    return (res.ok || res.status === 206) && /audio|mpeg|ogg|octet-stream/i.test(ct);
  } catch { return false; } finally { t.done(); }
}

async function fetchSlot(slot) {
  const t = timeout(14000);
  let results = [];
  try {
    const res = await fetch(`${OV}?q=${encodeURIComponent(slot.q)}&page_size=20&license=${LICENSES}`, { headers: { Accept: 'application/json' }, signal: t.signal });
    if (res.ok) results = (await res.json()).results || [];
  } catch {} finally { t.done(); }

  // prefer loopable lengths (20s–600s) and mp3
  results.sort((a, b) => score(b) - score(a));
  for (const r of results) {
    const url = r.url;
    if (await reachable(url)) {
      return { url, credit: { title: r.title || slot.q, creator: r.creator || 'Unknown', license: `${(r.license||'').toUpperCase()} ${r.license_version||''}`.trim(), source: r.source || r.provider || 'openverse', landing: r.foreign_landing_url || '' } };
    }
  }
  console.warn(`  ! no reachable audio for ${slot.id} (${slot.q})`);
  return { url: null, credit: null };
}
function score(r) {
  let s = 0; const d = (r.duration || 0) / 1000;
  if (d >= 20 && d <= 600) s += 5; else if (d > 600) s += 1;
  if (/mp3|mpeg/i.test(r.filetype || r.url || '')) s += 2;
  return s;
}

(async () => {
  console.log('Fetching ambient audio from Openverse…');
  const out = { slots: {} };
  for (const slot of slots) {
    const r = await fetchSlot(slot);
    out.slots[slot.id] = r;
    console.log(`  ${r.url ? 'OK ' : '–– '} ${slot.id}`);
  }
  writeFileSync('data/sounds.json', JSON.stringify(out, null, 2));
  const hits = Object.values(out.slots).filter(s => s.url).length;
  console.log(`\nWrote data/sounds.json — ${hits}/${slots.length} ambient beds resolved.`);
})();
