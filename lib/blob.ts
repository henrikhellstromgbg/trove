import { get } from "@vercel/blob";

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
  const result = await get(blobUrl, { access: "private" });
  if (!result || result.statusCode !== 200) {
    throw new Error(`Blob not found: ${blobUrl}`);
  }
  return streamToBuffer(result.stream);
}

export async function fetchBlobText(blobUrl: string): Promise<string> {
  const buffer = await fetchBlobBuffer(blobUrl);
  return buffer.toString("utf-8");
}
