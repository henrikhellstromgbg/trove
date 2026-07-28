# Answer-first Ask build plan, 2026-07-26

Status: **Implemented and verified on 2026-07-26.** This document remains the
source of truth for the answer-first Ask architecture.

## Visual refinement, 2026-07-27

Approved reference: `.omx/artifacts/visual-ralph/ask-elevation/reference.png`.

- Product navigation uses neutral `gray-50`; the work canvas uses neutral
  `gray-25`; the Sources sidebar uses white.
- Active Ask keeps questions, the latest answer, and the composer in one
  continuous main column. Every prior question keeps its saved answer visible
  in the revision timeline; the latest answer remains the current version at
  the bottom. Sources remains a viewport-height desktop rail and an inline
  mobile disclosure. The work area fills the viewport, the timeline connects
  to the bottom composer, and `Done` aligns to the far edge of the active Ask
  header. The empty state keeps the same blank timeline, bottom composer, and
  desktop Sources rail to avoid a structural transition on the first question.
- The composer uses the existing medium elevation token. The Sources sidebar
  uses a subtle neutral border instead of decorative elevation.
- Stop when the active and idle Ask states visually preserve this hierarchy at
  desktop and mobile widths and the design, contrast, type, test, and build
  checks pass.

## Outcome

Change Trove's Ask experience from a visible chat transcript into an
answer-first knowledge surface:

1. `Ask` remains the project home and the place where a user states a question.
2. The first submitted question creates a saved working answer, and follow-up
   questions refine that same answer inside the active Ask session.
3. The latest complete answer is the current revision; earlier questions and
   their saved answers remain fully visible in the revision timeline.
4. Saved results live under `Answers`, not `Chats` or `Chat archive`.
5. Existing saved conversations remain readable and deletable. No user data is
   renamed, discarded, or rewritten during this round.

Stop when the new routes, answer projection, answer-first UI, compatibility
redirects, tests, design checks, responsive visual evidence, and production
build all pass. Do not add manual page editing, agent execution, or a new wiki
engine in this round.

## Product and structural decision

### Recommended structure

Use `wiki` as the product mental model, not as a navigation label yet:

- **Ask** is the input action and remains at `/p/[slug]`.
- **Answers** is the persistent collection at `/p/[slug]/answers`.
- **Working answer** is the active, auto-saved Ask session.
- **Answer page** is the stable, reading-oriented output at
  `/p/[slug]/answers/[id]`, reached when the user chooses `Done` or revisits it
  from Answers.
- **Topics** remains automatic clustering and discovery. It does not become a
  second answer store.
- **Work log** is the visible question and revision history inside an answer
  page. It uses the same timeline as Ask without exposing a composer.

This keeps Trove's existing stable product noun `Ask`, adds one noun for the
persistent artifact, and avoids two competing features both called `Wiki`.
The design direction is consistent with Trove's quiet, editorial,
content-first contract in `DESIGN.md:11-21`.

### Data decision

Do **not** rename the SQLite `conversation` and `message` tables or introduce a
new `knowledge_page` table in this round. The current schema already contains
the required durable aggregate and revision history:

- `conversation` owns the project-scoped id, title, and creation time
  (`lib/db/schema.ts:327-335`).
- ordered `message` rows preserve every question, generated answer, citations,
  and timestamp (`lib/db/schema.ts:337-346`).

Add a domain projection in `lib/answers.ts` so UI and new resource routes use
`AnswerSummary`, `AnswerPage`, `AnswerRevision`, and `answerId` terminology
without forcing a risky storage migration. In that projection:

- the conversation title is the answer-page title;
- the latest **complete assistant message** is the canonical displayed answer;
- its citation array is the canonical source list;
- earlier user/assistant pairs are activity/revision history;
- `updatedAt` is derived from the latest stored message timestamp, falling back
  to the conversation creation time.

This is a deliberate compatibility boundary: physical storage may retain
legacy names while the product and application domain stop exposing them.

### Follow-up decision

