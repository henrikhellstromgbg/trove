# intel import plan

Read-only audit of `~/intel/` and the Trove side, with a concrete import plan. No code was written and nothing was imported. `~/intel/` was opened read-only throughout and is never modified by this plan. Date: 2026-07-25.

Target of the import (from the live db):
- Clerk user id: `user_3DqlIZfN2t5EPsuMd8uHSJjRaLz`
- Project id: `ad42341f-b946-4b8e-bdf0-4c5abefd5b0c` (name `inbox`, slug `inbox`)

---

## 1. Source inventory summary

`~/intel/` is a machine-fed knowledge pipeline. Two independent corpora feed it.

**Corpus A, the kb pipeline** (`process_kb.py` + `sort_kb.py` + `watch_kb.py`, plus `ingest_newsletters.py`):
- Inputs: PDFs, docx, xlsx dropped into `raw/`, plus newsletters pulled from Apple Mail.
- `process_kb.py` extracts text with pypdf / python-docx / openpyxl to `processed/<name>.txt`, sends up to 80k chars to Claude Haiku for structured metadata to `index/<name>.json`, and aggregates every entry into `kb.json`.
- `sort_kb.py` then moves the real original file into `sorted/<source_type>/` and creates topic symlinks. The original binary is kept, relocated under `sorted/`.
- Dedup is by filename presence in `kb.json`.

**Corpus B, YouTube** (`youtube_transcript_miner.py`, nightly at 21:00 via launchd):
- Mines 12 SOF/tactical channels plus unit-specific searches, pulls auto-captions with yt-dlp, writes `youtube/yt_mined/transcripts/<video_id>.txt` (a `Title:` / `URL:` header then the caption text), and records per-video metadata in `results.json` keyed by `video_id`. `checkpoint.json` holds the set of already-processed video ids.
- These transcripts are NOT in `kb.json`. Only the transcript text is kept, never the video.

**Schedulers**
- `com.henrikhellstrom.watcher-kb` launchd agent: KeepAlive, RunAtLoad, runs `watch_kb.py`, logs to `logs/watch_kb.log`.
- `com.tacticalathlete.ytminer` launchd agent: 21:00 nightly, runs the miner with `--stop-hour 5 --min-relevance 5`, logs to `youtube/yt_mined/nightly.log`.
- crontab: newsletters Sundays 22:00.

**Counts and sizes**

| Area | Files | Size | Notes |
|---|---|---|---|
| `processed/` | 1,358 txt | 33 MB | extracted text, the kb item bodies |
| `index/` | 1,359 json | 5.3 MB | per-file kb metadata |
| `kb.json` | 1,360 entries | 2.1 MB | aggregate; 1 note-only excluded |
| `sorted/` | 1,396 | 927 MB | original PDFs/docx/xlsx + txt originals |
| `youtube/yt_mined/transcripts/` | 1,749 | 97 MB | transcript text |
| `raw/` | drained | 20 KB | drop zone, currently only `.DS_Store` |

kb originals by extension: 295 pdf, 1,035 txt (1,025 newsletters + ~10 text originals), 23 xlsx, 3 docx.

**Per source: is the raw original kept?**
- PDF / docx / xlsx: yes, original binary kept in `sorted/<source_type>/`. Plus extracted text in `processed/`.
- Newsletters: the `.emlx` stays in Apple Mail. intel keeps only a `.txt` rendering (in `sorted/` + `processed/`). No binary copied into intel.
- YouTube: only the transcript text. No audio or video.

**Config and dependencies**
- `intel/.env`: one key, `ANTHROPIC_API_KEY`. venv holds anthropic 0.93.0, pypdf 6.9.2, python-docx 1.2.0, openpyxl 3.1.5. No requirements.txt. External binaries: yt-dlp, ocrmypdf, tesseract.

**Security flag (not part of the import, but found during the walk):** the `com.henrikhellstrom.watcher-kb` launchd plist has a live `ANTHROPIC_API_KEY` hardcoded in plaintext in `~/Library/LaunchAgents/`. I did not reproduce the value. Worth rotating and moving to a file-referenced secret. Open question 7 below.

### Processing chain, end to end

