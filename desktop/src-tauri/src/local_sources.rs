//! Local source runtime for the Trove menu-bar app.
//!
//! Reads ONLY the explicitly-approved local paths listed in the local source
//! registry (a JSON config file, never env), and posts new items through
//! `/api/ingest` with the ingest token and an explicit per-source projectId.
//! Idempotence comes from a local checkpoint store keyed by externalId. The
//! ingest token appears only in the `Authorization` header (via `send_ingest`);
//! the request body carries only extracted content (file bytes, or cleaned
//! subject/from/body). Local filesystem paths never leave the machine.
//!
//! The folder-watch selection/checkpoint semantics mirror
//! `lib/sources/folder-watch.ts` and the newsletter mail cleaning mirrors
//! `lib/sources/mail.ts`.

use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    env, fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::{
    content_type_for_path, send_ingest, FileIngestPayload, IngestConfig, JsonIngestPayload,
    PreparedIngest,
};

const REGISTRY_ENV: &str = "TROVE_LOCAL_SOURCES";
const CHECKPOINTS_ENV: &str = "TROVE_LOCAL_CHECKPOINTS";

const DEFAULT_FOLDER_WATCH_GLOBS: [&str; 6] = [
    "**/*.pdf",
    "**/*.txt",
    "**/*.md",
    "**/*.docx",
    "**/*.xlsx",
    "**/*.csv",
];

const DEFAULT_PROMO_BLOCKLIST: [&str; 4] = [
    "unsubscribe",
    "manage preferences",
    "view in browser",
    "update your preferences",
];

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

