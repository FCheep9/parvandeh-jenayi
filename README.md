# پرونده جنایی — Criminal Case

An interactive, fair-play **detective game** you can play in your browser — solo or with a
friend (asymmetric 2-player: both investigate, one leads). Modern police-procedural realism,
a data-driven story engine, and multiple cases.

▶ **Play:** https://FCheep9.github.io/parvandeh-jenayi/

## Cases
- **Case 1 — The Last Clean Take** *(in production)* — A celebrated audiobook narrator is found
  dead the night before her biggest release… but the "new" recordings were made in a room that
  no longer exists. A whodunit that becomes a *whendunit*.
- **Room 114: The Quiet Hours** *(written, build-ready)* — murder by staffing algorithm.
- **The Salvage Room** *(written, build-ready)* — a flood, a rebuilt frame, a dead partner.

See [`docs/story-bible/`](docs/story-bible/) for the full story bible and
[`docs/superpowers/specs/`](docs/superpowers/specs/) for the design spec.

## How to play
1. **Onboarding** — pick a visual theme, build your detective (portrait + name + specialty),
   set tone & difficulty, and choose solo or 2-player.
2. **Investigate** — browse the Case Board: Evidence, People (interviews), Locations, and a
   Deduction board where you connect clues into conclusions.
3. **Decide** — only the **Lead Detective** commits binding decisions and the final accusation.
   The **Partner** explores freely and advises.

## Tech
Pure static site — vanilla HTML/CSS/JS (ES modules) + JSON case data. No build step. Hosted on
GitHub Pages. Visuals are sourced live from royalty-free online services (no API keys).

## Develop locally
```bash
# any static server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000
```

## Adding a case
Each case is a self-contained folder under `data/cases/<id>/` (see `docs/DATA-SCHEMA.md`).
Adding a case never touches engine code.