```
PDFs/docx/xlsx ─┐
                ├─▶ raw/ ──▶ process_kb.py ──▶ processed/<name>.txt  (full text)
Apple Mail ─────┘            (pypdf/docx/     ──▶ index/<name>.json    (Haiku metadata)
 Newsletters.mbox            openpyxl +        ──▶ kb.json             (aggregate)
 → ingest_newsletters.py     Haiku)            ──▶ sort_kb.py ──▶ sorted/<type>/ (original)
   writes newsletter_*.txt                                       + sorted/<topic>/ symlinks

YouTube channels ──▶ youtube_transcript_miner.py ──▶ transcripts/<video_id>.txt (Title/URL + text)
 (nightly, yt-dlp)                                 ──▶ results.json (per-video metadata)
                                                   ──▶ checkpoint.json (done ids)
```

---

## 2. The numbers that decide the architecture

Per item character counts measured directly from the files. Chunk counts computed per item with the real config in `lib/ai/chunk.ts` (2000 target, 200 overlap, 1800 stride: `chunks = 1 if L≤2000 else 1 + ceil((L−2000)/1800)`), then summed. Not estimated from an average.

| Source bucket | Items | Total chars | Total words | Projected chunks | chars min / median / p90 / max |
|---|--:|--:|--:|--:|--|
| youtube | 1,749 | 51,892,129 | 9,918,343 | **29,550** | 127 / 5,198 / 109,135 / 626,609 |
| doc: official-military | 91 | 10,304,084 | 1,627,788 | 5,762 | 254 / 48,682 / 254,930 / 1,472,656 |
| doc: practitioner | 99 | 8,700,603 | 1,365,113 | 4,869 | 2,312 / 29,159 / 253,089 / 750,727 |
| doc: research-paper | 135 | 6,414,587 | 978,448 | 3,613 | 3,119 / 39,637 / 83,764 / 188,922 |
| newsletter | 1,025 | 5,960,668 | 746,286 | 3,709 | 250 / 4,028 / 11,768 / 39,853 |
| doc: other | 5 | 49,811 | 6,815 | 31 | 47 / 11,005 / 19,461 / 19,461 |
| doc: not-in-kb (orphan) | 1 | 37,998 | 6,126 | 21 | one processed txt with no kb entry |
| doc: unknown | 1 | 8,471 | 1,306 | 5 | |
| **TOTAL** | **3,106** | **83,368,351** | **14,650,225** | **47,560** | |

**Total projected chunk count for the full corpus: 47,560.**

YouTube dominates as expected: 62% of all chunks from 56% of items. YouTube chunk-count per item: median 3, p90 61, max 349. 222 YouTube items exceed 30 chunks, 192 exceed 50. The single largest item overall is an official-military doc at 1.47M chars, roughly 818 chunks on its own.

This 47,560 is a snapshot. The pipelines keep running: the miner adds videos nightly, newsletters weekly. The corpus crosses 50k chunks within days and keeps climbing.

---

## 3. Content samples and metadata union

Representative reads across sources.

**YouTube transcript** (`<video_id>.txt`): header is two lines, `Title: ...` and `URL: https://www.youtube.com/watch?v=...`, blank line, then caption text that still contains `&gt;&gt;` speaker markers and a `Kind: captions Language: en` lead-in. Auto-caption quality: unpunctuated, entity-escaped, no paragraph structure. No per-file metadata beyond the header; the structured metadata (relevance, hits, unit_slug, transcript_len) lives in `results.json` keyed by the filename stem.

**Newsletter** (`newsletter_<sender>_<date>_<subject>.txt`): a consistent header block written by the ingester (`From:`, `Subject:`, `Date:`, `Source:` = emlx name), blank line, then the cleaned body. The publication date and sender are real but embedded in body text, not structured fields. Curly quotes and unicode present, utf-8 clean.

**Document extract** (`processed/*.txt`): raw pypdf output. Heading structure loosely preserved, but ligature loss shows up ("a4er" for "after"), typical of PDF text extraction. No frontmatter in the txt; the metadata is in `index/<name>.json`.

**index json**: the gold. Fields `filename`, `measurement_origin`, `title`, `summary`, `topics[]`, `key_facts[]`, `source_type`. `key_facts` is a rich array of specific numbers (times, distances, records) worth preserving.

**Metadata field union across `index/*.json` (n=1,359):**

| Field | Frequency |
|---|---|
| filename | 100% |
| title | 100% (1,358) |
| summary | 100% (1,358) |
| topics | 100% (1,358) |
| key_facts | 100% (1,358) |
| source_type | 100% (1,358) |
| measurement_origin | 100% (1,354) |
| notes | 6 entries |
| note | 6 entries |
| exclusion_reason | 1 entry |
| documents | 1 entry |

