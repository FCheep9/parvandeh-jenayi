// Central state store + localStorage persistence. No DOM here.

const PROFILE_KEY = 'pj:profile:v1';
const SAVE_PREFIX = 'pj:save:v1:';

function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

export const State = {
  profile: null,        // { theme, detective:{name,portrait,specialty}, tone, difficulty, mode, lead, partner, activeRole }
  caseId: null,
  caseData: null,       // { meta, acts, evidence, people, locations, clues, media }
  progress: null,       // see freshProgress()

  loadProfile() { this.profile = read(PROFILE_KEY); return this.profile; },
  saveProfile() { write(PROFILE_KEY, this.profile); },
  setProfile(p) { this.profile = p; this.saveProfile(); },

  hasSave(caseId) { return !!read(SAVE_PREFIX + caseId); },
  loadProgress(caseId) { this.progress = read(SAVE_PREFIX + caseId); return this.progress; },
  saveProgress() { if (this.caseId && this.progress) write(SAVE_PREFIX + this.caseId, this.progress); },
  resetProgress(caseId) { try { localStorage.removeItem(SAVE_PREFIX + (caseId || this.caseId)); } catch {} },

  freshProgress() {
    return {
      phase: 'cinematic',        // 'cinematic' | 'play' | 'prologue-end'
      actIndex: 0,
      beatIndex: 0,
      visited: [],               // beat ids already shown (so unlocks apply once)
      unlocked: { evidence: [], people: [], locations: [], clues: [] },
      examined: { evidence: [], hotspots: [] },   // examined evidence ids / "loc:hotspot" keys
      interviewed: [],           // person ids interviewed at least once
      dialogue: {},              // personId -> { revealed:[nodeIds] }
      board: { clues: [], conclusions: [], attempts: 0 },  // clue ids collected, conclusions formed
      decisions: {},             // decisionId -> choiceId
      flags: {},
      notebook: [],              // { by:'partner'|'advisor', text }
      tabsSeen: [],
    };
  },

  // ---- small helpers over progress ----
  has(bucket, id) { return this.progress?.unlocked?.[bucket]?.includes(id); },
  unlock(bucket, ids) {
    if (!ids) return;
    const arr = Array.isArray(ids) ? ids : [ids];
    const set = this.progress.unlocked[bucket];
    for (const id of arr) if (id && !set.includes(id)) set.push(id);
  },
  mark(listName, id) { const a = this.progress[listName]; if (a && !a.includes(id)) a.push(id); },
  flag(name, val) { if (val === undefined) return this.progress.flags[name]; this.progress.flags[name] = val; },
};
