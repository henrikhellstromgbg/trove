# Trove UI and interaction layout, v2

Status: living UI architecture, updated 2026-07-21. Companion to `architecture-v2.md` and `trove-project-flow-architecture.html`. The visual HTML is the canonical wireframe set; this file explains behavior and route status.

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
│  ask             │  │ pdf    │ │ web    │ │ mail   │           │
│  library      ●  │  │ title  │ │ title  │ │ title  │           │
│  sources         │  │ summary│ │ summary│ │ summary│           │
│  pipelines       │  └────────┘ └────────┘ └────────┘           │
│                  │  ┌────────┐ ┌────────┐ ┌────────┐           │
│                  │  │ ...    │ │ ...    │ │ ...    │           │
│                  │  └────────┘ └────────┘ └────────┘           │
│  ──────────────  │                                             │
│  ⚙ settings      │                                             │
│  ◐ Henrik        │                                             │
└──────────────────┴─────────────────────────────────────────────┘
```

- **Project switcher** (top): current project name, opens the switcher panel.
- **Nav**: Ask, Library, Sources and Pipelines. Each is project scoped. `/p/[slug]` is the project overview; Ask has its own focused workspace at `/p/[slug]/ask`.
- **Capture**: a project-scoped action below the main navigation. It opens the existing capture overlay instead of requiring a separate route.
- **Settings** (bottom): routes to `/p/[slug]/settings` (ingest-token management + account access). Account email/security still opens the auth provider's own modal from inside that page.
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

### Global settings (planned route `/settings`)

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

### Project settings (planned route `/p/[slug]/settings`)

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
│  capture into  ● tactical athlete intel      │
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

- The target project is named on the ambient drop zone and in the capture dialog. An in-dialog project switcher is planned; today the active route project is the destination.
- Local app captures carry an explicit `projectId` from the source config, so a `folder_watch` source always lands in its assigned project.

### If it still lands in the wrong project

Two planned recovery paths, because mistakes happen both ways. Neither is implemented yet.

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

**What “move” does under the hood:** manual material with `source_id = null` is moved by reassigning `project_id` on the item and its chunks, removing it from the old project's topics and queuing a re-cluster. Material from an automatic source is copied instead, because its source belongs to one project and moving the same item would create a cross-project `source_id`. The copy belongs to the destination and is processed there; the source-project original remains. The action labels must say “move” or “copy” accordingly. **Implemented** as `POST /api/items/[id]/move` (`lib/items/move.ts`); only ready items are eligible and the copy does not share the origin's blob. The library/item UI control is the remaining piece.

## Item detail and the file viewer

The current read-only viewer is opened from Library or an Ask citation. The richer screen below is planned as the single place for viewing and all item actions.

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
- **retag**: add or remove tags, which affects pipeline filters and topic clustering.
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
│  ● sportsci feed      rss           cloud   ok    9h ago    │
│      13 channels · 1,204 transcripts                        │
│  ● ruck pdfs          folder watch  local   ok    1d ago    │
│      ~/intel/raw · 88 items                                 │
│  ⚠ sportsci feed      rss           cloud   error 3h ago    │
│      last error: feed timeout · retry                       │
│                                                             │
│  add source ▾  mail folder · folder watch · rss ·           │
│                web scrape · slack                           │
└─────────────────────────────────────────────────────────────┘
```

Each source row shows kind, where it runs, last status, last sync and a count. Local sources show that they depend on the Mac app. Today RSS, web scrape and Slack have setup forms. Mail and watched folders use the planned guided setup with connection, scope, source rule and preview. Generic YouTube transcription is later.

## Pipelines view

A source brings material into the project. A pipeline reads material already in the project and produces a recurring result. The UI must not call source selection rules pipelines.

The pipeline journey has five screens:

1. **List:** name, schedule, delivery and active or paused state.
2. **Templates:** choose one or several clear outcomes, such as Morning brief and Friday weekly summary.
3. **Create:** plain-language instruction plus explicit scope and delivery preview for a custom pipeline.
4. **Detail:** compiled instruction, schedule, pause/edit/run-now and complete run history.
5. **Result:** when email delivery is selected, the report is sent at the scheduled time and the UI shows recipient and delivery status. The same cited report remains stored in Trove for history, opening and resend if delivery fails.

Each selected template creates a separate project pipeline. Morning and weekly reports therefore have independent schedules, instructions, source scope, delivery and run history. Templates are defaults, not a locked mode.

The current code already implements list, plain-language creation, detail, run-now, pause, delete and run history. The visual architecture adds the missing complete wireframe journey and makes the persisted result explicit.

## Screen inventory

Status legend: **exists** (built UI) · **backend ready** (API/store done, UI is the
only missing piece — build these first, they unlock shipped capability) · **planned**
(needs backend too). Kept in step with the build order in `architecture-v2.md`.

| route or surface | screen | scope | status |
|------------------|--------|-------|--------|
| `/p/[slug]` | project overview and Ask launcher | project | exists |
| `/p/[slug]/ask` | focused Ask workspace with citations | project | exists; threads persist, right panel shows sources |
| `/p/[slug]/chats` | chat archive | project | exists — lists every thread (today/yesterday/earlier), resume via `?conversation=`, delete via `DELETE /api/ask` |
| capture overlay | file, link and text capture | project | exists |
| `/p/[slug]/library` | library list | project | exists |
| `/p/[slug]/library/[id]` | item viewer | project | exists with an actions card: rename/retag (`PATCH /[id]`), reprocess (`/[id]/reprocess`), move/copy (`/[id]/move`), trash (`/api/items/trash`) |
| `/p/[slug]/topics` | auto-clustered topic browser | project | exists — read-only cards (name, summary, grouped items) over the nightly clustering |
| `/p/[slug]/sources` | source list | project | exists |
| `/p/[slug]/sources/new` | source setup | project | exists (rss/web/slack + mail_folder/folder_watch); local kinds carry an honest 'runs on your mac' note and daemon-driven sync |
| `/p/[slug]/sources/[id]` | source status and latest items | project | exists — recent items, status, and a run history of the last 10 syncs (trigger, status, new-item count, error) |
| `/p/[slug]/pipelines` | pipeline list | project | exists |
| pipeline template picker | choose one or several starter pipelines | project | exists on `/pipelines/new` — install a starter (optional email toggle) or write your own below |
| `/p/[slug]/pipelines/new` | plain-language custom pipeline setup | project | exists, preview planned |
| `/p/[slug]/pipelines/[id]` | pipeline detail and run history | project | exists |
| pipeline run result | persisted report with citations | project | partial through Digest |
| Library review filter | review queue | project | exists — `?view=review` tab; approve/reject over `/api/items/review` |
| Library trash filter | trash and restore | project | exists — `?view=trash` tab; restore + two-step permanent delete over `/[id]/restore` and `DELETE /[id]` |
| `/p/[slug]/settings` | project settings | project | exists; hosts ingest-token management (issue/scope/reveal-once/revoke) + account access. Connected accounts (`/api/sources/accounts`) still **backend ready** |

## Decided behavior and remaining questions

- **Project is mandatory:** every capture has an explicit active project. There is no cross-project triage inbox.
- **Trash lifetime:** items stay recoverable for 30 days, with explicit restore and permanent-delete actions.
- **Move/copy:** manual material moves with its chunks and is re-clustered without re-extraction or re-embedding. Automatic-source material is copied and processed in the destination so its original never gets a cross-project `source_id`. **Backend implemented** (`POST /api/items/[id]/move`); the UI control remains.
- **Source deletion:** default is stop the source and keep imported items. The alternative moves its imported items to project trash.
- **Still open:** exact bulk actions in Library and whether project owners can change the 30-day retention period.