So the kb side is highly consistent: seven fields present on essentially every entry, a long tail of three sporadic fields. YouTube has no equivalent per-file metadata; its reliable fields come from `results.json` (title, url, relevance, hit_count, unit_slug).

**Linking:** none between content files. No wikilinks, tags-in-body, or backlinks. `sorted/` topic membership is filesystem symlinks, not content links. kb `topics` is the only tag signal; YouTube items have none.

**Outliers that will break a naive import:**
- 149 MB PDF (`2012_Bahr_02.pdf`) and 36 MB PDF (`2024.pdf`) both exceed Trove's 32 MB ingest cap (`MAX_FILE_BYTES`). Their text is already extracted, so text import is fine; only the binary attachment fails.
- The 1.47M-char official-military doc (818 chunks) and 626k-char YouTube transcript (349 chunks) will overflow the single embedding call (see section 6).
- YouTube `&gt;` entity noise and PDF ligature loss are dirty but not fatal (utf-8, `errors="replace"`).
- One orphan `processed/` txt with no kb entry, and one `unknown` source_type. Minor.

---

## 4. The Trove side

**Schema** (`lib/db/schema.ts`, 16 tables). The item is the unit. `item` columns relevant to import: `id`, `userId`, `projectId`, `sourceId` (nullable), `externalId` (nullable), `type`, `source` (text, e.g. a URL or filename), `blobUrl` (file key), `rawText` (full text), `title`, `summary`, `tags` (json string[]), `status` (pending → processing → ready → failed/review/trashed), `capturedAt`, `processedAt`. Unique index `item_source_external_idx` on `(sourceId, externalId)`. `chunk` holds `itemId`, `userId`, `projectId`, `position`, `text`, `embedding` (Float32 blob, 768 dims), indexed on `(userId)`, `(userId, projectId)`, `(itemId)`. No ANN index.

**One document, write to read:**
1. `POST /api/ingest` (JSON `type:"text"`) inserts an `item` with `rawText`, `status:"pending"`, and fires an `item/captured` Inngest event. (Multipart file variant stores the file via `storeUpload`, sets `blobUrl` + `type`, same event.)
2. `ingestItem` (Inngest, `lib/inngest/functions.ts`, retries 3): marks processing, extracts text if the type needs it (url/pdf/image/docx/xlsx/textfile), else uses `rawText`; `chunkText(rawText)`; `embedTexts(chunks)` in ONE call; inserts all chunks with embeddings; `enrich(rawText)` (Haiku, truncates to 12,000 chars) sets title/summary/tags; marks `ready`; emits `item/ready`.
3. `item/ready` can trigger event pipelines. Read side: Library lists items (capped at 200), item detail renders `rawText`, `/ask` and pipelines retrieve chunks by brute-force cosine.

**File storage** (`lib/files.ts`): `storeUpload(name, bytes)` generates key `{uuid}-{sanitized name}`, runs `mkdir(filesDir(), {recursive:true})` (this is the defensive mkdir already in place), writes to `data/files/`, returns the key stored in `item.blobUrl`. Reads go through the ownership-checked `GET /api/items/[id]/blob`. **Routing every file write through `storeUpload` is feasible for bulk import**: it is a plain async function, one mkdir + one write per call, no batching limit. For a few hundred PDFs this is trivial. The only caveat is the 32 MB cap lives in the route, not in `storeUpload`, so a bulk importer that calls `storeUpload` directly must enforce its own size guard (or skip the 2 oversized PDFs).

**Existing ingest / bulk paths:** `/api/ingest` (JSON text/url + multipart file, token or Clerk auth) and the legacy `/api/capture`. There is no batch endpoint; bulk import means many calls to `/api/ingest`, or a dedicated script that inserts items and fires `item/captured` directly. Sources sync via `runSourceSync`; pipelines are user-defined recurring jobs (`pipeline.spec`) run by `runDuePipelines` (cron `*/10`) and `runEventPipelines` (on `item/ready`, 10-minute cooldown). The one existing pipeline is `weekly-digest` (`0 15 * * 5`).

**Tagging / linking / hierarchy / search:** tags are `item.tags` (json array, set by enrich). No item-to-item links. Hierarchy is project → item → chunk. Search is FTS5 (`item_fts` over title + rawText, bm25) plus brute-force vector over chunks. Topics are auto-clustered nightly (`clusterTopics`, cron `0 4`).

