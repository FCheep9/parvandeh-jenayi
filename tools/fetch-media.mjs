// Build-time media fetcher: pulls topical, license-tagged, *verified-reachable* photos from
// the keyless Openverse API and bakes them into a case media.json (with attribution).
// People portraits use randomuser.me (stable seeded URLs). Anything that can't be fetched is
// left null and the runtime falls back to a styled placeholder — so the game never breaks.
//
// Run: node tools/fetch-media.mjs

import { writeFileSync, mkdirSync } from 'node:fs';

const OV = 'https://api.openverse.org/v1/images/';
const LICENSES = 'cc0,pdm,by,by-sa';

// ---- People (pixel-art portraits via DiceBear; deterministic, keyless, dark bg to stay in-tone)
const DB = (seed) => `https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}&backgroundColor=141a22,1f2733&radius=6`;
const people = {
  della:  { portrait: DB('della-voss-71') },
  theo:   { portrait: DB('theo-marsh-eng') },
  priya:  { portrait: DB('priya-anand-agent') },
  gareth: { portrait: DB('gareth-vale-pub') },
  junie:  { portrait: DB('junie-okafor-narrator') },
  mara:   { portrait: DB('mara-quinn-di') },
};

// ---- Photo slots to fetch from Openverse ----------------------------------------------
const slots = [
  { id: 'loc-saltwire-ext',  q: 'brick row house facade' },
  { id: 'loc-booth',         q: 'recording studio microphone booth' },
  { id: 'loc-control-room',  q: 'audio mixing console studio' },
  { id: 'loc-storage',       q: 'self storage units corridor' },
  { id: 'ev-me-note',        q: 'clipboard document notes' },
  { id: 'ev-insulin-pen',    q: 'insulin pen' },
  { id: 'ev-cgm',            q: 'glucose monitor sensor arm' },
  { id: 'ev-contract',       q: 'contract legal documents' },
  { id: 'ev-delivery',       q: 'food delivery paper bag' },
  { id: 'ev-thermos',        q: 'coffee thermos flask' },
  { id: 'ev-harddrives',     q: 'external hard drives' },
  { id: 'ev-field-recorder', q: 'handheld audio recorder' },
  { id: 'ev-invoice',        q: 'invoice document' },
  { id: 'ev-document',       q: 'medical report paper' },
];

function timeout(ms) { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return { signal: c.signal, done: () => clearTimeout(t) }; }

async function reachable(url) {
  if (!url) return false;
  const t = timeout(9000);
  try {
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1024' }, signal: t.signal, redirect: 'follow' });
    return res.ok || res.status === 206;
  } catch { return false; } finally { t.done(); }
}

async function fetchSlot(slot) {
  const t = timeout(12000);
  let results = [];
  try {
    const res = await fetch(`${OV}?q=${encodeURIComponent(slot.q)}&page_size=12&license=${LICENSES}&mature=false`, { headers: { Accept: 'application/json' }, signal: t.signal });
    if (res.ok) { const data = await res.json(); results = data.results || []; }
  } catch { /* ignore, fall through */ } finally { t.done(); }

  for (const r of results) {
    // prefer the Openverse thumbnail service (resized ~600px, reliable), then raw url
    const candidates = [
      `https://api.openverse.org/v1/images/${r.id}/thumb/`,
      r.thumbnail,
      r.url,
    ].filter(Boolean);
    for (const url of candidates) {
      if (await reachable(url)) {
        return {
          id: slot.id,
          url,
          credit: {
            title: r.title || slot.q,
            creator: r.creator || 'Unknown',
            license: `${(r.license || '').toUpperCase()} ${r.license_version || ''}`.trim(),
            license_url: r.license_url || '',
            source: r.source || r.provider || 'openverse',
            landing: r.foreign_landing_url || '',
          },
        };
      }
    }
  }
  console.warn(`  ! no reachable image for "${slot.id}" (${slot.q}) — will use placeholder`);
  return { id: slot.id, url: null, credit: null };
}

(async () => {
  console.log('Fetching media from Openverse (keyless)…');
  const out = { people, slots: {} };
  for (const slot of slots) {
    const r = await fetchSlot(slot);
    out.slots[slot.id] = { url: r.url, credit: r.credit };
    console.log(`  ${r.url ? 'OK ' : '–– '} ${slot.id}`);
  }
  const dir = 'data/cases/the-last-clean-take';
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/media.json`, JSON.stringify(out, null, 2));
  const hits = Object.values(out.slots).filter(s => s.url).length;
  console.log(`\nWrote ${dir}/media.json — ${hits}/${slots.length} photo slots resolved, ${Object.keys(people).length} portraits.`);
})();