// Not Eq: the server-supplied `cursor` is an arbitrary JSON value (serde_json::
// Value), which is PartialEq but not Eq. PartialEq is all the tests need.
#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(tag = "kind")]
pub(crate) enum LocalSource {
    #[serde(rename = "folder_watch")]
    FolderWatch(FolderWatchSource),
    #[serde(rename = "mail_folder")]
    MailFolder(MailFolderSource),
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub(crate) struct FolderWatchSource {
    pub(crate) id: String,
    #[serde(rename = "projectId")]
    pub(crate) project_id: String,
    #[serde(rename = "folderPath")]
    pub(crate) folder_path: String,
    #[serde(default)]
    pub(crate) globs: Vec<String>,
    // Last checkpoint the server holds for this source. Used to seed the local
    // checkpoint on a machine that has never run this source, so it doesn't
    // re-import everything the first time. Ignored once a local checkpoint exists.
    #[serde(default)]
    pub(crate) cursor: Option<serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub(crate) struct MailFolderSource {
    pub(crate) id: String,
    #[serde(rename = "projectId")]
    pub(crate) project_id: String,
    #[serde(rename = "mboxPath")]
    pub(crate) mbox_path: String,
    #[serde(rename = "senderAllow", default)]
    pub(crate) sender_allow: Vec<String>,
    #[serde(rename = "senderBlock", default)]
    pub(crate) sender_block: Vec<String>,
    #[serde(rename = "promoBlocklist", default)]
    pub(crate) promo_blocklist: Vec<String>,
    #[serde(default)]
    pub(crate) cursor: Option<serde_json::Value>,
}

fn sources_from_values(entries: Vec<serde_json::Value>) -> Vec<LocalSource> {
    let mut sources = Vec::new();
    for entry in entries {
        match serde_json::from_value::<LocalSource>(entry.clone()) {
            Ok(source) => sources.push(source),
            Err(err) => {
                eprintln!("trove local sources: skipping malformed entry: {err} ({entry})");
            }
        }
    }
    sources
}

/// Parse the local registry file (a JSON array) into sources, skipping
/// malformed entries instead of failing the whole file. Only listed paths are
/// ever read.
pub(crate) fn parse_sources_json(text: &str) -> Vec<LocalSource> {
    match serde_json::from_str::<Vec<serde_json::Value>>(text) {
        Ok(entries) => sources_from_values(entries),
        Err(err) => {
            eprintln!("trove local sources registry is not a JSON array: {err}");
            Vec::new()
        }
    }
}

/// Parse the server registry response (`{ "sources": [...] }`) into sources.
/// The flat per-source shape matches the local file, so both paths yield the
/// same `LocalSource` values.
pub(crate) fn parse_sources_response(text: &str) -> Vec<LocalSource> {
    #[derive(Deserialize)]
    struct RegistryResponse {
        #[serde(default)]
        sources: Vec<serde_json::Value>,
    }
    match serde_json::from_str::<RegistryResponse>(text) {
        Ok(response) => sources_from_values(response.sources),
        Err(err) => {
            eprintln!(
                "trove local sources: server registry is not an object with a sources array: {err}"
            );
            Vec::new()
        }
    }
}

/// Fetch the approved source list from Trove. Returns None on any network or
/// HTTP failure so the caller can fall back to the local file. The ingest token
/// travels only in the Authorization header.
pub(crate) async fn fetch_remote_registry(
    client: &reqwest::Client,
    config: &IngestConfig,
    force_all: bool,
) -> Option<Vec<LocalSource>> {
    // Default poll asks the server for due sources only (schedule-driven). A
    // forced sync (`?all=1`) asks for every source and skips schedule advance.
    let url = if force_all {
        format!("{}?all=1", config.local_registry_url())
    } else {
        config.local_registry_url()
    };
    let response = client
        .get(url)
        .bearer_auth(config.ingest_token())
        .send()
        .await
        .ok()?;

    if !response.status().is_success() {
        eprintln!(
            "trove local sources: server registry returned HTTP {}",
            response.status()
        );
        return None;
    }

    let text = response.text().await.ok()?;
    Some(parse_sources_response(&text))
}

/// Best-effort cursor write-back. POSTs a source's checkpoint so `source.cursor`
/// persists server-side. Failures are logged, never fatal: the local checkpoint
/// remains the source of truth for this machine, so a failed push only loses
/// cross-machine resume, not idempotence here.
pub(crate) async fn push_cursor(
    client: &reqwest::Client,
    config: &IngestConfig,
    source_id: &str,
    cursor: serde_json::Value,
) -> bool {
    let body = serde_json::json!({ "sourceId": source_id, "cursor": cursor });
    match client
        .post(config.local_cursor_url())
        .bearer_auth(config.ingest_token())
        .json(&body)
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => true,
        Ok(response) => {
            eprintln!(
                "trove local sources: cursor write-back for {source_id} returned HTTP {}",
                response.status()
            );
            false
        }
        Err(err) => {
            eprintln!("trove local sources: cursor write-back for {source_id} failed: {err}");
            false
        }
    }
}

fn load_registry(path: &Path) -> Vec<LocalSource> {
    match fs::read_to_string(path) {
        Ok(text) => parse_sources_json(&text),
        Err(err) => {
            eprintln!(
                "trove local sources registry not read ({}): {err}",
                path.display()
            );
            Vec::new()
        }
    }
}

fn config_dir() -> PathBuf {
    let home = env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    home.join(".config").join("trove")
}

fn registry_path() -> PathBuf {
    match env::var_os(REGISTRY_ENV) {
        Some(value) if !value.is_empty() => PathBuf::from(value),
        _ => config_dir().join("local-sources.json"),
    }
}

fn checkpoint_dir() -> PathBuf {
    match env::var_os(CHECKPOINTS_ENV) {
        Some(value) if !value.is_empty() => PathBuf::from(value),
        _ => config_dir().join("checkpoints"),
    }
}

// ---------------------------------------------------------------------------
// Run results
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SourceRunResult {
    pub(crate) source_id: String,
    pub(crate) kind: &'static str,
    pub(crate) sent: usize,
    pub(crate) skipped: usize,
    pub(crate) errors: Vec<String>,
}

impl SourceRunResult {
    fn new(source_id: String, kind: &'static str) -> Self {
        Self {
            source_id,
            kind,
            sent: 0,
            skipped: 0,
            errors: Vec::new(),
        }
    }
}

/// Iterate the registry and run each source. Never panics; per-source and
/// per-item errors are collected and execution continues.
pub(crate) async fn run_local_sources_once(
    client: &reqwest::Client,
    config: &IngestConfig,
    force_all: bool,
) -> Vec<SourceRunResult> {
    // Prefer the server registry so approved sources are managed in Trove; fall
    // back to the local file when the server is unreachable (offline resilience).
    let sources = match fetch_remote_registry(client, config, force_all).await {
        Some(remote) => {
            eprintln!(
                "trove local sources: using server registry ({} sources)",
                remote.len()
            );
            remote
        }
        None => {
            let local = load_registry(&registry_path());
            eprintln!(
                "trove local sources: using local file fallback ({} sources)",
                local.len()
            );
            local
        }
    };
    let dir = checkpoint_dir();
    let mut results = Vec::new();

    for source in sources {
        let result = match source {
            LocalSource::FolderWatch(source) => {
                run_folder_watch(client, config, &source, &dir).await
            }
            LocalSource::MailFolder(source) => run_mail_folder(client, config, &source, &dir).await,
        };

        // Write the advanced cursor back only when this run imported something,
        // so idle ticks don't re-read a checkpoint or POST unchanged state.
        if result.sent > 0 {
            let cursor = match result.kind {
                "folder_watch" => {
                    serde_json::to_value(load_folder_checkpoint(&dir, &result.source_id, None)).ok()
                }
                "mail_folder" => {
                    serde_json::to_value(load_mail_checkpoint(&dir, &result.source_id, None)).ok()
                }
                _ => None,
            };
            if let Some(cursor) = cursor {
                push_cursor(client, config, &result.source_id, cursor).await;
            }
        }

        results.push(result);
    }

    results
}

// ---------------------------------------------------------------------------
// folder_watch runtime
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FolderCheckpointEntry {
    #[serde(rename = "modifiedAt")]
    modified_at: String,
    size: u64,
    #[serde(rename = "externalId")]
    external_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FolderWatchCheckpoint {
    version: u32,
    files: HashMap<String, FolderCheckpointEntry>,
}

impl Default for FolderWatchCheckpoint {
    fn default() -> Self {
        Self {
            version: 1,
            files: HashMap::new(),
        }
    }
}

struct FolderCandidate {
    path: PathBuf,
    relative_path: String,
    size: u64,
    modified_at: String,
}

struct PendingFolderIngest {
    path: PathBuf,
    relative_path: String,
    size: u64,
    modified_at: String,
    external_id: String,
}

pub(crate) async fn run_folder_watch(
    client: &reqwest::Client,
    config: &IngestConfig,
    source: &FolderWatchSource,
    checkpoint_dir: &Path,
) -> SourceRunResult {
    let mut result = SourceRunResult::new(source.id.clone(), "folder_watch");

    let root = PathBuf::from(&source.folder_path);
    if !root.is_dir() {
        result
            .errors
            .push(format!("folderPath is not a directory: {}", root.display()));
        return result;
    }

    let candidates = collect_folder_candidates(&root);
    let mut checkpoint = load_folder_checkpoint(checkpoint_dir, &source.id, source.cursor.as_ref());
    let pending = select_folder_files(&source.globs, candidates, &checkpoint);

    for file in pending {
        let file_name = match file.path.file_name() {
            Some(name) => name.to_string_lossy().into_owned(),
            None => {
                result
                    .errors
                    .push(format!("missing file name: {}", file.path.display()));
                continue;
            }
        };

        let payload = PreparedIngest::File(FileIngestPayload {
            mime_type: content_type_for_path(&file.path),
            path: file.path.clone(),
            file_name,
            project_id: source.project_id.clone(),
            source_id: Some(source.id.clone()),
            external_id: Some(file.external_id.clone()),
            captured_at: Some(file.modified_at.clone()),
        });

        match send_ingest(client, config, payload).await {
            Ok(()) => {
                checkpoint.files.insert(
                    file.relative_path.clone(),
                    FolderCheckpointEntry {
                        modified_at: file.modified_at.clone(),
                        size: file.size,
                        external_id: file.external_id.clone(),
                    },
                );
                if let Err(err) = save_folder_checkpoint(checkpoint_dir, &source.id, &checkpoint) {
                    eprintln!("trove local sources: checkpoint write failed: {err}");
                }
                result.sent += 1;
            }
            Err(err) => {
                result
                    .errors
                    .push(format!("post failed for {}: {err}", file.relative_path));
            }
        }
    }

    result
}

fn select_folder_files(
    globs: &[String],
    candidates: Vec<FolderCandidate>,
    checkpoint: &FolderWatchCheckpoint,
) -> Vec<PendingFolderIngest> {
    let effective: Vec<String> = if globs.is_empty() {
        DEFAULT_FOLDER_WATCH_GLOBS
            .iter()
            .map(|glob| glob.to_string())
            .collect()
    } else {
        globs.to_vec()
    };

    let mut selected: Vec<PendingFolderIngest> = candidates
        .into_iter()
        .filter(|candidate| matches_any_glob(&candidate.relative_path, &effective))
        .filter(
            |candidate| match checkpoint.files.get(&candidate.relative_path) {
                None => true,
                Some(previous) => {
                    previous.modified_at != candidate.modified_at || previous.size != candidate.size
                }
            },
        )
        .map(|candidate| {
            let external_id = format!(
                "{}:{}:{}",
                candidate.relative_path, candidate.size, candidate.modified_at
            );
            PendingFolderIngest {
                path: candidate.path,
                relative_path: candidate.relative_path,
                size: candidate.size,
                modified_at: candidate.modified_at,
                external_id,
            }
        })
        .collect();

    selected.sort_by(|a, b| {
        if a.modified_at == b.modified_at {
            a.relative_path.cmp(&b.relative_path)
        } else {
            a.modified_at.cmp(&b.modified_at)
        }
    });

    selected
}

fn collect_folder_candidates(root: &Path) -> Vec<FolderCandidate> {
    let mut out = Vec::new();
    let mut stack = vec![root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(err) => {
                eprintln!(
                    "trove local sources: read_dir failed ({}): {err}",
                    dir.display()
                );
                continue;
            }
        };

        for entry in entries.flatten() {
            let file_type = match entry.file_type() {
                Ok(file_type) => file_type,
                Err(_) => continue,
            };
            let path = entry.path();

            // file_type from read_dir does not follow symlinks, so symlinked
            // directories are treated as non-dirs and never recursed into,
            // avoiding traversal loops.
            if file_type.is_dir() {
                stack.push(path);
                continue;
            }
            if !file_type.is_file() {
                continue;
            }

            let meta = match fs::metadata(&path) {
                Ok(meta) => meta,
                Err(_) => continue,
            };
            let modified_at = match meta.modified().ok().map(format_system_time_iso) {
                Some(value) => value,
                None => continue,
            };
            let relative = match path.strip_prefix(root) {
                Ok(relative) => relative.to_string_lossy().into_owned(),
                Err(_) => continue,
            };

            out.push(FolderCandidate {
                path,
                relative_path: normalize_relative_path(&relative),
                size: meta.len(),
                modified_at,
            });
        }
    }

    out
}

// A local checkpoint file always wins. Only when none exists do we fall back to
// the server-supplied seed, so a fresh machine resumes instead of re-importing.
fn load_folder_checkpoint(
    dir: &Path,
    source_id: &str,
    seed: Option<&serde_json::Value>,
) -> FolderWatchCheckpoint {
    let path = dir.join(format!("{source_id}.json"));
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
        Err(_) => seed
            .and_then(|value| serde_json::from_value::<FolderWatchCheckpoint>(value.clone()).ok())
            .unwrap_or_default(),
    }
}

