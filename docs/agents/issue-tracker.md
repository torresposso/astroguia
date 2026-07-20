# Issue tracker: Local Markdown + GitHub

Issues and specs (you may know a spec as a PRD) for this repo live as markdown files in `.scratch/`, mirrored to GitHub issues for visibility.

## Conventions

- Primary source of truth: `.scratch/<feature-slug>/`
- Spec: `.scratch/<feature-slug>/spec.md`
- Implementation issues: `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Each issue has a corresponding GitHub issue (linked in the markdown file header)
- Changes happen locally first, then synced to GitHub

### File structure

```
.scratch/<feature-slug>/
├── spec.md
└── issues/
    ├── 01-infraestructura.md
    ├── 02-agente-natal.md
    └── ...
```

### Issue file format

```markdown
# <Title>

- **GitHub**: #<number>
- **Status**: <necesita-triaje|necesita-info|listo-para-agente|listo-para-humano|descartado>

## Description
...

## Comments
...
```

### GitHub conventions

- **Create an issue**: `gh issue create --title "..." --body "..." --label "..."`
- **Read an issue**: `gh issue view <number> --comments`
- **List issues**: `gh issue list --state open --json number,title,body,labels`
- **Comment**: `gh issue comment <number> --body "..."`
- **Labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."

## When a skill says "publish to the issue tracker"

Create the file under `.scratch/<feature-slug>/` first, then create the corresponding GitHub issue. Link the GitHub issue number in the file header.

## When a skill says "fetch the relevant ticket"

Read the local file at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`. If it doesn't exist, fall back to `gh issue view <number>`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
