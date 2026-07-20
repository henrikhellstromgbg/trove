import { get } from "@vercel/blob";

// Legacy items were uploaded to the old public store and stay fetchable via
// a plain fetch. New uploads go to the private store and need an
// authenticated get() with its token. Distinguish by hostname since both
// kinds of blobUrl live side by side in the item table.
const PRIVATE_HOST_MARKER = ".private.blob.vercel-storage.com";

function isPrivateBlobUrl(blobUrl: string): boolean {
  return blobUrl.includes(PRIVATE_HOST_MARKER);
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function fetchBlobBuffer(blobUrl: string): Promise<Buffer> {
  if (isPrivateBlobUrl(blobUrl)) {
    const result = await get(blobUrl, {
      access: "private",
      token: process.env.PRIVATE_BLOB_READ_WRITE_TOKEN,
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error(`Blob not found: ${blobUrl}`);
    }
    return streamToBuffer(result.stream);
  }

  const res = await fetch(blobUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch blob: HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function fetchBlobText(blobUrl: string): Promise<string> {
  const buffer = await fetchBlobBuffer(blobUrl);
  return buffer.toString("utf-8");
}