fn save_folder_checkpoint(
    dir: &Path,
    source_id: &str,
    checkpoint: &FolderWatchCheckpoint,
) -> std::io::Result<()> {
    fs::create_dir_all(dir)?;
    let path = dir.join(format!("{source_id}.json"));
    let json = serde_json::to_string_pretty(checkpoint)
        .map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err))?;
    fs::write(path, json)
}

// ---------------------------------------------------------------------------
// mail_folder runtime
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MailCheckpoint {
    version: u32,
    sent: Vec<String>,
}

impl Default for MailCheckpoint {
    fn default() -> Self {
        Self {
            version: 1,
            sent: Vec::new(),
        }
    }
}

pub(crate) async fn run_mail_folder(
    client: &reqwest::Client,
    config: &IngestConfig,
    source: &MailFolderSource,
    checkpoint_dir: &Path,
) -> SourceRunResult {
    let mut result = SourceRunResult::new(source.id.clone(), "mail_folder");

    let content = match fs::read_to_string(&source.mbox_path) {
        Ok(content) => content,
        Err(err) => {
            result
                .errors
                .push(format!("read mbox failed ({}): {err}", source.mbox_path));
            return result;
        }
    };

    let mut checkpoint = load_mail_checkpoint(checkpoint_dir, &source.id, source.cursor.as_ref());
    let mut seen: HashSet<String> = checkpoint.sent.iter().cloned().collect();

    for message in parse_mbox(&content) {
        let from = message.from.clone().unwrap_or_default();
        if !sender_allowed(&from, &source.sender_allow, &source.sender_block) {
            result.skipped += 1;
            continue;
        }

        let draft = match build_mail_draft(&message, &source.promo_blocklist) {
            Some(draft) => draft,
            None => {
                result.skipped += 1;
                continue;
            }
        };

        if seen.contains(&draft.external_id) {
            result.skipped += 1;
            continue;
        }

        let payload = PreparedIngest::Json(JsonIngestPayload {
            kind: "text",
            text: draft.text,
            project_id: source.project_id.clone(),
            source_id: Some(source.id.clone()),
            external_id: Some(draft.external_id.clone()),
            source: Some(draft.subject.clone()),
            captured_at: draft.captured_at,
        });

        match send_ingest(client, config, payload).await {
            Ok(()) => {
                if seen.insert(draft.external_id.clone()) {
                    checkpoint.sent.push(draft.external_id.clone());
                    if let Err(err) = save_mail_checkpoint(checkpoint_dir, &source.id, &checkpoint)
                    {
                        eprintln!("trove local sources: checkpoint write failed: {err}");
                    }
                }
                result.sent += 1;
            }
            Err(err) => {
                result
                    .errors
                    .push(format!("post failed for {}: {err}", draft.external_id));
            }
        }
    }

    result
}

