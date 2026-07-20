import { JSDOM } from "jsdom";

export type ScrapeEntry = {
  externalId: string;
  url: string;
  title: string;
};

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

// Following links is for discovery only (finding new pages on a listing or
// index page), not a crawl. Keep it bounded and same-origin.
const MAX_FOLLOWED_LINKS = 25;

export async function fetchWebScrapeEntries(
  url: string,
  options: { selector?: string; followLinks?: boolean }
): Promise<ScrapeEntry[]> {
  const html = await fetchHtml(url);
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  const rootTitle = doc.querySelector("title")?.textContent?.trim() || url;
  const entries: ScrapeEntry[] = [{ externalId: url, url, title: rootTitle }];

  if (!options.followLinks) return entries;

  const anchorSelector = options.selector ? `${options.selector} a[href]` : "a[href]";
  const anchors = Array.from(doc.querySelectorAll(anchorSelector));
  const base = new URL(url);
  const seen = new Set(entries.map((e) => e.url));

  for (const a of anchors) {
    if (entries.length >= MAX_FOLLOWED_LINKS) break;

    const href = a.getAttribute("href");
    if (!href) continue;

    let resolved: URL;
    try {
      resolved = new URL(href, base);
    } catch {
      continue;
    }
    if (resolved.hostname !== base.hostname) continue;
    resolved.hash = "";
    const linkUrl = resolved.toString();
    if (seen.has(linkUrl)) continue;
    seen.add(linkUrl);

    entries.push({
      externalId: linkUrl,
      url: linkUrl,
      title: a.textContent?.trim() || linkUrl,
    });
  }

  return entries;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.text();
}
