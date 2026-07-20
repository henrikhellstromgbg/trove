# Trove UI and interaction layout, v2

Status: proposal, 2026-07-20. Companion to `architecture-v2.md`. This is IA and interaction model, not visual design. Wireframes are approximate, Henrik supplies the visual pass.

## Principles

- The active project is always visible and always the answer to "where does this go." No capture without a known destination.
- Destructive actions are two-step and reversible where they can be. Trash before delete, archive before destroy.
- Global settings are for the account and shared resources. Project settings are for one corpus. Nothing important is ambiguous about which level it lives at.
- An item can always be renamed, moved, reprocessed, or deleted from one place: its detail view.

## The shell

Left sidebar, project scoped main area. The sidebar is the same on every screen. The project switcher sits at the top because it changes what everything below means.

```
┌──────────────────┬─────────────────────────────────────────────┐
│  Trove           │  library · tactical athlete intel           │
│                  │  ┌───────────────────────────────────────┐  │
│ ┌──────────────┐ │  │ search        [type▾][source▾][tag▾]  │  │
│ │ tactical   ▾ │ │  └───────────────────────────────────────┘  │
│ └──────────────┘ │                                             │
│                  │  ┌────────┐ ┌────────┐ ┌────────┐           │
│  capture         │  │ pdf    │ │ yt     │ │ mail   │           │
│  library      ●  │  │ title  │ │ title  │ │ title  │           │
│  wiki            │  │ summary│ │ summary│ │ summary│           │
│  sources         │  └────────┘ └────────┘ └────────┘           │
│  pipelines       │  ┌────────┐ ┌────────┐ ┌────────┐           │
│  ask             │  │ ...    │ │ ...    │ │ ...    │           │
│                  │  └────────┘ └────────┘ └────────┘           │
│  ──────────────  │                                             │
│  ⚙ settings      │                                             │
│  ◐ Henrik        │                                             │
└──────────────────┴─────────────────────────────────────────────┘
```

- **Project switcher** (top): current project name, opens the switcher panel.
- **Nav**: capture, library, wiki, sources, pipelines, ask. Each is project scoped. The active dot marks the current view.
- **Settings** (bottom): opens global settings.
- **User** (bottom): account menu, sign out.

Route is the source of truth for the active project, `/p/[slug]/library`, `/p/[slug]/sources`, and so on. The switcher just navigates. This avoids the router cache freezing client state, a lesson already logged.

## Project switcher and setup

Clicking the switcher opens a panel, not a bare dropdown, so it can carry the "new project" and "manage" affordances.

```
┌──────────────────────────┐
│  projects                │
│                          │
│  ● tactical athlete intel│   ← current, check mark
│  ○ sportscience          │
│  ○ nutrition             │
│  ○ client: acme          │
│  ○ client: bauer         │
│                          │
│  ──────────────────────  │
│  + new project           │
│  ⚙ manage projects       │
└──────────────────────────┘
```

**Creating a project** is deliberately thin. Two required fields, everything else has a default.

```
┌───────────────────────────────────┐
│  new project                      │
│                                   │
│  name    [ client: acme        ]  │
│  kind    ( personal )( ● client ) │
│  colour  ● ● ● ○ ● ●              │
│                                   │
│  [ create ]                       │
└───────────────────────────────────┘
```

- `name` is free text. `slug` is derived once (`client-acme`) and then stays stable, so links do not break when you rename. Slug is editable later only from settings, with a warning.
- `kind` is `personal` or `client`. It is a label that drives defaults, for example a `client` project defaults to private blobs and no cross-project suggestions. It does not change the hard wall, every project has that.
- On create you land in the empty project with one clear next step.

**Empty project state:**

```
  client: acme has nothing yet.

  Drop a file, paste a link, or connect a source.

  [ drop or browse ]   [ add a source ]
```

## Settings: global vs project

Two levels, and the split is the whole point.

### Global settings  ( ⚙ at sidebar bottom, route /settings )

Account wide, and shared resources that projects draw on.

```
┌────────────────────────────────────────────┐
│  settings                                  │
│                                            │
│  Account                                   │
│    profile, email, sign out                │
│                                            │
│  Ingest tokens                             │
│    tokens the local daemon and Tauri use   │
│    [ create token ]   token · revoke       │
│                                            │
│  Connected accounts                        │
│    Gmail        connect                     │
│    Slack        connected · disconnect      │
│    these are authorised once, projects      │
│    pick which label or channel to pull      │
│                                            │
│  Defaults                                  │
│    answer model, enrich model               │
│    default new-project kind                 │
│                                            │
│  Danger zone                               │
│    export everything · delete account       │
└────────────────────────────────────────────┘
```

