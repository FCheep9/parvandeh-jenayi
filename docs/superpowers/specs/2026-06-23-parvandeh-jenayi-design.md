# پرونده جنایی (Criminal Case) — Design Spec

**Date:** 2026-06-23
**Status:** Approved design → implementation planning
**Owner:** FCheep9

---

## 1. Summary

A static, **GitHub-Pages-hosted** interactive detective game. Modern **police-procedural**
realism. Playable **solo or 2-player** (asymmetric roles, not co-op). A **data-driven
narrative engine** renders cases authored as JSON, so the "AAA story" is content, not code,
and **multiple cases** can ship over time.

**First public release = Onboarding selector + a playable Act 1 prologue** of Case 1,
*The Last Clean Take*.

English text; **پرونده جنایی** kept as the branded title.

---

## 2. Goals & non-goals

**Goals**
- A polished onboarding screen where the player selects: **visual theme**, **their detective**
  (portrait/name/specialty), **story tone & difficulty**, and **players & roles**. These both
  personalize play and signal taste for future authoring.
- A reusable engine: Evidence locker, People (interviews), Locations, Deduction board, Acts
  with Lead-only decision points, and a final accusation.
- Asymmetric 2-player: both explore freely; **only the Lead commits binding decisions**.
- **Zero-effort, no-API-key visuals** sourced from online services.
- A complete, fair-play Act 1 prologue for Case 1.

**Non-goals (now)**
- Networked/cross-device multiplayer (same-device hot-seat only).
- A build pipeline / framework (vanilla, no build step).
- Audio voice-acting/music production (text-first; optional ambient later).
- Authoring Acts 2–4 of Case 1 in the first release (prologue first; iterate after).

---

## 3. Architecture

**Vanilla HTML/CSS/JS (ES modules) + JSON case data. No build step.** Deploys to GitHub Pages
as-is. *Rejected alternatives:* a framework (needs a build action; overkill) and a narrative
engine like Twine/Ink (fights the custom evidence-board, 2-player, and photo UI).

```
/index.html                 # shell: loads the app, mounts screens
/css/
  theme.css                 # CSS custom properties; theme variants (noir/modern/gritty)
  layout.css                # structural styles, responsive, RTL-ready (LTR for now)
  components.css            # cards, modals, board, dialogue, etc.
/js/
  main.js                   # bootstrap, routing between screens
  state.js                  # single state store + localStorage persistence
  engine/
    story.js                # act/beat progression, decision points, accusation
    board.js                # deduction board: clue cards, links, conclusions
    investigation.js        # evidence / people / locations browsing + unlocks
    twoplayer.js            # role model (Lead/Partner), commit gating, partner notebook
    difficulty.js           # hint/strictness rules per tier
    media.js                # resolves portrait/scene image URLs (see §6)
  screens/
    onboarding.js           # the selector (theme/detective/tone+difficulty/players)
    casehub.js              # case board shell (tabs: Story, Evidence, People, Locations, Board)
    dialogue.js             # branching interview UI
    accusation.js           # final accusation flow
  util/
    dom.js, audio.js (optional sfx), rng.js (seeded, deterministic)
/data/
  cases/
    the-last-clean-take/
      case.json             # metadata, acts, beats, decision points, accusation spec
      evidence.json         # evidence items (+ image refs, forensic notes, unlock rules)
      people.json           # characters (+ portrait seeds, dialogue trees, secrets)
      locations.json        # locations (+ scene image refs, hotspots)
      clues.json            # deduction clue cards + valid links/conclusions
      media.json            # curated image URLs / portrait seeds for this case
  themes.json               # theme definitions (palette vars + photo filter)
  detectives.json           # selectable detective archetypes (portrait seed + specialty)
/assets/                    # local: logo, icons, favicon, theme textures (small)
/docs/                      # story bible + this spec
README.md
```

**Data flow:** `main.js` boots → `state.js` loads saved profile (or onboarding) → onboarding
writes the **profile** (theme, detective, tone, difficulty, players/roles) → case hub loads
the selected case's JSON → engine renders the current act/beat and the always-available Case
Board → player actions mutate state → state persists to localStorage.

**Why these boundaries:** each engine module owns one concern with a small interface
(`story`, `board`, `investigation`, `twoplayer`, `difficulty`, `media`). Case content is pure
data — adding a case = adding a `/data/cases/<id>/` folder + a registry entry. No engine edits.

---

## 4. Onboarding selector

Single screen, four steps (or one scrolling panel), writes `state.profile`:

1. **Visual theme** — `Noir` (dark, grain), `Clean Modern`, `Gritty` (film-grain/sepia).
   Applies a palette (CSS vars) + a photo filter so one image set serves all themes.
2. **Your detective** — choose a **portrait** (realistic, seeded), enter a **name**, pick a
   **specialty**: `Forensics` / `Interrogation` / `Profiling`. Specialty grants a small,
   non-breaking perk (e.g., Forensics reveals one extra lab note; Interrogation unlocks one
   extra dialogue press; Profiling highlights one motive hint). Perks never gate the solution.
