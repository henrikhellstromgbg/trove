export type CaptureUploadOutcome = "saved" | "duplicate" | "error";

export type CaptureUploadResult = {
  file: File;
  outcome: CaptureUploadOutcome;
  error?: string;
};

type CaptureRequester = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export function captureFilesFromList(
  files: ArrayLike<File> | null | undefined
): File[] {
  return Array.from(files ?? []);
}

export async function uploadCaptureFiles(
  files: File[],
  projectId: string,
  request: CaptureRequester = fetch,
  onProgress?: (completed: number, total: number) => void
): Promise<CaptureUploadResult[]> {
  const results: CaptureUploadResult[] = [];

  for (const [index, file] of files.entries()) {
    const form = new FormData();
    form.append("file", file);
    form.append("projectId", projectId);

    try {
      const response = await request("/api/ingest", {
        method: "POST",
        body: form,
      });
      const body = (await response.json().catch(() => ({}))) as {
        duplicate?: boolean;
        error?: string;
      };

      if (body.duplicate) {
        results.push({ file, outcome: "duplicate" });
      } else if (response.ok) {
        results.push({ file, outcome: "saved" });
      } else {
        results.push({
          file,
          outcome: "error",
          error: body.error ?? String(response.status),
        });
      }
    } catch {
      results.push({ file, outcome: "error", error: "Connection error" });
    }

    onProgress?.(index + 1, files.length);
  }

  return results;
}

export function formatCaptureUploadStatus(results: CaptureUploadResult[]): string {
  const saved = results.filter((result) => result.outcome === "saved");
  const duplicates = results.filter((result) => result.outcome === "duplicate");
  const errors = results.filter((result) => result.outcome === "error");
  const parts: string[] = [];

  if (saved.length === 1) parts.push("File saved");
  if (saved.length > 1) parts.push(`${saved.length} files saved`);

  if (duplicates.length === 1) {
    parts.push(`File already exists: ${duplicates[0].file.name}`);
  }
  if (duplicates.length > 1) {
    parts.push(
      `${duplicates.length} files already exist: ${duplicates
        .map((result) => result.file.name)
        .join(", ")}`
    );
  }

  parts.push(
    ...errors.map(
      (result) => `${result.file.name}: ${result.error ?? "Upload failed"}`
    )
  );

  return parts.join(" · ");
}
