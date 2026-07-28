import { type SourceKind } from "../source-display";

export type SourceFormValues = {
  kind: SourceKind;
  name: string;
  feedUrl: string;
  url: string;
  selector: string;
  followLinks: boolean;
  channelId: string;
  mboxPath: string;
  senderAllow: string;
  senderBlock: string;
  promoBlocklist: string;
  folderPath: string;
  globs: string;
  cron: string;
};

export function parseSourceList(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    ),
  ];
}

export function sourcePrimaryFieldFilled(values: SourceFormValues) {
  if (values.kind === "rss") return values.feedUrl.trim().length > 0;
  if (values.kind === "web_scrape") return values.url.trim().length > 0;
  if (values.kind === "slack_channel") return values.channelId.trim().length > 0;
  if (values.kind === "mail_folder") return values.mboxPath.trim().length > 0;
  return values.folderPath.trim().length > 0;
}

export function buildSourceRequestBody(
  values: SourceFormValues,
  projectId: string
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    kind: values.kind,
    name: values.name.trim(),
    projectId,
  };

  // Every source carries a schedule now, local ones included: the daemon's
  // registry poll only picks up local sources whose cron says they're due.
  body.cron = values.cron;
  if (values.kind === "rss") body.feedUrl = values.feedUrl.trim();
  if (values.kind === "web_scrape") {
    body.url = values.url.trim();
    if (values.selector.trim()) body.selector = values.selector.trim();
    body.followLinks = values.followLinks;
  }
  if (values.kind === "slack_channel") body.channelId = values.channelId.trim();
  if (values.kind === "mail_folder") {
    body.mboxPath = values.mboxPath.trim();
    body.senderAllow = parseSourceList(values.senderAllow);
    body.senderBlock = parseSourceList(values.senderBlock);
    body.promoBlocklist = parseSourceList(values.promoBlocklist);
  }
  if (values.kind === "folder_watch") {
    body.folderPath = values.folderPath.trim();
    const globs = parseSourceList(values.globs);
    if (globs.length > 0) body.globs = globs;
  }

  return body;
}
