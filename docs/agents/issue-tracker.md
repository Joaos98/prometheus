# Issue tracker: Local Markdown, tracked in git

Specs (you may know a spec as a PRD) and issues for this repo live as markdown files under `docs/specs/`, committed to the repository. There is no external tracker — no GitHub Issues, no Linear, no `gh` or `glab` CLI.

This deviates from the skills' stock local-markdown convention, which uses `.scratch/`. The reason: `.scratch/` is gitignored here, and a spec is part of the design record alongside `CONTEXT.md` and `docs/adr/`, which are deliberately tracked. Work that an agent is meant to pick up has to survive a fresh clone.

## Conventions

- One feature per directory: `docs/specs/<NN>-<feature-slug>/`, numbered from `01`
- The spec is that directory's `spec.md` — or, for a single-file spec with no tickets yet, `docs/specs/<NN>-<feature-slug>.md`
- Implementation issues are one file per ticket at `docs/specs/<NN>-<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order — never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each spec and issue file (see `triage-labels.md` for the role strings)
- Blocking edges are a `Blocked by:` line near the top, listing the numbers/titles of the gating tickets, or `None — can start immediately`
- A `**Suggested model:**` line may follow `Status:`, naming the model and thinking effort the ticket is judged to want, and why. It is advice to whoever picks the ticket up, not a constraint — override it freely
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

`.scratch/` stays gitignored and stays available for genuinely throwaway work — prototypes, scratch notes, experiments nobody needs to keep.

## When a skill says "publish to the issue tracker"

Write a new file under `docs/specs/`, creating the feature directory if needed. Nothing is published anywhere else; committing is the publish step.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `docs/specs/<NN>-<effort>/map.md` — the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `docs/specs/<NN>-<effort>/issues/<NN>-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `docs/specs/<NN>-<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

## Current contents

- `docs/specs/0001-mvp/spec.md` — the MVP spec. `done`, shipped as v1.0.
- `docs/specs/0001-mvp/issues/01…19` — the MVP broken into 19 tracer-bullet tickets, numbered in dependency order. All `done`; each one's criteria and the notes made while building it are the record of what was built.
- `docs/specs/0002-v1-1-dashboard-refinements/spec.md` — v1.1, the roadmap's first five items refined. `done`, shipped as v1.1. One criterion of `0001-mvp/issues/17` is superseded by its ticket 03.
- `docs/specs/0002-v1-1-dashboard-refinements/issues/01…05` — five UI tickets, all `done`; each one's comments record what was built and how it was checked.
- `docs/roadmap.md` — what comes after v1.0, grouped into a rough v1.1/v1.2/… sequence. Items on it are `needs-triage` until promoted: refine one into a proper spec under `docs/specs/` before it is `ready-for-agent`.