The reason connected accounts are global: you authorise Gmail or Slack once as yourself, then a project decides which label or channel to ingest. The OAuth grant is an account resource, the source config that uses it is per project.

### Project settings  ( from switcher, or gear in project header, route /p/[slug]/settings )

One corpus only.

```
┌────────────────────────────────────────────┐
│  client: acme · settings                   │
│                                            │
│  General                                   │
│    name    [ client: acme        ]          │
│    slug    client-acme   (change, warns)    │
│    colour  ● ● ● ○ ● ●                      │
│    kind    personal / client                │
│                                            │
│  Capture                                   │
│    default type when ambiguous              │
│    auto-tag rules (optional)                │
│                                            │
│  Sources                                   │
│    → manage in the sources view             │
│                                            │
│  Members            (later)                 │
│    share this project read only             │
│                                            │
│  Danger zone                               │
│    archive project · delete project         │
└────────────────────────────────────────────┘
```

Rule of thumb. If it is about who you are or a credential you own, it is global. If it is about one body of knowledge, it is project.

## Capture, and never uploading to the wrong project

The active project is shown at the moment of capture, every time. That is the first line of defence.

```
┌─────────────────────────────────────────────┐
│  capture into  ● tactical athlete intel  ▾   │
│                                             │
│   ┌───────────────────────────────────────┐ │
│   │   drop files here                     │ │
│   │   or paste a link or text             │ │
│   └───────────────────────────────────────┘ │
│                                             │
│   recent captures                            │
│   · deadlift-standards.pdf   just now        │
│   · youtube: ruck training   2m ago          │
└─────────────────────────────────────────────┘
```

- The target project is named right on the drop zone, and you can switch it there before dropping, without leaving capture.
- Local daemon captures carry their `projectId` from the source config, so a `folder_watch` source always lands in its assigned project.

### If it still lands in the wrong project

Two recovery paths, because mistakes happen both ways.

1. **Undo toast.** Right after any capture, a toast offers "captured into tactical athlete intel · undo · move." Move opens the project picker inline.
2. **Move from anywhere later.** Every item detail and every library selection has "move to project." Select one or many, choose the destination, done.

```
  ☑ 3 items selected      [ move to ▾ ]  [ tag ]  [ delete ]
                             ┌──────────────────┐
                             │ tactical intel   │
                             │ sportscience     │
                             │ ● nutrition      │
                             │ client: acme     │
                             └──────────────────┘
```

**What "move" does under the hood:** reassign `project_id` on the item and its chunks, drop it from its old project's topics, queue a re-cluster. The blob file is untouched. It is cheap and safe, no re-extraction, no re-embedding. A toast confirms with undo.

## Item detail and the file viewer

One screen does viewing and all single-item actions. Opened from any card in library, wiki, or a citation.

```
┌─────────────────────────────────────────────────────────────┐
│  ← library                                    ⋯ actions      │
│                                                             │
│  Deadlift standards, Ranger school            ✎ rename       │
│  pdf · source: folder watch · captured 2d ago · ready        │
│  tags: strength, selection, standards         ✎              │
│                                                             │
│  ┌───────────────────────┬─────────────────────────────┐    │
│  │                       │  summary                    │    │
│  │   rendered document   │  Two sentences from enrich. │    │
│  │   (pdf / image /      │                             │    │
│  │    readable text /    │  extracted text             │    │
│  │    url reader)        │  full raw text, scrollable  │    │
│  │                       │                             │    │
│  │                       │  cited in                   │    │
│  │                       │  · 2 conversations          │    │
│  └───────────────────────┴─────────────────────────────┘    │
│                                                             │
│  ⋯ actions:  open original · rename · move to ·              │
│              retag · reprocess · copy link · delete          │
└─────────────────────────────────────────────────────────────┘
```

Viewer behaviour by type:

- **pdf**: inline page render, plus "open original" to the signed blob url.
- **image**: shown inline, with the extracted caption or OCR text beside it.
- **url**: cleaned readable text, with a link out to the source.
- **docx, xlsx, textfile, mail, transcript**: rendered text, with the raw extraction available below.