A follow-up updates the working answer inside Ask. Lightweight conversational
behavior is allowed because the user may need several attempts, but the answer
remains visually dominant and the interface does not become a bubble-based
messenger. While generation streams:

- keep the previous complete answer visible;
- identify the answer region as updating;
- replace the canonical answer only after a complete assistant response has
  been persisted;
- preserve the previous answer and show a recoverable inline error if
  retrieval, generation, or persistence fails.

The generation prompt may receive the latest answer as an explicitly
untrusted draft to revise, plus recent user questions as intent. Saved source
chunks remain the only factual ground truth. This extends the current rule that
earlier model answers are not factual sources (`app/api/ask/route.ts:8-14` and
`:53-60`) rather than weakening it.

## Why not a new wiki schema now

A dedicated `knowledge_page` plus `revision` model becomes justified when the
product supports manual editing, merging, links between pages, publishing, or
multiple page-generation workflows. None is required for the answer-first UI.
Introducing those tables now would create migration and synchronization work
without changing what a user can accomplish.

Revisit the storage model only when at least one of these is approved:

- users can manually edit the canonical body;
- several conversations or topics can merge into one page;
- answers have workflow state such as draft, pinned, or published;
- non-Ask pipelines can update the same page;
- revisions need independent restore or comparison.

## Requirements summary

### Functional

- Preserve the empty Ask home and its project overview
  (`app/p/[slug]/page.tsx:215-222`).
- A first question creates a durable answer and keeps the user in the active
  Ask flow, with the stable answer id reflected in the URL.
- The active Ask header displays `Working answer`, `Auto-saved to Answers`, and
  a secondary `Done` action.
- `Done` ends the active Ask flow and navigates to the stable answer page.
- Navigating away is safe because the first answer and every completed
  refinement are saved automatically.
- An answer page displays title, updated time, source count, source list, and
  every saved question-and-answer revision in a full Work log. It has no
  follow-up composer and no `Ask a new question` action.
- A follow-up produces a new canonical answer while preserving earlier turns in
  activity.
- The Answers index lists saved answers newest-updated first and links each row
  to its stable page.
- Existing `/p/[slug]/chats` links redirect to `/p/[slug]/answers`.
- Existing `/p/[slug]?conversation=[id]` links redirect to the matching stable
  answer page without dropping the project boundary.
- Deleting an answer removes the underlying conversation and cascaded messages,
  preserving the current ownership and deletion behavior
  (`app/api/ask/route.ts:149-179`).

### Trust and security

- Every answer read, list, follow-up, rename if later added, and delete remains
  scoped by authenticated `userId` and a verified owned `projectId`.
- A foreign-user or wrong-project answer is indistinguishable from a missing
  answer on resource reads and deletes.
- Every factual claim continues to require an inline numbered citation.
- Source links continue to open ownership-checked Library item routes.
- Earlier generated answers never become factual retrieval sources.

### Interaction and design

- The answer is the main reading surface; chat bubbles, avatars, `You`,
  `Message`, `Conversation`, and auto-scrolling transcript behavior disappear
  from the default view. Those concepts currently dominate
  `app/ask-chat.tsx:263-308`.
- Use a URL-backed page because answers are durable destinations users revisit,
  share, and bookmark, following `.claude/skills/ux-patterns/SKILL.md` U1 and U5.
- Use existing `PageFrame`, `PageHeader`, typography, `FormField`/`Textarea`,
  `Button`, `DataList`/`DataRow`, `Alert`, and async-state primitives from
  `components/ui/README.md`.
- The follow-up textarea has a persistent visible label; placeholder-only
  labeling is forbidden by `design-rules/RULES.md` N8 and A4.
- Keep one primary action in the active Ask task: submit the follow-up. `Done`
  is secondary and ends the flow.
- Desktop keeps the source rail. Mobile exposes sources through an existing
  non-blocking disclosure/drawer pattern without losing source count or access.
- The stable Answer page uses the same fully visible Work log as Ask, without
  an input or generation controls.