**Ownership at runtime:** the import must stamp every row with `userId = user_3DqlIZfN2t5EPsuMd8uHSJjRaLz` and `projectId = ad42341f-...`. Obtain them at runtime by querying `SELECT id, user_id FROM project WHERE slug='inbox'` (or by the id above), never by hardcoding. `/api/ingest` derives `userId` from auth and `projectId` from the token lock or the request; a direct-insert script reads them from the project row.

---

## 5. Scale assessment (real numbers)

Both retrieval call sites (`app/api/ask/route.ts:284`, `lib/pipelines/run.ts:130`) select every ready chunk for the (user, project) with `.limit(1_000_000)` and rank in JS. If the whole corpus lands in the single `inbox` project, one `/ask` query scans all 47,560 chunks.

Per-chunk cost: embedding blob 3,072 B (3 KiB) on the wire, decoded to a 768-element JS `number[]` at ~6 KiB. The scan also pulls `chunk.text`.

**One `/ask` query at 47,560 chunks in one project:**
- Embedding blobs materialized: 47,560 × 3 KiB ≈ **146 MB**.
- Chunk text materialized (the scan selects it): total chunk text ≈ 92.3M chars, as JS UTF-16 strings ≈ **185 MB**.
- `candidates` array resident ≈ **330 MB** before ranking.
- `rankByEmbedding` decodes every embedding to a 768 `number[]` in one synchronous map: 47,560 × 6 KiB ≈ **279 MB** of transient allocation and GC churn.
- Peak heap per single query ≈ **600 MB+**, on top of the Next dev + Inngest baseline.
- CPU: 47,560 × 768-dim cosine ≈ 36.5M dim-ops, the arithmetic is ~30 to 80 ms, but the 47,560 per-query decode allocations dominate. Realistically **300 ms to 1 s+ per query**, with GC pauses, plus reading 146 MB of blobs from SQLite each time. O(N), recomputed every query, growing nightly.

**Verdict: brute-force `/ask` does not comfortably survive this import into one project.** 47,560 chunks is already at the ~50k ceiling I flagged in preflight, and 600 MB spikes per query in a local Node process risk GC stalls and OOM when Next dev and Inngest run alongside. This is not a "later" problem; importing the whole corpus into `inbox` makes `/ask` heavy on day one.

Fix options, cheapest first (recommendation in section 7; not implemented, per your instruction):
1. **Stop materializing chunk text in the scan.** Change the retrieval SELECT to fetch `{id, itemId, embedding}` only, rank, take top-K, then fetch `text` for just those K rows. Removes the ~185 MB text load per query, dropping peak from ~600 MB to ~200 MB. Two small edits. Highest leverage, lowest risk.
2. **Cache decoded embeddings** (module-level, keyed by chunk id, stored as Float32Array) so 47k embeddings are not re-decoded every query. Cuts CPU and GC.
3. **FTS prefilter**: narrow candidate chunks via `item_fts` before cosine, bounding N per query. Changes recall (lexical gate before semantic), a product decision.
4. **Proper fix, later**: libSQL native vectors (`F32_BLOB` + ANN / `vector_top_k`) or the sqlite-vec extension. The durable answer from 50k to 500k chunks.

**FTS5 growth:** `item_fts` is a content-backed fts5 (the db shows `item_fts_content`, `_data`, `_docsize`, `_idx`), so it stores a second copy of the body (~83 MB of rawText) plus its index. Estimate **+120 to 160 MB** for FTS after import.

**Other unbounded or capped queries:** the two vector scans are the unbounded ones. `clusterTopics` loads all ready items but only id/title/summary (bounded columns), acceptable, though it re-embeds all ~3,106 summaries nightly. The **Library list is capped at `.limit(200)`** (`app/p/[slug]/library/page.tsx:57`): after import it silently shows only 200 of 3,106 items. That is an under-fetch, not a memory risk, but it means the Library needs pagination before the corpus is browsable.

**Projected database file size** (`data/trove.db`, currently ~0.3 MB):
- `item.rawText` ≈ 83 MB, `chunk.text` ≈ 92 MB, `chunk.embedding` ≈ 146 MB, FTS content + index ≈ 120 to 160 MB, item/chunk indexes ≈ 20 to 40 MB.
- **Total ≈ 460 to 520 MB, call it ~0.5 GB.** The WAL also balloons during the bulk insert; checkpoint after.

