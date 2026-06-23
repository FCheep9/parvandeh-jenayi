// Audio manager: soft looping ambient beds per "place" (HTMLAudio, sourced from data/sounds.json)
// + a procedural "vox" gibberish voice for playing recordings. Both have mute toggles (persisted).
// All playback waits for a user gesture (browser autoplay policy).

import { el } from './dom.js';

const MUSIC_KEY = 'pj:mute:music:v1';
const VOX_KEY = 'pj:mute:vox:v1';
const AMB_VOL = 0.22;
const VOX_VOL = 0.16;

let sources = {};            // slotId -> { url, credit }
let ambEl = null;            // current ambient element
let curSlot = null;
let pendingSlot = null;
let unlocked = false;
let musicMuted = false;
let voxMuted = false;
let ac = null;               // shared AudioContext for vox
let voxGain = null;
let ctlEl = null;

function ctx() {
  if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ac = new AC(); }
  if (ac && ac.state === 'suspended') ac.resume();
  return ac;
}

export const Sound = {
  setSources(json) { sources = (json && json.slots) || {}; },

  init() {
    try { musicMuted = localStorage.getItem(MUSIC_KEY) === '1'; voxMuted = localStorage.getItem(VOX_KEY) === '1'; } catch {}
    ambEl = new Audio(); ambEl.loop = true; ambEl.volume = 0;
    const unlock = () => { unlocked = true; if (pendingSlot) this.scene(pendingSlot); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
  },

  /** Crossfade ambient to the bed for a place/screen. */
  scene(slotId) {
    if (slotId === curSlot && ambEl && !ambEl.paused) return;
    const src = sources[slotId];
    if (!src || !src.url) return;
    if (musicMuted) { pendingSlot = slotId; return; }
    if (!unlocked) { pendingSlot = slotId; return; }
    curSlot = slotId; pendingSlot = null;
    fadeTo(ambEl, 0, 220, () => {
      try {
        ambEl.src = src.url;
        const p = ambEl.play();
        if (p && p.catch) p.catch(() => { pendingSlot = slotId; unlocked = false; });
        fadeTo(ambEl, AMB_VOL, 600);
      } catch { pendingSlot = slotId; unlocked = false; }
    });
  },

  toggleMusic() {
    musicMuted = !musicMuted;
    try { localStorage.setItem(MUSIC_KEY, musicMuted ? '1' : '0'); } catch {}
    if (musicMuted) { fadeTo(ambEl, 0, 300, () => ambEl.pause()); }
    else if (pendingSlot || curSlot) { const s = curSlot || pendingSlot; curSlot = null; this.scene(s); }
    this._renderCtl();
  },
  toggleVox() { voxMuted = !voxMuted; try { localStorage.setItem(VOX_KEY, voxMuted ? '1' : '0'); } catch {} if (voxMuted) this.stopVox(); this._renderCtl(); },
  isVoxMuted() { return voxMuted; },

  /** Procedural "someone is talking" gibberish whose length/rhythm tracks the given text. */
  playVox(text) {
    if (voxMuted) return;
    const c = ctx(); if (!c) return;
    this.stopVox();
    const out = c.createGain(); out.gain.value = VOX_VOL; out.connect(c.destination); voxGain = out;
    const clean = String(text || '').replace(/<[^>]+>/g, '');
    const syll = Math.max(6, Math.min(70, Math.round(clean.length / 2.2)));
    let t = c.currentTime + 0.05;
    const base = 115 + Math.random() * 30;
    for (let i = 0; i < syll; i++) {
      const dur = 0.10 + Math.random() * 0.06;
      const decl = 1 - (i / syll) * 0.22;
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = base * decl * (0.9 + Math.random() * 0.2);
      const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 350 + Math.random() * 550; f1.Q.value = 6;
      const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1100 + Math.random() * 1000; f2.Q.value = 9;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(f1); f1.connect(f2); f2.connect(g); g.connect(out);
      o.start(t); o.stop(t + dur + 0.03);
      const word = Math.random() < 0.18;
      t += dur + (word ? 0.12 + Math.random() * 0.08 : 0.02 + Math.random() * 0.04);
    }
  },
  stopVox() {
    if (voxGain) { try { const g = voxGain; g.gain.cancelScheduledValues(ctx().currentTime); g.gain.setTargetAtTime(0, ctx().currentTime, 0.05); setTimeout(() => { try { g.disconnect(); } catch {} }, 300); } catch {} voxGain = null; }
  },

  /** Floating music/voice toggles (fixed corner). */
  mountControl() {
    if (ctlEl) return;
    ctlEl = el('div', { class: 'audio-ctl' });
    document.body.append(ctlEl);
    this._renderCtl();
  },
  _renderCtl() {
    if (!ctlEl) return;
    ctlEl.replaceChildren(
      el('button', { class: 'audio-btn' + (musicMuted ? ' off' : ''), title: musicMuted ? 'موسیقی خاموش' : 'موسیقی روشن', 'aria-label': 'موسیقی پس‌زمینه', text: musicMuted ? '🔇' : '🎵', onclick: () => this.toggleMusic() }),
      el('button', { class: 'audio-btn' + (voxMuted ? ' off' : ''), title: voxMuted ? 'صدای گفتار خاموش' : 'صدای گفتار روشن', 'aria-label': 'صدای گفتار ضبط‌ها', text: voxMuted ? '🤫' : '🗣', onclick: () => this.toggleVox() }));
  },
};

function fadeTo(elm, target, ms, done) {
  if (!elm) { done && done(); return; }
  const start = elm.volume, steps = Math.max(1, Math.round(ms / 40)); let i = 0;
  const iv = setInterval(() => {
    i++; elm.volume = Math.max(0, Math.min(1, start + (target - start) * (i / steps)));
    if (i >= steps) { clearInterval(iv); done && done(); }
  }, 40);
}
