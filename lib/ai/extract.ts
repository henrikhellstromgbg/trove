import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export type Extracted = {
  title: string;
  text: string;
};

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

const MIN_TEXT_LENGTH = 200;

export async function extractFromUrl(url: string): Promise<Extracted> {
  const viaJina = await tryJina(url);
  if (viaJina) return viaJina;

  const html = await fetchHtml(url);
  const dom = new JSDOM(html, { url });

  const readable = tryReadability(dom);
  if (readable) return readable;

  const fallback = tryBodyText(dom);
  if (fallback) return fallback;

  throw new Error(`Could not extract readable content from ${url}`);
}

async function tryJina(url: string): Promise<Extracted | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "application/json",
        "X-Retain-Images": "none",
      },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      data?: { title?: string; content?: string };
    };
    const title = data.data?.title?.trim();
    const text = data.data?.content?.trim();
    if (!text || text.length < MIN_TEXT_LENGTH) return null;

    return {
      title: title || "Untitled",
      text,
    };
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,sv;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.text();
}

function tryReadability(dom: JSDOM): Extracted | null {
  try {
    const reader = new Readability(dom.window.document.cloneNode(true) as Document);
    const article = reader.parse();
    if (!article || !article.textContent) return null;
    const text = article.textContent
      .trim()
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
    if (text.length < MIN_TEXT_LENGTH) return null;
    return {
      title: article.title?.trim() || extractMetaTitle(dom) || "Untitled",
      text,
    };
  } catch {
    return null;
  }
}

function tryBodyText(dom: JSDOM): Extracted | null {
  const doc = dom.window.document;
  doc
    .querySelectorAll("script, style, noscript, nav, header, footer, aside, iframe, svg, button")
    .forEach((el) => el.remove());

  const container =
    doc.querySelector("article") ||
    doc.querySelector("main") ||
    doc.querySelector("[role=main]") ||
    doc.body;
  if (!container) return null;

  const text = (container.textContent ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < MIN_TEXT_LENGTH) return null;

  return {
    title: extractMetaTitle(dom) || "Untitled",
    text,
  };
}

function extractMetaTitle(dom: JSDOM): string | null {
  const doc = dom.window.document;
  const og = doc.querySelector('meta[property="og:title"]')?.getAttribute("content");
  if (og) return og.trim();
  const tw = doc.querySelector('meta[name="twitter:title"]')?.getAttribute("content");
  if (tw) return tw.trim();
  const title = doc.querySelector("title")?.textContent;
  if (title) return title.trim();
  const h1 = doc.querySelector("h1")?.textContent;
  return h1?.trim() ?? null;
}