- Loading, empty, no-source, generation error, persistence error, delete error,
  and ready states are explicit.

## Acceptance criteria

1. Submitting a valid first question from `/p/[slug]` streams an answer,
   auto-saves it, and keeps the user in Ask with the owned answer id in the
   URL; reload restores the same title, answer, citations, and activity.
2. The default answer page contains no visible strings `Chat`, `Conversation`,
   `Message`, or `You` and renders every saved question-and-answer revision in
   full, with the latest complete assistant answer as the current revision.
3. The page displays `Based on N sources` using the canonical answer's citation
   count, and every listed source links to `/p/[slug]/library/[owned-item-id]`.
4. A follow-up in Ask leaves the prior complete answer visible until the
   replacement is complete. On success, the new answer and citations become
   canonical and the previous turn becomes secondary activity.
5. A failed follow-up leaves the prior canonical answer unchanged, displays an
   inline retryable error, and permits another submission without reloading.
6. `/p/[slug]/answers` lists every owned saved answer exactly once, sorted by
   derived `updatedAt` descending, with title, source count when available, and
   updated date. An empty project shows one action back to Ask.
7. `/p/[slug]/chats` redirects to `/p/[slug]/answers`, and
   `/p/[slug]?conversation=[owned-id]` redirects to
   `/p/[slug]/answers/[owned-id]`. Invalid or foreign ids reveal no content.
8. Existing rows created before this change render without a migration or
   backfill. An incomplete trailing user question does not replace the most
   recent complete answer.
9. Deleting an owned answer succeeds and removes it from the Answers index;
   deleting a foreign, wrong-project, malformed, or missing id performs no
    write and returns the resource route's not-found response.
10. Every Ask session appears automatically in Answers. Deleting from Answers
    requires explicit confirmation before the owned answer is removed.
11. Choosing `Done` from an active Ask session navigates to the corresponding
    read-only Answer page. That page contains neither a follow-up composer nor
    an `Ask a new question` button.
12. The Ask API continues to reject unsupported claims, returns stable failure
    codes, and never persists a partial assistant answer. Existing Ask error
    tests remain green.
13. At desktop width the Work log is the dominant column and Sources remains a
    viewport-height rail. At mobile width the full Work log and source list
    remain reachable in that order with 44px minimum targets.
14. `pnpm test`, `pnpm exec tsc --noEmit`, changed-file ESLint,
    `pnpm run design-check`, `pnpm run contrast-check`,
    `pnpm run verify-scales`, `git diff --check`, and `pnpm build` all pass, or
    any unrelated pre-existing repository failure is recorded with changed-file
    checks proving this work introduced none.

## Implementation plan

### Stage 1: Lock answer-domain behavior with regression tests

Files:

- Add `tests/answers-projection.test.ts`.
- Extend `tests/ask-context.test.ts`.
- Extend `tests/ask-errors.test.ts` and `tests/ask-delete.test.ts` only where the
  new resource boundary changes behavior.

Work:

1. Add fixtures for a single complete turn, multiple turns, an incomplete
   trailing question, an assistant error gap, no citations, and legacy saved
   conversations.
2. Test that the latest complete assistant message is canonical and previous
   pairs become activity.
3. Test `updatedAt` derivation and stable descending order.
4. Test prompt-context construction: latest answer can be supplied only as an
   untrusted draft, while earlier answers remain excluded as factual evidence.
5. Keep the existing cross-user and cross-project mutation tests as mandatory
   regression coverage.

Stage gate: focused answer/Ask tests fail for the intended missing behavior and
all unrelated existing tests still pass.

### Stage 2: Add the answer-domain projection and queries

Files:

- Add `lib/answers.ts`.
- Update `app/api/ask/deps.ts` only if injectable query seams are needed.
- Do not change `lib/db/schema.ts` or generate a migration in this stage.

Work:

1. Define application-facing `Citation`, `AnswerSummary`, `AnswerRevision`, and
   `AnswerPage` types.
2. Add pure message-to-answer projection helpers so canonical-answer rules are
   testable without React or a database.