fn load_mail_checkpoint(
    dir: &Path,
    source_id: &str,
    seed: Option<&serde_json::Value>,
) -> MailCheckpoint {
    let path = dir.join(format!("{source_id}.json"));
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
        Err(_) => seed
            .and_then(|value| serde_json::from_value::<MailCheckpoint>(value.clone()).ok())
            .unwrap_or_default(),
    }
}

fn save_mail_checkpoint(
    dir: &Path,
    source_id: &str,
    checkpoint: &MailCheckpoint,
) -> std::io::Result<()> {
    fs::create_dir_all(dir)?;
    let path = dir.join(format!("{source_id}.json"));
    let json = serde_json::to_string_pretty(checkpoint)
        .map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err))?;
    fs::write(path, json)
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ParsedMessage {
    message_id: Option<String>,
    from: Option<String>,
    subject: Option<String>,
    date: Option<String>,
    body: String,
}

struct MailDraft {
    external_id: String,
    text: String,
    subject: String,
    captured_at: Option<String>,
}

/// Split an mbox into messages. A line starting with `From ` at column 0
/// begins a new message; that envelope line is the separator, not a header.
fn parse_mbox(content: &str) -> Vec<ParsedMessage> {
    let mut blocks: Vec<Vec<&str>> = Vec::new();

    for line in content.split('\n') {
        if line.starts_with("From ") {
            blocks.push(Vec::new());
        }
        if let Some(last) = blocks.last_mut() {
            last.push(line);
        }
    }

    blocks
        .iter()
        .filter_map(|block| parse_message_block(block))
        .collect()
}

fn parse_message_block(lines: &[&str]) -> Option<ParsedMessage> {
    if lines.is_empty() {
        return None;
    }

    // Drop the mbox `From ` envelope line; the message itself follows.
    let rest = &lines[1..];
    let mut headers: Vec<(String, String)> = Vec::new();
    let mut current: Option<(String, String)> = None;
    let mut body_start = rest.len();

    for (index, &line) in rest.iter().enumerate() {
        let trimmed_line = line.trim_end_matches('\r');
        if trimmed_line.is_empty() {
            body_start = index + 1;
            break;
        }

        if (line.starts_with(' ') || line.starts_with('\t')) && current.is_some() {
            if let Some(entry) = current.as_mut() {
                entry.1.push(' ');
                entry.1.push_str(trimmed_line.trim());
            }
        } else if let Some(colon) = line.find(':') {
            if let Some(previous) = current.take() {
                headers.push(previous);
            }
            let name = line[..colon].trim().to_lowercase();
            let value = line[colon + 1..].trim().to_string();
            current = Some((name, value));
        }
    }
    if let Some(previous) = current.take() {
        headers.push(previous);
    }

    let body = if body_start < rest.len() {
        rest[body_start..].join("\n")
    } else {
        String::new()
    };

    let get = |key: &str| {
        headers
            .iter()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value.clone())
    };

    Some(ParsedMessage {
        message_id: get("message-id"),
        from: get("from"),
        subject: get("subject"),
        date: get("date"),
        body,
    })
}

fn build_mail_draft(message: &ParsedMessage, promo_blocklist: &[String]) -> Option<MailDraft> {
    let external_id = normalize_message_id(message.message_id.as_deref().unwrap_or(""));
    if external_id.is_empty() {
        return None;
    }

    let subject = {
        let normalized = normalize_inline_text(message.subject.as_deref().unwrap_or(""));
        if normalized.is_empty() {
            "(no subject)".to_string()
        } else {
            normalized
        }
    };

    let (name, address) = parse_sender(message.from.as_deref().unwrap_or(""));
    let body = clean_mail_body(&message.body, promo_blocklist);
    if body.is_empty() {
        return None;
    }

    let sender_line = format_sender_line(name.as_deref(), address.as_deref());
    let mut parts: Vec<String> = vec![format!("Subject: {subject}")];
    if !sender_line.is_empty() {
        parts.push(sender_line);
    }
    parts.push(String::new());
    parts.push(body);
    let text = parts.join("\n");

    let captured_at = message.date.as_deref().and_then(parse_rfc2822_to_rfc3339);

    Some(MailDraft {
        external_id,
        text,
        subject,
        captured_at,
    })
}

fn sender_allowed(from: &str, allow: &[String], block: &[String]) -> bool {
    let haystack = from.to_lowercase();

    if !allow.is_empty() {
        let matched = allow.iter().any(|entry| {
            let needle = entry.trim().to_lowercase();
            !needle.is_empty() && haystack.contains(&needle)
        });
        if !matched {
            return false;
        }
    }

    let blocked = block.iter().any(|entry| {
        let needle = entry.trim().to_lowercase();
        !needle.is_empty() && haystack.contains(&needle)
    });

    !blocked
}

fn normalize_message_id(value: &str) -> String {
    let trimmed = value.trim();
    let trimmed = trimmed.strip_prefix('<').unwrap_or(trimmed);
    let trimmed = trimmed.strip_suffix('>').unwrap_or(trimmed);
    trimmed.to_string()
}

