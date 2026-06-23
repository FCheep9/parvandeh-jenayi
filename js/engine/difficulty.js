// Difficulty rules. Hints never invent facts — they only surface clues already discoverable.

import { State } from '../state.js';

const TIERS = {
  casual: {
    autoLinkHints: true,       // glow linkable clue pairs on the board
    autoAnnotate: true,        // waveform viewer flags anomalies automatically
    proactiveHints: true,      // advisor pushes hints without being asked
    softRequire: true,         // story "Continue" never hard-blocks
    contradictionHints: true,  // interview lines that can be pressed are highlighted
  },
  detective: {
    autoLinkHints: false, autoAnnotate: false, proactiveHints: false,
    softRequire: false, contradictionHints: false,
  },
  hardcore: {
    autoLinkHints: false, autoAnnotate: false, proactiveHints: false,
    softRequire: false, contradictionHints: false, hideClueCategories: true,
  },
};

export function diff() { return TIERS[State.profile?.difficulty] || TIERS.detective; }