---

## 6. Embeddings

**How it works today** (`ingestItem` → `embed-chunks` step): `embedTexts(chunks)` calls Gemini `gemini-embedding-001` once with ALL chunks of an item as `contents`, 768 output dims (`lib/ai/embed.ts`). No internal batching, no per-call size guard. Error handling is Inngest's 3 retries on the step.

**Critical risk:** a single item's chunks all go in one `embedContent` call. Items with hundreds of chunks (max doc 818, max YouTube 349; 192 YouTube items over 50 chunks) will exceed Gemini's per-request count and token budget and return a hard 400. Inngest's 3 retries do not fix a 400, so those items dead-letter and never embed. **This must be fixed before import**: batch `embedTexts` to, say, ≤100 chunks per call in a loop. Small and safe, but blocking.

**Inngest dependency:** the Inngest dev server must be running locally for any item to process. `/api/ingest` fires `item/captured`; if Inngest is down the send fails (caught and logged) and there is no pending-item scanner to pick it up later, so items created while Inngest is down are stranded in `pending`. Queued work is not lost, but it does not self-heal; it needs a re-emit.

**Cost to embed the full corpus.** Total chunk text ≈ 92.3M chars ≈ **23.1M tokens** (≈4 chars/token). At the `gemini-embedding-001` published rate of about $0.15 per 1M input tokens: **≈ $3.5, ≈ 36 SEK** (10.4 SEK/USD). Even at double the rate, under 75 SEK. Confirm the current Gemini price before committing (open question 5). Calls: with ≤100-chunk batching, roughly 3,400 to 3,600 calls; embedding wall-clock is 30 to 60 min of the total.

**The real cost is enrichment, not embeddings.** The normal path runs `enrich(rawText)` (Haiku 4.5, ~3,000 input tokens truncated + ~300 output) on every item. For 3,106 items: ≈ 9.8M input + 0.9M output tokens ≈ **$14 to $15, ≈ 150 SEK**. And it is largely redundant: the 1,357 kb docs already carry a Haiku-made title/summary/topics in `kb.json`. Skipping enrich for those and running it only on the 1,749 YouTube items (which have none) roughly halves it. Decision in open questions.

**Full normal-path import ≈ $18, ≈ 190 SEK** (embeddings + enrich). Wall-clock is dominated by per-item LLM calls, not embeddings: at local Inngest concurrency, plan **1.5 to 3 hours** end to end, subject to Haiku/Gemini rate limits.

**Run embedding inside the import or as a backfill?** Recommendation: **inside the normal ingest path**, because chunk + embed + enrich are one Inngest step sequence and splitting them means reimplementing chunking outside the app. Drive the import as a throttled feeder into `/api/ingest` (or a direct-insert + `item/captured` emit) and let `ingestItem` do chunk/embed/enrich. Keep concurrency modest so the 600 MB-class memory pressure and the LLM rate limits stay bounded.

**Resume if it dies halfway.** Idempotence comes from the dedup key (section 7.6): re-running skips items already present. To find items still lacking embeddings: `items` whose `status != 'ready'`, or items with zero `chunk` rows (`LEFT JOIN chunk ... WHERE chunk.id IS NULL`). Re-emit `item/captured` for those ids. Because `ingestItem` early-returns on `status='ready'`, re-emitting is safe.

---

## 7. Field mapping, gaps, and strategy

### 7.1 Field mapping