fn normalize_inline_text(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn parse_sender(value: &str) -> (Option<String>, Option<String>) {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return (None, None);
    }

    // Mirror /^(?:"?([^"<]+)"?\s*)?<([^>]+)>$/ : an optional name followed by
    // an angle-bracketed address at the end of the string.
    if trimmed.ends_with('>') {
        if let Some(open) = trimmed.find('<') {
            let address_raw = &trimmed[open + 1..trimmed.len() - 1];
            let name_part = &trimmed[..open];
            if !address_raw.is_empty() && !address_raw.contains('>') && !name_part.contains('<') {
                let name = name_part.trim().trim_matches('"').trim();
                let name = if name.is_empty() {
                    None
                } else {
                    Some(name.to_string())
                };
                let address_clean = address_raw.trim().to_lowercase();
                let address = if address_clean.is_empty() {
                    None
                } else {
                    Some(address_clean)
                };
                return (name, address);
            }
        }
    }

    if trimmed.contains('@') {
        return (None, Some(trimmed.to_lowercase()));
    }

    (Some(trimmed.to_string()), None)
}

fn format_sender_line(name: Option<&str>, address: Option<&str>) -> String {
    match (name, address) {
        (Some(name), Some(address)) => format!("From: {name} <{address}>"),
        (None, Some(address)) => format!("From: {address}"),
        (Some(name), None) => format!("From: {name}"),
        (None, None) => String::new(),
    }
}

fn clean_mail_body(value: &str, promo_blocklist: &[String]) -> String {
    let mut blocked: Vec<String> = DEFAULT_PROMO_BLOCKLIST
        .iter()
        .map(|phrase| phrase.to_string())
        .collect();
    for entry in promo_blocklist {
        let trimmed = entry.trim();
        if !trimmed.is_empty() {
            blocked.push(trimmed.to_string());
        }
    }
    let blocked: Vec<String> = blocked.iter().map(|phrase| phrase.to_lowercase()).collect();

    let normalized = value
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .replace('\u{0000}', "");

    let kept: Vec<String> = normalized
        .split('\n')
        .map(|line| line.replace('\t', " ").trim_end().to_string())
        .filter(|line| !is_blocked_line(line, &blocked))
        .collect();

    collapse_blank_lines(&kept.join("\n")).trim().to_string()
}

fn is_blocked_line(line: &str, blocked: &[String]) -> bool {
    let normalized = line.trim().to_lowercase();
    if normalized.is_empty() {
        return false;
    }
    blocked.iter().any(|phrase| normalized.contains(phrase))
}

/// Collapse runs of 3+ newlines down to 2 (mirrors `\n{3,}` -> `\n\n`).
fn collapse_blank_lines(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut newlines = 0;
    for ch in value.chars() {
        if ch == '\n' {
            newlines += 1;
            if newlines <= 2 {
                out.push('\n');
            }
        } else {
            newlines = 0;
            out.push(ch);
        }
    }
    out
}

// ---------------------------------------------------------------------------
// Path + time helpers
// ---------------------------------------------------------------------------

fn normalize_relative_path(value: &str) -> String {
    let replaced = value.replace('\\', "/");
    // Mirror /^\.?\//: strip a leading "./" or "/".
    let stripped = if let Some(rest) = replaced.strip_prefix("./") {
        rest
    } else if let Some(rest) = replaced.strip_prefix('/') {
        rest
    } else {
        replaced.as_str()
    };
    stripped.trim().to_string()
}

fn matches_any_glob(path: &str, globs: &[String]) -> bool {
    globs
        .iter()
        .any(|glob| match_glob(&normalize_relative_path(glob), path))
}

fn match_glob(glob: &str, path: &str) -> bool {
    let glob_segments: Vec<&str> = glob.split('/').filter(|s| !s.is_empty()).collect();
    let path_segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    match_glob_segments(&glob_segments, &path_segments)
}

fn match_glob_segments(glob_segments: &[&str], path_segments: &[&str]) -> bool {
    if glob_segments.is_empty() {
        return path_segments.is_empty();
    }

    let segment = glob_segments[0];
    let rest = &glob_segments[1..];

    if segment == "**" {
        if match_glob_segments(rest, path_segments) {
            return true;
        }
        if path_segments.is_empty() {
            return false;
        }
        return match_glob_segments(glob_segments, &path_segments[1..]);
    }

    if path_segments.is_empty() {
        return false;
    }
    if !match_segment(segment, path_segments[0]) {
        return false;
    }
    match_glob_segments(rest, &path_segments[1..])
}

/// Case-insensitive wildcard match within a single path segment. `*` matches
/// any run of characters and `?` matches exactly one; everything else is
/// literal. Mirrors matchSegment's regex behavior (`*`->`[^/]*`, `?`->`[^/]`).
fn match_segment(glob: &str, value: &str) -> bool {
    let pattern: Vec<char> = glob.to_lowercase().chars().collect();
    let text: Vec<char> = value.to_lowercase().chars().collect();

    let (mut p, mut t) = (0usize, 0usize);
    let mut star: Option<usize> = None;
    let mut star_text = 0usize;

    while t < text.len() {
        if p < pattern.len() && (pattern[p] == '?' || pattern[p] == text[t]) {
            p += 1;
            t += 1;
        } else if p < pattern.len() && pattern[p] == '*' {
            star = Some(p);
            star_text = t;
            p += 1;
        } else if let Some(star_p) = star {
            p = star_p + 1;
            star_text += 1;
            t = star_text;
        } else {
            return false;
        }
    }

    while p < pattern.len() && pattern[p] == '*' {
        p += 1;
    }
    p == pattern.len()
}