3. Add project- and user-scoped list/get helpers. Fetch conversations and
   messages in bounded queries, then derive canonical answer, citations, and
   `updatedAt` without N+1 queries.
4. Centralize ownership verification for answer resources instead of copying
   the current conversation predicate into each route.

Stage gate: projection tests and ownership tests pass; query review confirms
every content read includes the verified project and current user boundary.

### Stage 3: Separate answer resources from Ask generation

Files:

- Add `app/api/answers/[id]/route.ts` for owned GET and DELETE.
- Refactor `app/api/ask/route.ts`.
- Update `tests/ask-errors.test.ts`, `tests/ask-delete.test.ts`, and add focused
  answer-resource route tests.

Work:

1. Keep `POST /api/ask` as the generation command. Accept `answerId` as the
   application-facing continuation key; temporarily accept `conversationId`
   as a compatibility alias, but reject requests that provide conflicting ids.
2. Emit an `answer` stream record with the stable id. The client may accept the
   old `conversation` event during the transition, but new code emits only the
   new domain term after all clients are updated.
3. Move single-answer read and delete behavior to the answer resource route.
   Preserve ownership gates and cascade semantics.
4. When following up, load the latest complete answer and recent questions.
   Construct a prompt that treats the latest answer as a draft to revise and
   the retrieved source chunks as the only evidence.
5. Persist the user question first, but publish a new canonical answer in the
   UI only after the assistant message has been fully generated and persisted.
   Keep the existing rule that partial assistant output is not stored.
6. Return explicit stable failure codes and an id so the client can retry the
   same answer rather than accidentally creating another answer page.

Stage gate: resource and Ask route tests prove ownership, compatibility,
complete-only publication, retry behavior, and evidence-only generation.

### Stage 4: Build stable Answers routes and compatibility redirects

Files:

- Add `app/p/[slug]/answers/page.tsx`.
- Add `app/p/[slug]/answers/[id]/page.tsx`.
- Replace `app/p/[slug]/chats/page.tsx` with a redirect.
- Remove `app/p/[slug]/chats/chat-archive.tsx` after its delete behavior and
  accessible row actions exist on the Answers index.
- Update `app/p/[slug]/page.tsx` to redirect legacy
  `?conversation=[id]` links and preserve `?q=` auto-submit.

Work:

1. Server-render the Answers index from the scoped answer query.
2. Server-render the stable read-only answer page using the same Work log and
   Sources hierarchy as Ask, without a streaming follow-up interaction.
3. Preserve old bookmarks through redirects; do not keep two live archive
   implementations.
4. Use `notFound()` for malformed, missing, foreign-user, and wrong-project
   answer ids after project validation.
5. Ensure `?q=` creates one answer and moves to the stable answer URL without
   duplicate submission under React Strict Mode.

Stage gate: route tests and a signed-in browser smoke prove reload, back/forward,
legacy redirects, not-found behavior, and one-time query submission.

### Stage 5: Replace the transcript with the answer-first surface

Files:

- Refactor and rename `app/ask-chat.tsx` to reflect answer semantics, updating
  its import in `app/p/[slug]/page.tsx`.
- Add only generally reusable missing UI behavior under `components/ui/`, and
  register it in `design-system/registry.json` plus
  `components/ui/README.md`. Prefer existing components; do not invent a
  view-local component.
- Update `app/sidebar.tsx`.
- Refresh `DESIGN.md` with `Answers` as a product surface and the answer-first
  Ask hierarchy.

Work:

1. Keep the empty Ask launcher and project overview.
2. Replace the transcript scroller with a continuous Work log: every question
   and saved answer is fully visible, the latest answer is the current
   revision, and Sources remains in its viewport-height rail.
3. Remove auto-scroll. Keep valid prior answer content visible while a follow-up
   streams into a pending replacement state.
4. Use a visibly labelled follow-up field and one primary `Update answer`
   action. Submit on Enter only when the multiline keyboard contract remains
   clear; Shift+Enter inserts a newline.
