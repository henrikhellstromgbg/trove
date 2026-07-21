export function itemOriginalUrl(item: {
  id: string;
  source: string | null;
  blobUrl: string | null;
}): string | null {
  if (item.source && /^https?:\/\//i.test(item.source)) return item.source;
  return item.blobUrl ? `/api/items/${item.id}/blob` : null;
}