3. **Story tone & difficulty** — tone `Grim / Balanced / Pulpy` (**light** narration flavor +
   a taste signal — vocabulary/a few flavored lines, *not* full re-authoring); difficulty
   `Casual / Detective / Hardcore` (hints + accusation strictness, see §7).
4. **Players & roles** — `Solo`, or `2-Player` → assign **Lead Detective** + **Partner**
   (names/portraits). In solo, the Partner is an AI advisor whose hints scale with difficulty.

Profile is editable later from the hub. Selecting a case (when >1 exists) happens after
onboarding via a case-select screen; for the first release the only case is *The Last Clean
Take*.

**Player-character vs fixed protagonist (design decision).** Each case has a deeply-written
protagonist whose **personal stake is essential to the story** (Case 1: a detective kept alive
during rehab by the victim's voice, now half-deaf and unsure she can trust her own ear). The
onboarding **name + portrait skin that protagonist** (narration uses the chosen name; the
chosen portrait is the detective avatar), and the chosen **specialty** grants perks — but the
**case's defining wound/stake is retained regardless of the chosen name**, because it is load-
bearing for the plot and the 2-player thesis. So "you play *[your name]*, a detective who…".
This keeps the AAA story intact while honoring personalization. (Surfaced for review — the
alternative is a fully fixed, un-named protagonist with cosmetic-only selection.)

---

## 5. Investigation model (the core loop)

A persistent **Case Board** with tabs, browsable any time once unlocked:

- **Story** — the current act/beat: narration (toned), images, and choices. **Decision points**
  are Lead-only (see §8). Advancing the story unlocks evidence/people/locations.
- **Evidence locker** — items with a photo + forensic notes; some gated behind progress or a
  derived key (e.g., Case 1's CGM behind a passcode found in the audio archive). Specialized
  tools where a case needs them (Case 1: a **waveform/spectrogram viewer** to compare
  recordings — see the audio note below).

> **Audio-forensics with no audio assets (Case 1).** The case turns on "hearing" wrongness,
> but we author no voice-acting/recordings. Resolution: the mechanic is **primarily visual** —
> the player *reads* a generated **waveform/spectrogram** (evenly-spaced breath peaks on the
> synthetic clip vs. irregular peaks on the archival clip; a labeled 50 Hz hum + HVAC-rattle
> marker tying a "new" clip to the *old* booth). Waveforms are drawn from per-clip data in the
> case JSON (no media files). **Optional** procedural audio via the Web Audio API /
> `SpeechSynthesis` adds flavor but is never required to deduce. This is fully implementable,
> accessible, and fair — and it fits Mara's arc (her own ear is unreliable, so the *evidence*
> must be seen, not just heard).
- **People** — interview suspects/witnesses via branching dialogue; portraits; secrets gated by
  trust/evidence (pressing vs. rapport). Re-interviewable as new evidence unlocks lines.
- **Locations** — examine scenes; click hotspots to surface evidence/observations.
- **Deduction board** — drag clue cards to connect them into **conclusions**. Valid links form;
  unsupported links grey out (teaching that gut ≠ proof). Required conclusions gate the
  accusation. Difficulty controls auto-suggest/labels.

Free browsing is **non-binding**; only decision points and the accusation commit.

---

## 6. Visual pipeline (auto, no API key)

`media.js` resolves image URLs at runtime; no images are committed except a small local set
(logo/icons/textures).

- **Character portraits:** `randomuser.me` realistic portraits, pinned per-character by a
  **fixed seed** (e.g., `https://randomuser.me/api/portraits/men/{n}.jpg`) so each character is
  visually stable across sessions. Seeds are stored in the case's `media.json` / `people.json`.
- **Scenes & evidence:** curated royalty-free **Unsplash** photo URLs (`images.unsplash.com/
  photo-<id>?w=…&q=…`) chosen per item/location, stored in `media.json` / `*.json`.
- **Theme filter:** the selected theme applies a CSS filter (grain/sepia/contrast) over photos
  so one curated set works for all themes.
- **Resilience:** every image ref has a local placeholder fallback (`/assets/placeholder/…`)
  and `loading="lazy"`; a broken remote URL degrades to the placeholder, never a blank.
- **Credits:** a Credits screen lists image sources/licenses.

> Risk noted: remote hotlinks can change/expire. Mitigation = curated stable IDs + placeholder
> fallback + a documented swap process in `media.json`. If reliability becomes an issue we can
> later vendor a chosen subset into `/assets`.

---

## 7. Difficulty

| | Casual | Detective (default) | Hardcore |
|---|---|---|---|
| Deduction board | auto-suggests valid links; greys dead ends | manual links; no suggestions | manual; clue-category labels hidden |
| Audio/forensic tools | auto-annotates anomalies | raw data to read | raw; no annotation |
| Interviews | contradiction lines highlighted | right pressure + evidence needed | no highlighting |
| Hints | proactive Partner hints | limited, cost clock time | none |
| Accusation | accepts correct **core**; gentle epilogue on minor miss | correct split + key clues; mis-citation challenged | strict full chain; confident wrong accusation allowed |

Hints **never invent facts** — they only surface clues already discoverable.

---

## 8. Two-player (asymmetric)

Same-device hot-seat. Roles = *who may commit*, not separate screens.

- Both players free-browse Evidence/People/Locations and the board.
- **Partner notebook** — a per-case advisory instrument the Partner maintains (Case 1: an
  **audio-discrepancy log**; Room 114: the whistleblower notebook; Salvage Room: a
  physical-vs-paper suspicions log). The Partner can flag/annotate; flags surface to the Lead.
- **Lead-only commits** — decision points, evidence triage choices, and the final accusation
  show a "Lead decides" modal and only the Lead resolves them. The Partner's flags/"my vote"
  are visible at decision time.
- **The Partner can be wrong** (by design in some cases), so the Lead must weigh the second
  mind — which is the thematic point.
- **Solo** — Partner becomes an AI advisor; hint richness scales with difficulty.

Implementation: a lightweight `role` flag + a `commit()` guard in `twoplayer.js`; an optional
"pass the device" prompt before binding decisions. No server, no real-time sync.

---

## 9. Persistence

`localStorage` holds: `profile` (theme/detective/tone/difficulty/players), per-case `progress`
(current act/beat, unlocked items, dialogue state, board conclusions), and the Partner
`notebook`. A "New game / Reset" control clears a case's progress; profile persists. Saves are
namespaced per case id.

---

## 10. Case 1 content scope (first release)

Ship the **Act 1 prologue** of *The Last Clean Take* (full spine in
`/docs/story-bible/README.md`), playable end-to-end through the Act-1 button:

- **Cold open** (non-interactive): on-screen narration text of Della reading, paired with an
  animated **waveform** that starts warm/irregular and degrades into a too-clean metronomic
  version (optional procedural TTS for flavor). Subtitle: *"Eleven weeks. Nobody noticed."*
- **Beats:** Arrival (teach Locations) → The Ear (theme hook; waveform "does this sound right?")
  → First Evidence (ME field note; teach locker + magnify) → First Interview (Junie; teach
  People + branching) → Meet the partners-in-fraud (plant Theo/Priya/Gareth, surface 36h clock)
  → The Board (teach deduction; a link can be wrong) → **Lead-only decision** (release as
  natural death, or hold as suspicious) → Act-1 button (hold → ME wants a full post-mortem; the
  first crack; smash to Act 2 title).
- **Systems exercised in Act 1:** Locations, Evidence locker (+ magnify), People (+ branching),
  Deduction board (+ invalid links), the **audio waveform viewer**, the Lead/Partner asymmetry,
  difficulty hooks, the HUD ticking clock, theme + portraits via the media pipeline.
- Acts 2–4 + epilogue: authored in later iterations.

Multi-case readiness ships from day one (registry + folder structure), even though only Case 1
is playable; Room 114 and Salvage Room have full spines ready to author next.

---

## 11. Repo & deployment

- **Public** repo under **FCheep9**; proposed name **`parvandeh-jenayi`**.
- GitHub Pages served from **`main` branch root** (so `/docs/` does not collide with Pages).
- Live URL: `https://FCheep9.github.io/parvandeh-jenayi/`.
- All asset paths **relative** so the project-pages subpath works.
- Pages enabled via `gh api` after the first push.
- This spec + the story bible are committed to the repo.

---

## 12. Risks & mitigations

1. **Remote image reliability** → curated stable IDs + local placeholder fallback + documented
   swap process (§6).
2. **Audio-forensics is the hardest reasoning step** → difficulty scaling + auto-annotation on
   Casual; the waveform viewer must make breath spacing visually obvious.
3. **Single-truth replayability** → value comes from moral-choice branching (accusation framing,
   talkback seal/enter, indicting Gareth) and from *other cases*, not new whodunits per case.
4. **Emotional climax leans on writing** → invest in the talkback scene + Theo's collapse copy.
5. **Scope creep** → Act 1 prologue only for first release; engine first, content iterates.

---

## 13. Definition of done (first release)

- Onboarding writes a profile and themes the UI (3 themes, seeded portraits render).
- Case hub loads Case 1 data; all five tabs function.
- Act 1 prologue is playable cold-open → Act-1 button, teaching every core system.
- Solo and 2-player (Lead/Partner commit gating + Partner notebook) both work.
- Difficulty changes hints/strictness observably.
- Progress + profile persist across reload; reset works.
- Deployed live on GitHub Pages at the URL above; images load (or fall back) without errors.