| intel field | Trove column | Transform | Confidence | Notes |
|---|---|---|---|---|
| processed text (kb) / transcript text (yt) | `item.rawText` | copy as-is; chunk+embed downstream | high | the item body; no re-extraction needed for text |
| kb `filename` / yt `video_id` | `item.externalId` | use as stable external id | high | needs a `sourceId` too for the unique index to dedup |
| kb `title` | `item.title` | copy | high | already Haiku-made; skip enrich to keep it |
| kb `summary` | `item.summary` | copy | high | same |
| kb `topics[]` | `item.tags` | copy array | high | maps cleanly to tags |
| yt `title` (from header / results.json) | `item.title` | copy | high | |
| yt `url` | `item.source` | copy | high | `item.source` is free text, holds the URL |
| source origin (yt channel / newsletter sender / "intel-docs") | `item.source` or `item.tags` | derive | medium | no dedicated publisher column; see gap |
| kb `source_type` (official-military/research-paper/practitioner/other) | `item.tags` (prefixed) or new column | e.g. tag `type:official-military` | medium | no first-class column; see gap |
| kb `measurement_origin` (metric/imperial/unknown) | `item.tags` or new column | e.g. tag `unit:metric` | medium | no column; useful facet, would rather not bury in tags |
| kb `key_facts[]` | none | append to `rawText`, or new column | low | substantive; has no clean home, see gap |
| newsletter `Date` / doc pub date | `item.capturedAt`? | do NOT overload capturedAt | low | capturedAt is import time; real pub date has no column, see gap |
| yt `relevance`, `hit_count`, `unit_slug` | none | drop or JSON sidecar | low | miner-specific scoring; probably drop |
| original file path in `~/intel/` | none | new column, or `original_record.payload` | low | needed if we want a link back to the intel original |
| extraction tool (pypdf / yt-dlp) + version | none | new column | low | provenance; nice to have |
| item type (text/pdf/...) | `item.type` | set from source | high | `text` for transcripts/newsletters, or `pdf` if attaching binary |

### 7.2 Schema gaps and minimal migrations

Trove cannot natively represent several intel fields. Minimal additions (each an additive, nullable column, no backfill risk):

| Gap | Minimal migration |
|---|---|
| source type | `item.sourceType text` (nullable). Or fold into tags with a `type:` prefix and skip the migration. |
| source URL | none needed; `item.source` holds it. |
| original author / publisher / channel | `item.author text` (nullable). Newsletter sender, YouTube channel. |
| publication date separate from import date | `item.publishedAt integer timestamp_ms` (nullable). Do not overload `capturedAt`. |
| checksum (for dedup / re-run) | `item.checksum text` (nullable), sha256 of rawText or original bytes. Index it. |
| raw file reference (intel path) | `item.originalRef text` (nullable), the `~/intel/...` path, or use `original_record`. |
| extraction tool + version | `item.extractionTool text` (nullable). |
| key_facts | `item.keyFacts text json` (nullable) string[]. The one field with real content and no home. |
| measurement origin | `item.measurementOrigin text` (nullable), or a tag. |

Smallest viable set to make re-runs correct and preserve the gold: **`checksum` (or rely on sourceId+externalId), `publishedAt`, `author`, `keyFacts`.** The rest can start as tags. Confirm scope in open questions.

### 7.3 Attachment strategy

Default: copy raw PDFs into Trove's file storage via `storeUpload`, so Trove stands on its own. Originals stay in `~/intel/` regardless.

- **Size of that copy: 912 MB across 298 PDFs, plus 7 MB of xlsx/docx.** That roughly doubles the projected db-plus-files footprint (db ~0.5 GB + files ~0.92 GB ≈ **1.4 GB total** under `data/`).
- Two PDFs (149 MB, 36 MB) exceed the 32 MB cap. A direct `storeUpload` bypasses the route cap, so they *can* be copied, but decide deliberately: keep them, or reference in place.
- **Referencing in place is clearly better for YouTube and newsletters.** There is no binary to copy for either (transcript text and email text are the artifact). For those, no attachment; `item.source` holds the URL / sender.
- **For PDFs, recommendation:** attach the binaries (912 MB is acceptable local-first, and it makes the item detail view show the real source), but import the **already-extracted `processed/*.txt` as `rawText`** rather than re-extracting the PDF through Trove. That means a direct-insert importer (set both `rawText` from processed text and `blobUrl` from a `storeUpload` of the PDF), because the `/api/ingest` file route would re-extract and ignore the good text. If you would rather avoid 912 MB and the re-extraction question entirely, import text-only and leave PDFs in intel (open question 2).

### 7.4 Dedupe and re-run strategy

The intel pipelines keep running, so re-import must be idempotent and must pick up what the pipelines add later.