5. Render every saved question and generated answer in the same timeline used
   by Ask, without truncation, message bubbles, or speaker chrome.
6. Keep sources visible in the desktop rail. On mobile show source count and a
   labelled disclosure using an existing registered pattern.
7. Rename navigation and copy: `Chat archive` to `Answers`, `Chats` to
   `Answers`, `New chat` to `Ask a question`, and conversation deletion copy to
   answer deletion copy.
8. Do not label the feature `Wiki` in navigation during this round.

Stage gate: there is no visible chat terminology on Ask/Answers surfaces,
design-check passes for changed files, and responsive screenshots match the
content hierarchy in this plan.

### Stage 6: End-to-end verification and cleanup

1. Run focused answer-domain, Ask route, answer-resource, redirect, and client
   interaction tests.
2. Run the full automated verification commands from acceptance criterion 12.
3. Visually inspect at minimum:
   - empty Ask desktop and mobile;
   - first answer streaming and completed;
   - saved answer reload;
   - successful follow-up while prior answer remains visible;
   - failed follow-up preserving prior answer;
   - sources desktop rail and mobile disclosure;
   - the complete read-only Work log without a composer;
   - empty and populated Answers index;
   - legacy redirect and not-found answer.
4. Search changed product files for stale user-facing terms:
   `Chat`, `Chats`, `Chat archive`, `New chat`, `Conversation`, `Message`, and
   `Saved conversation`. Storage identifiers and compatibility comments are
   exempt.
5. Remove the compatibility `conversation` stream-event parser only after no
   shipped client still sends or expects it. Keep URL redirects for existing
   bookmarks.

Final gate: every acceptance criterion has fresh evidence, no scoped work
remains, and any pre-existing validation gap is explicitly documented.

## Risks and mitigations

### A follow-up produces a narrow answer rather than a revised page

Mitigation: treat the latest answer as a draft-to-revise, instruct the model to
return a complete standalone replacement, and test follow-ups such as “make it
shorter”, “add the caveat from source 3”, and “what about the Swedish market?”.

### A streaming failure blanks or corrupts the saved answer

Mitigation: retain the last complete assistant message as canonical, stream
into pending client state, never store partial assistant messages, and swap the
displayed answer only after persistence succeeds.

### Compatibility redirects leak whether an id exists in another project

Mitigation: resolve the owned project first, apply the same user/project/id
verification to every answer route, and render the same not-found outcome for
missing, malformed, foreign-user, and wrong-project ids.

### Product terminology changes while code retains legacy storage names

Mitigation: isolate storage terms in `lib/answers.ts` and compatibility code.
New UI, routes, types, tests, and API payloads use answer terminology. Document
the intentional physical-name compatibility boundary in `CLAUDE.md` if it
would otherwise confuse future implementers.

### Answers and Topics become competing knowledge structures

Mitigation: keep the jobs explicit. Answers are user-initiated cited syntheses;
Topics are system-generated clusters of captured items. Do not add answer
creation or editing to Topics in this round.

### Scope expands into a general wiki editor

Mitigation: manual body editing, backlinks, page merging, publishing, pinning,
and revision restore are out of scope. Record demand, then make a separate
schema decision using the triggers in “Why not a new wiki schema now”.

## Out of scope

- Renaming or migrating the `conversation` and `message` SQLite tables.
- Manual editing of the canonical answer body.
- Markdown authoring, slash commands, backlinks, or a page graph.
- Merging answers or converting Topics into answers.
- Background agents, tool-call timelines, task status, or notifications.
- New AI providers or dependencies.
- Changes to retrieval ranking, chunking, or embedding dimensions.

## Verification command set

```sh
pnpm test
pnpm exec tsc --noEmit
pnpm exec eslint <changed TypeScript files>
pnpm run design-check
pnpm run contrast-check
pnpm run verify-scales
git diff --check
pnpm build
```

The implementation report must include changed files, route compatibility,
test counts, visual states inspected, simplifications made, and remaining
risks. Do not claim completion from static review alone.
