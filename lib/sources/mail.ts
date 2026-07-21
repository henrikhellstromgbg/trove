import type { MailFolderSourceConfig } from "./contracts";

const DEFAULT_PROMO_BLOCKLIST = [
  "unsubscribe",
  "manage preferences",
  "view in browser",
  "update your preferences",
];

export type ParsedNewsletterSender = {
  name: string | null;
  address: string | null;
};

export type NewsletterMailInput = {
  messageId: string;
  subject?: string | null;
  from?: string | null;
  receivedAt?: Date | string | null;
  text?: string | null;
  html?: string | null;
};

export type NewsletterMailIngestDraft = {
  externalId: string;
  type: "text";
  source: string;
  text: string;
  capturedAt?: string;
  sender: ParsedNewsletterSender;
  subject: string;
};

export function parseNewsletterSender(
  value: string | null | undefined
): ParsedNewsletterSender {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { name: null, address: null };

  const match = trimmed.match(/^(?:"?([^"<]+)"?\s*)?<([^>]+)>$/);
  if (match) {
    return {
      name: match[1]?.trim() || null,
      address: match[2]?.trim().toLowerCase() || null,
    };
  }

  if (trimmed.includes("@")) {
    return { name: null, address: trimmed.toLowerCase() };
  }

  return { name: trimmed, address: null };
}

export function cleanNewsletterMailBody(
  value: string,
  promoBlocklist: string[] = []
): string {
  const blockedPhrases = [
    ...DEFAULT_PROMO_BLOCKLIST,
    ...promoBlocklist.map((entry) => entry.trim()).filter(Boolean),
  ].map((entry) => entry.toLowerCase());

  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .split("\n")
    .map((line) => line.replace(/\t/g, " ").trimEnd())
    .filter((line) => !isBlockedNewsletterLine(line, blockedPhrases))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildNewsletterMailIngestDraft(
  input: NewsletterMailInput,
  config: Pick<MailFolderSourceConfig, "promoBlocklist"> = { promoBlocklist: [] }
): NewsletterMailIngestDraft {
  const externalId = normalizeMailMessageId(input.messageId);
  if (!externalId) throw new Error("messageId is required");

  const subject = normalizeInlineText(input.subject) || "(no subject)";
  const sender = parseNewsletterSender(input.from);
  const body = cleanNewsletterMailBody(resolveMailBody(input), config.promoBlocklist);
  if (!body) throw new Error("mail body is empty after cleaning");

  const text = [
    `Subject: ${subject}`,
    formatSenderLine(sender),
    "",
    body,
  ]
    .filter((line, index) => line.length > 0 || index === 2)
    .join("\n");

  const draft: NewsletterMailIngestDraft = {
    externalId,
    type: "text",
    source: subject,
    text,
    sender,
    subject,
  };

  const capturedAt = normalizeCapturedAt(input.receivedAt);
  if (capturedAt) draft.capturedAt = capturedAt;
  return draft;
}

function resolveMailBody(input: NewsletterMailInput): string {
  const text = input.text?.trim();
  if (text) return text;

  const html = input.html?.trim();
  if (!html) return "";

  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|table|section|article|h[1-6])>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeMailMessageId(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^<|>$/g, "");
}

function normalizeInlineText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function formatSenderLine(sender: ParsedNewsletterSender): string {
  if (sender.name && sender.address) {
    return `From: ${sender.name} <${sender.address}>`;
  }
  if (sender.address) return `From: ${sender.address}`;
  if (sender.name) return `From: ${sender.name}`;
  return "";
}

function isBlockedNewsletterLine(line: string, blockedPhrases: string[]): boolean {
  const normalized = line.trim().toLowerCase();
  if (!normalized) return false;
  return blockedPhrases.some((phrase) => normalized.includes(phrase));
}

function normalizeCapturedAt(value: Date | string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("receivedAt must be a valid date");
  }
  return date.toISOString();
}