Per-item actions:

- **rename**: edits the title only. Extraction guesses titles and often gets them wrong, so this is common. Inline, no modal.
- **retag**: add or remove tags, which affects pipeline filters and wiki clustering.
- **reprocess**: re-run extract, chunk, embed, enrich. For when a source improved or extraction failed.
- **move to**: the recovery flow above.
- **copy link**: a stable internal link to this item.
- **delete**: see below.

## Renaming, across the app

- **Project name**: free, from project settings. Slug stays stable so links survive. Slug change is a separate, warned action.
- **Item title**: free, inline in the item header.
- **Source label**: free, from the source's row in the sources view.
- **Conversation title**: free, auto-set from the first question, editable.

Renaming never changes an id or a route, so nothing breaks.

## Deletion, two-step and scoped

Deletion is destructive, so it is always confirmed and, where it can be, reversible first.

- **Item**: "delete" moves it to a per-project trash. Trash is a filter in library. "Empty trash" is the second, explicit step that removes the item, its chunks, and its blob for good. Until then, restore is one click.
- **Source**: deleting a source stops future sync and asks a clear question, "delete source only, keep its items" or "delete source and everything it captured." Default is keep the items, since the knowledge is usually still wanted.
- **Project**: two tiers. **Archive** hides it from the switcher and stops its sources, fully reversible. **Delete** is destructive, cascades every item, chunk, topic, pipeline and conversation, and requires typing the project name to confirm.
- **Account**: global danger zone, exports first, then removes everything. Typing to confirm.

```
┌───────────────────────────────────────────┐
│  delete project client: acme              │
│                                           │
│  This removes 214 items, their files,     │
│  4 pipelines and 9 conversations.         │
│  It cannot be undone.                     │
│                                           │
│  type the project name to confirm         │
│  [ client: acme            ]              │
│                                           │
│  [ cancel ]           [ delete forever ]  │
└───────────────────────────────────────────┘
```

## Sources view

Where the old Intel folder finally gets a face. Lists connectors for the active project, their health, and an add button.

```
┌─────────────────────────────────────────────────────────────┐
│  sources · tactical athlete intel          [ + add source ] │
│                                                             │
│  ● newsletters        mail folder   local   ok    2h ago    │
│      312 items · Newsletters.mbox                           │
│  ● tactical channels  youtube       cloud   ok    9h ago    │
│      13 channels · 1,204 transcripts                        │
│  ● ruck pdfs          folder watch  local   ok    1d ago    │
│      ~/intel/raw · 88 items                                 │
│  ⚠ sportsci feed      rss           cloud   error 3h ago    │
│      last error: feed timeout · retry                       │
│                                                             │
│  add source ▾  drop · mail folder · folder watch ·          │
│                youtube · rss · web scrape · slack           │
└─────────────────────────────────────────────────────────────┘
```

Each source row shows kind, where it runs (local or cloud), last status, last sync, and a count. Local sources show as "local" so it is clear they depend on the Mac and the daemon. Adding a source opens a kind-specific form (mbox path and filters for mail, channel ids for youtube, and so on, per the `source.config` table in the architecture doc).

## Screen inventory

| route                     | screen        | scope   |
|---------------------------|---------------|---------|
| `/p/[slug]/capture`       | capture       | project |
| `/p/[slug]/library`       | library grid  | project |
| `/p/[slug]/item/[id]`     | item viewer   | project |
| `/p/[slug]/wiki`          | wiki topics   | project |
| `/p/[slug]/sources`       | sources       | project |
| `/p/[slug]/pipelines`     | pipelines     | project |
| `/p/[slug]/ask`           | chat          | project |
| `/p/[slug]/settings`      | project settings | project |
| `/settings`               | global settings  | account |

## Open UI questions

- **Global inbox.** Do captures with an ambiguous destination land in a cross-project inbox for triage, or must every capture pick a project up front. Leaning: always pick, with the active project pre-filled, since the wall matters more than the convenience.
- **Trash lifetime.** Auto-empty trash after 30 days, or keep until manual. Leaning auto after 30 days, with a setting.
- **Move and re-embed.** Moving keeps embeddings as is, which is correct since the vector does not depend on the project. Confirm no pipeline assumes otherwise.
- **Multi-select scope.** Bulk move and delete in library, yes. Bulk retag, probably. Bulk reprocess, maybe, it is expensive.
