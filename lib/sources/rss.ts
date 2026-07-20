import Parser from "rss-parser";

export type RssEntry = {
  externalId: string;
  title: string;
  url: string;
  publishedAt: Date | null;
};

const parser = new Parser();

export async function fetchRssEntries(feedUrl: string): Promise<RssEntry[]> {
  const feed = await parser.parseURL(feedUrl);

  const entries: RssEntry[] = [];
  for (const item of feed.items) {
    const url = item.link;
    if (!url) continue;

    const externalId = item.guid ?? item.id ?? url;
    const title = item.title?.trim() || url;
    const publishedAt = item.isoDate ? new Date(item.isoDate) : null;

    entries.push({ externalId, title, url, publishedAt });
  }

  return entries;
}
