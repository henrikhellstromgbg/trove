export const SOURCE_KIND_OPTIONS = [
  { value: "rss", label: "RSS feed", displayLabel: "RSS", runtime: "cloud" },
  { value: "web_scrape", label: "Web page", displayLabel: "Web page", runtime: "cloud" },
  {
    value: "slack_channel",
    label: "Slack channel",
    displayLabel: "Slack channel",
    runtime: "cloud",
  },
  {
    value: "mail_folder",
    label: "Mail folder",
    displayLabel: "Mail folder",
    runtime: "local",
  },
  {
    value: "folder_watch",
    label: "Watched folder",
    displayLabel: "Watched folder",
    runtime: "local",
  },
] as const;

export type SourceKind = (typeof SOURCE_KIND_OPTIONS)[number]["value"];

const SOURCE_DISPLAY_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    SOURCE_KIND_OPTIONS.map(({ value, displayLabel }) => [value, displayLabel])
  ),
  // Legacy tactical-athlete sources remain readable but cannot be created here.
  youtube_channel: "YouTube channel",
};

export function sourceKindLabel(kind: string) {
  return SOURCE_DISPLAY_LABELS[kind] ?? kind;
}

export function sourceRuntimeLabel(runtime: string) {
  return runtime === "cloud" ? "Cloud" : "Desktop";
}

export function isLocalSourceKind(kind: SourceKind) {
  return SOURCE_KIND_OPTIONS.find((option) => option.value === kind)?.runtime === "local";
}