/// Format a SystemTime as an ISO-8601 UTC string with millisecond precision,
/// matching JavaScript's `Date.toISOString()` (e.g. `2023-07-12T10:30:00.000Z`).
fn format_system_time_iso(time: SystemTime) -> String {
    let duration = time.duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = duration.as_secs() as i64;
    let millis = duration.subsec_millis();

    let days = secs.div_euclid(86_400);
    let seconds_of_day = secs.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    let hour = seconds_of_day / 3_600;
    let minute = (seconds_of_day % 3_600) / 60;
    let second = seconds_of_day % 60;

    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{millis:03}Z")
}

/// Convert a count of days since the Unix epoch into a civil (year, month, day)
/// using Howard Hinnant's algorithm.
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097; // [0, 146096]
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let day = (doy - (153 * mp + 2) / 5 + 1) as u32; // [1, 31]
    let month = if mp < 10 { mp + 3 } else { mp - 9 } as u32; // [1, 12]
    let year = if month <= 2 { year + 1 } else { year };
    (year, month, day)
}

/// Parse an RFC-2822 date header into an RFC-3339 timestamp, preserving the
/// numeric offset (a valid instant that the server's `new Date()` accepts).
/// Returns None when the value cannot be parsed.
fn parse_rfc2822_to_rfc3339(value: &str) -> Option<String> {
    let mut tokens: Vec<&str> = value.split_whitespace().collect();
    if tokens.is_empty() {
        return None;
    }
    // Drop an optional leading day-of-week ("Wed,").
    if tokens[0].ends_with(',') {
        tokens.remove(0);
    }
    if tokens.len() < 4 {
        return None;
    }

    let day: u32 = tokens[0].parse().ok()?;
    let month = month_number(tokens[1])?;
    let year = parse_year(tokens[2])?;
    let (hour, minute, second) = parse_time(tokens[3])?;
    let offset_minutes = if tokens.len() >= 5 {
        parse_zone(tokens[4]).unwrap_or(0)
    } else {
        0
    };

    if day < 1 || day > 31 || hour > 23 || minute > 59 || second > 60 {
        return None;
    }

    let sign = if offset_minutes < 0 { '-' } else { '+' };
    let abs = offset_minutes.abs();
    Some(format!(
        "{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}{sign}{:02}:{:02}",
        abs / 60,
        abs % 60
    ))
}

fn month_number(token: &str) -> Option<u32> {
    match token.to_lowercase().as_str() {
        "jan" => Some(1),
        "feb" => Some(2),
        "mar" => Some(3),
        "apr" => Some(4),
        "may" => Some(5),
        "jun" => Some(6),
        "jul" => Some(7),
        "aug" => Some(8),
        "sep" => Some(9),
        "oct" => Some(10),
        "nov" => Some(11),
        "dec" => Some(12),
        _ => None,
    }
}

fn parse_year(token: &str) -> Option<i64> {
    let year: i64 = token.parse().ok()?;
    if token.len() <= 2 {
        Some(if year >= 50 { 1900 + year } else { 2000 + year })
    } else {
        Some(year)
    }
}

fn parse_time(token: &str) -> Option<(u32, u32, u32)> {
    let parts: Vec<&str> = token.split(':').collect();
    if parts.len() < 2 {
        return None;
    }
    let hour: u32 = parts[0].parse().ok()?;
    let minute: u32 = parts[1].parse().ok()?;
    let second: u32 = if parts.len() >= 3 {
        parts[2].parse().ok()?
    } else {
        0
    };
    Some((hour, minute, second))
}