- Trove's dedup is `findDuplicate` on `(userId, sourceId, externalId)`, backed by the unique index `item_source_external_idx`. **It only works when `sourceId` is set.** With a null `sourceId`, re-import creates duplicates.
- Therefore create **synthetic `source` rows** to anchor dedup, one per stream: `intel-youtube`, `intel-newsletters`, `intel-docs` (or a single `intel-import`). Set them `enabled=false` (or `runtime='local'` with no `cron`) so `syncDueSources` never tries to run them; they exist only to give items a stable `sourceId`.
- Set `externalId` to the stream's stable id: YouTube `video_id`, kb `filename`. Then re-running the import skips anything already imported. A `checksum` column (7.2) additionally catches content changes to the same id.
- **Picking up new pipeline output:** the intel side keeps writing new `processed/*.txt`, new `index/*.json`, and new `transcripts/*.txt`. A re-run is a delta: enumerate current intel files, compute `(sourceId, externalId)`, insert only the ones not already present. This is a periodic sync, not a one-shot. Consider a Trove `source` of kind `folder_watch` pointed at `~/intel/` later, but for now a re-runnable importer script is simpler and matches the "keep intel authoritative" rule.
- Deletions on the intel side: `deletion_marker` exists but is source-scoped; do not attempt to mirror intel deletions in this phase. intel is append-mostly.

### 7.5 Scale verdict: what must be fixed before the import

Blocking, in order:
1. **Batch `embedTexts`** to ≤100 chunks per call. Without it, every large item (192 YouTube + several big docs) fails to embed. Small, safe, mandatory.
2. **Lighten the `/ask` retrieval scan** (section 5, option 1: drop chunk text from the scan, fetch text only for winners). At 47,560 chunks in one project, the current scan spikes ~600 MB per query. Option 1 alone takes it to ~200 MB and is a two-edit change. Strongly recommended before loading the corpus; at minimum before relying on `/ask` against it.

Not blocking, but do soon after:
3. **Paginate the Library** (currently `.limit(200)`), or it hides 2,900 items.
4. Consider embedding cache (option 2) and, later, a real vector index (option 4) as the corpus grows past this snapshot.

You said to leave `/ask` optimisation for your decision after this audit. Item 1 (embedding batch) is a different thing: it is a correctness bug at this scale, not an optimisation, and the import fails without it.

### 7.6 Embedding plan with the cost number

- Drive a throttled feeder into the normal ingest path so `ingestItem` does chunk + embed + enrich. Modest concurrency to bound memory and rate limits.
- Embeddings: ≈ 23.1M tokens, ≈ **$3.5 / 36 SEK** at the current published Gemini rate (confirm). Enrich (if not skipped): ≈ **$14 / 150 SEK**. Full path ≈ **$18 / 190 SEK**. Wall-clock **1.5 to 3 hours**.
- Resume: dedup key makes re-runs safe; find un-embedded items by `status != 'ready'` or zero chunk rows; re-emit `item/captured`.
- Run Inngest dev the whole time; nothing processes without it.

---

## 8. Open questions (please answer, I will not guess)

1. **One project or split?** Put all 3,106 items in the existing `inbox` project, or split (e.g. `intel-youtube` vs `intel-docs`) so no single `/ask` scans 47k chunks? This is the biggest lever on the scale problem.
2. **Attach PDFs or reference in place?** Copy 912 MB of PDFs into `data/files/` via `storeUpload` (item detail shows the real source, Trove is self-contained), or import text-only and leave binaries in `~/intel/`? And for the two >32 MB PDFs specifically: attach anyway (direct `storeUpload`) or skip?
3. **Enrich or reuse?** Re-run Trove's Haiku enrich on every item (~$14, uniform, re-titles kb docs), or reuse the existing `kb.json` title/summary/topics for the 1,357 docs and enrich only the 1,749 YouTube items (~half the cost, preserves your curated kb metadata)?
4. **Schema depth.** Add the minimal columns in 7.2 (`checksum`, `publishedAt`, `author`, `keyFacts` at least), or start tags-only and skip the migration? `keyFacts` is the one with real content and no home.
5. **Confirm the Gemini `gemini-embedding-001` price** so the cost number is firm. I used ~$0.15 / 1M input tokens.
6. **Synthetic sources.** OK to create disabled `source` rows (`intel-youtube`, `intel-newsletters`, `intel-docs`) purely to anchor dedup, given they will show up in the Sources UI? Or prefer a different dedup key (a `checksum` column with its own lookup, no source rows)?
7. **The hardcoded API key** in `com.henrikhellstrom.watcher-kb.plist`. Out of scope for the import, but do you want me to note it for rotation? I will not touch the plist.
8. **Fix ordering.** Confirm I may make the two blocking fixes (embedding batch; `/ask` scan lightening) as their own reviewed change *before* the import, or whether you want to decide each separately first.

---

Nothing here has been executed. Awaiting your answers before any code or import.