fn parse_zone(token: &str) -> Option<i32> {
    let token = token.trim();
    let bytes = token.as_bytes();
    if bytes.len() == 5 && (bytes[0] == b'+' || bytes[0] == b'-') {
        let sign = if bytes[0] == b'-' { -1 } else { 1 };
        let hours: i32 = token[1..3].parse().ok()?;
        let minutes: i32 = token[3..5].parse().ok()?;
        return Some(sign * (hours * 60 + minutes));
    }

    match token.to_uppercase().as_str() {
        "UT" | "GMT" | "UTC" | "Z" => Some(0),
        "EST" => Some(-300),
        "EDT" => Some(-240),
        "CST" => Some(-360),
        "CDT" => Some(-300),
        "MST" => Some(-420),
        "MDT" => Some(-360),
        "PST" => Some(-480),
        "PDT" => Some(-420),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checkpoint_loaders_seed_from_server_cursor_only_without_a_local_file() {
        // A nonexistent dir guarantees the local-file read misses, exercising the
        // seed fallback. Both loaders should adopt the server cursor.
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time should advance")
            .as_nanos();
        let dir = env::temp_dir().join(format!("trove-seed-test-{nanos}-absent"));

        // The seed mirrors what the daemon pushes: a serialized checkpoint,
        // version field included.
        let mail_seed = serde_json::json!({ "version": 1, "sent": ["msg-1", "msg-2"] });
        let mail = load_mail_checkpoint(&dir, "src-mail", Some(&mail_seed));
        assert_eq!(mail.sent, vec!["msg-1".to_string(), "msg-2".to_string()]);

        let folder_seed = serde_json::json!({
            "version": 1,
            "files": { "a.pdf": { "modifiedAt": "2026-01-01T00:00:00.000Z", "size": 3, "externalId": "ext-a" } }
        });
        let folder = load_folder_checkpoint(&dir, "src-folder", Some(&folder_seed));
        assert!(folder.files.contains_key("a.pdf"));
        assert_eq!(folder.files["a.pdf"].external_id, "ext-a");

        // No seed and no local file falls back to an empty checkpoint.
        assert!(load_mail_checkpoint(&dir, "src-none", None).sent.is_empty());
        assert!(load_folder_checkpoint(&dir, "src-none", None)
            .files
            .is_empty());
    }

    #[test]
    fn parses_registry_and_skips_malformed_entries() {
        let json = r#"[
            {
                "id": "11111111-1111-1111-1111-111111111111",
                "kind": "folder_watch",
                "projectId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                "folderPath": "/approved/folder"
            },
            {
                "id": "22222222-2222-2222-2222-222222222222",
                "kind": "mail_folder",
                "projectId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                "mboxPath": "/approved/mail.mbox",
                "senderAllow": ["news@"],
                "senderBlock": [],
                "promoBlocklist": ["sponsored"]
            },
            { "kind": "folder_watch", "projectId": "x" },
            { "kind": "unknown_kind", "id": "z", "projectId": "y" },
            "not-an-object"
        ]"#;

        let sources = parse_sources_json(json);
        assert_eq!(sources.len(), 2);

        match &sources[0] {
            LocalSource::FolderWatch(source) => {
                assert_eq!(source.id, "11111111-1111-1111-1111-111111111111");
                assert_eq!(source.folder_path, "/approved/folder");
                // Only the listed path is used; globs default when omitted.
                assert!(source.globs.is_empty());
            }
            _ => panic!("expected folder_watch first"),
        }
        match &sources[1] {
            LocalSource::MailFolder(source) => {
                assert_eq!(source.mbox_path, "/approved/mail.mbox");
                assert_eq!(source.sender_allow, vec!["news@".to_string()]);
                assert_eq!(source.promo_blocklist, vec!["sponsored".to_string()]);
            }
            _ => panic!("expected mail_folder second"),
        }
    }

    #[test]
    fn parses_server_registry_response() {
        // Flat per-source shape from GET /api/sources/local, including extra
        // name/cursor fields the daemon ignores.
        let json = r#"{ "sources": [
            { "id": "s1", "kind": "folder_watch", "projectId": "p1",
              "folderPath": "/drop", "globs": ["**/*.pdf"], "name": "Drop", "cursor": null },
            { "id": "s2", "kind": "mail_folder", "projectId": "p1",
              "mboxPath": "/mail.mbox", "senderAllow": ["news@"], "senderBlock": [],
              "promoBlocklist": [], "name": "Mail" },
            { "id": "bad", "kind": "unknown_kind", "projectId": "p1" }
        ] }"#;

        let sources = parse_sources_response(json);
        assert_eq!(sources.len(), 2);
        match &sources[0] {
            LocalSource::FolderWatch(s) => {
                assert_eq!(s.folder_path, "/drop");
                assert_eq!(s.globs, vec!["**/*.pdf".to_string()]);
            }
            _ => panic!("expected folder_watch first"),
        }
        match &sources[1] {
            LocalSource::MailFolder(s) => {
                assert_eq!(s.mbox_path, "/mail.mbox");
                assert_eq!(s.sender_allow, vec!["news@".to_string()]);
            }
            _ => panic!("expected mail_folder second"),
        }
    }

    #[test]
    fn empty_or_malformed_server_response_yields_no_sources() {
        assert!(parse_sources_response("{}").is_empty());
        assert!(parse_sources_response("not json").is_empty());
    }

    #[test]
    fn glob_matching_mirrors_folder_watch() {
        let globs = vec!["**/*.pdf".to_string(), "**/*.md".to_string()];
        assert!(matches_any_glob("notes/report.pdf", &globs));
        assert!(matches_any_glob("a/b/c/deep.PDF", &globs)); // case-insensitive
        assert!(matches_any_glob("readme.md", &globs));
        assert!(!matches_any_glob("archive.zip", &globs));
        assert!(!matches_any_glob("image.pdf.bak", &globs));

        // `*` stays within a segment.
        let single = vec!["*.txt".to_string()];
        assert!(matches_any_glob("top.txt", &single));
        assert!(!matches_any_glob("nested/top.txt", &single));
    }

    #[test]
    fn select_folder_files_skips_unchanged_and_builds_external_id() {
        let candidates = vec![
            FolderCandidate {
                path: PathBuf::from("/root/new.pdf"),
                relative_path: "new.pdf".to_string(),
                size: 10,
                modified_at: "2023-01-02T00:00:00.000Z".to_string(),
            },
            FolderCandidate {
                path: PathBuf::from("/root/old.pdf"),
                relative_path: "old.pdf".to_string(),
                size: 20,
                modified_at: "2023-01-01T00:00:00.000Z".to_string(),
            },
            FolderCandidate {
                path: PathBuf::from("/root/skip.zip"),
                relative_path: "skip.zip".to_string(),
                size: 5,
                modified_at: "2023-01-03T00:00:00.000Z".to_string(),
            },
        ];

        let mut checkpoint = FolderWatchCheckpoint::default();
        checkpoint.files.insert(
            "old.pdf".to_string(),
            FolderCheckpointEntry {
                modified_at: "2023-01-01T00:00:00.000Z".to_string(),
                size: 20,
                external_id: "old.pdf:20:2023-01-01T00:00:00.000Z".to_string(),
            },
        );

        let globs = vec!["**/*.pdf".to_string()];
        let selected = select_folder_files(&globs, candidates, &checkpoint);

        // .zip excluded by glob; old.pdf unchanged in checkpoint; only new.pdf.
        assert_eq!(selected.len(), 1);
        assert_eq!(selected[0].relative_path, "new.pdf");
        assert_eq!(
            selected[0].external_id,
            "new.pdf:10:2023-01-02T00:00:00.000Z"
        );
    }

    #[test]
    fn select_folder_files_sorts_by_modified_then_path() {
        let candidates = vec![
            FolderCandidate {
                path: PathBuf::from("/root/b.txt"),
                relative_path: "b.txt".to_string(),
                size: 1,
                modified_at: "2023-01-02T00:00:00.000Z".to_string(),
            },
            FolderCandidate {
                path: PathBuf::from("/root/a.txt"),
                relative_path: "a.txt".to_string(),
                size: 1,
                modified_at: "2023-01-01T00:00:00.000Z".to_string(),
            },
            FolderCandidate {
                path: PathBuf::from("/root/c.txt"),
                relative_path: "c.txt".to_string(),
                size: 1,
                modified_at: "2023-01-01T00:00:00.000Z".to_string(),
            },
        ];

        let selected = select_folder_files(&[], candidates, &FolderWatchCheckpoint::default());
        let order: Vec<&str> = selected.iter().map(|s| s.relative_path.as_str()).collect();
        assert_eq!(order, vec!["a.txt", "c.txt", "b.txt"]);
    }

    #[test]
    fn parse_mbox_splits_messages_and_headers() {
        let mbox = "From sender@example.com Mon Jan  1 00:00:00 2023\r\n\
Message-ID: <abc123@example.com>\r\n\
From: \"Jane Doe\" <jane@news.example.com>\r\n\
Subject: Weekly digest\r\n\
Date: Wed, 12 Jul 2023 10:30:00 +0000\r\n\
\r\n\
Hello there.\r\n\
Unsubscribe here to stop.\r\n\
Real content line.\r\n\
From someoneelse@example.com Tue Jan  2 00:00:00 2023\r\n\
Message-ID: <second@example.com>\r\n\
From: promo@spam.example.com\r\n\
Subject: Buy now\r\n\
\r\n\
Second body.\r\n";

        let messages = parse_mbox(mbox);
        assert_eq!(messages.len(), 2);
        assert_eq!(
            messages[0].message_id.as_deref(),
            Some("<abc123@example.com>")
        );
        assert_eq!(messages[0].subject.as_deref(), Some("Weekly digest"));
        assert!(messages[0].body.contains("Real content line."));
    }

    #[test]
    fn build_mail_draft_cleans_body_and_formats_text() {
        let message = ParsedMessage {
            message_id: Some("<abc123@example.com>".to_string()),
            from: Some("\"Jane Doe\" <Jane@News.Example.com>".to_string()),
            subject: Some("Weekly   digest".to_string()),
            date: Some("Wed, 12 Jul 2023 10:30:00 +0000".to_string()),
            body: "Hello there.\n\n\n\nUnsubscribe here to stop.\nReal content line.".to_string(),
        };

        let draft = build_mail_draft(&message, &[]).expect("draft should build");
        assert_eq!(draft.external_id, "abc123@example.com");
        assert_eq!(draft.subject, "Weekly digest");
        assert_eq!(
            draft.captured_at.as_deref(),
            Some("2023-07-12T10:30:00+00:00")
        );
        assert_eq!(
            draft.text,
            "Subject: Weekly digest\nFrom: Jane Doe <jane@news.example.com>\n\nHello there.\n\nReal content line."
        );
        // Promo line dropped, blank runs collapsed.
        assert!(!draft.text.contains("Unsubscribe"));
    }

    #[test]
    fn build_mail_draft_requires_message_id_and_body() {
        let no_id = ParsedMessage {
            message_id: None,
            from: Some("a@b.com".to_string()),
            subject: Some("x".to_string()),
            date: None,
            body: "content".to_string(),
        };
        assert!(build_mail_draft(&no_id, &[]).is_none());

        let empty_body = ParsedMessage {
            message_id: Some("<id@x>".to_string()),
            from: Some("a@b.com".to_string()),
            subject: Some("x".to_string()),
            date: None,
            body: "Unsubscribe".to_string(),
        };
        assert!(build_mail_draft(&empty_body, &[]).is_none());
    }

    #[test]
    fn sender_allow_and_block_filter() {
        let allow = vec!["news@".to_string()];
        let block = vec!["spam".to_string()];
        assert!(sender_allowed("Jane <news@example.com>", &allow, &block));
        assert!(!sender_allowed("Other <other@example.com>", &allow, &block));
        assert!(!sender_allowed(
            "News <news@spam.example.com>",
            &allow,
            &block
        ));
        // Empty allow list = allow all (except blocks).
        assert!(sender_allowed("anyone@x.com", &[], &block));
        assert!(!sender_allowed("a@spam.com", &[], &block));
    }

    #[test]
    fn parse_sender_variants() {
        assert_eq!(
            parse_sender("\"Jane Doe\" <Jane@X.com>"),
            (Some("Jane Doe".to_string()), Some("jane@x.com".to_string()))
        );
        assert_eq!(
            parse_sender("<bob@x.com>"),
            (None, Some("bob@x.com".to_string()))
        );
        assert_eq!(
            parse_sender("plain@x.com"),
            (None, Some("plain@x.com".to_string()))
        );
        assert_eq!(
            parse_sender("Just A Name"),
            (Some("Just A Name".to_string()), None)
        );
    }

    #[test]
    fn normalize_message_id_strips_brackets() {
        assert_eq!(normalize_message_id("  <abc@x>  "), "abc@x");
        assert_eq!(normalize_message_id("abc@x"), "abc@x");
        assert_eq!(normalize_message_id("<abc@x"), "abc@x");
    }

    #[test]
    fn parse_rfc2822_dates() {
        assert_eq!(
            parse_rfc2822_to_rfc3339("Wed, 12 Jul 2023 10:30:00 +0000").as_deref(),
            Some("2023-07-12T10:30:00+00:00")
        );
        assert_eq!(
            parse_rfc2822_to_rfc3339("12 Jul 2023 10:30:00 -0700").as_deref(),
            Some("2023-07-12T10:30:00-07:00")
        );
        assert_eq!(
            parse_rfc2822_to_rfc3339("Wed, 12 Jul 2023 10:30 GMT").as_deref(),
            Some("2023-07-12T10:30:00+00:00")
        );
        assert!(parse_rfc2822_to_rfc3339("not a date").is_none());
    }

    #[test]
    fn format_system_time_iso_matches_known_epoch() {
        let time = UNIX_EPOCH + std::time::Duration::from_millis(1_689_157_800_000);
        assert_eq!(format_system_time_iso(time), "2023-07-12T10:30:00.000Z");
    }
}
