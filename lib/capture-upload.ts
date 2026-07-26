export type CaptureUploadOutcome = "saved" | "duplicate" | "error";

export type CaptureUploadResult = {
  file: File;
  outcome: CaptureUploadOutcome;
  error?: string;
};

export type CaptureUploadNotice = {
  variant: "success" | "warning" | "error" | "info";
  title: string;
  description: string;
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

function summarizeFilenames(results: CaptureUploadResult[], limit = 4): string {
  const visible = results.slice(0, limit).map((result) => result.file.name);
  const remaining = results.length - visible.length;
  if (remaining > 0) visible.push(`and ${remaining} more`);
  return visible.join(", ");
}

export function buildCaptureUploadNotice(
  results: CaptureUploadResult[],
  projectName: string
): CaptureUploadNotice {
  const saved = results.filter((result) => result.outcome === "saved");
  const duplicates = results.filter((result) => result.outcome === "duplicate");
  const errors = results.filter((result) => result.outcome === "error");

  if (errors.length > 0) {
    const title =
      errors.length === results.length
        ? errors.length === 1
          ? "File could not be captured"
          : `${errors.length} files could not be captured`
        : "Capture finished with errors";
    const summary = errors
      .slice(0, 3)
      .map((result) => `${result.file.name}: ${result.error ?? "Upload failed"}`)
      .join(". ");
    const remaining = errors.length - Math.min(errors.length, 3);
    return {
      variant: "error",
      title,
      description: remaining > 0 ? `${summary}. ${remaining} more failed.` : `${summary}.`,
    };
  }

  if (duplicates.length > 0 && saved.length === 0) {
    const title =
      duplicates.length === 1
        ? "File already exists"
        : `${duplicates.length} files already exist`;
    const subject = duplicates.length === 1 ? "is" : "are";
    return {
      variant: "warning",
      title,
      description: `${summarizeFilenames(duplicates)} ${subject} already in ${projectName}.`,
    };
  }

  if (duplicates.length > 0) {
    return {
      variant: "warning",
      title: "Capture finished",
      description: `${saved.length} ${saved.length === 1 ? "file was" : "files were"} captured. ${duplicates.length} ${duplicates.length === 1 ? "file is" : "files are"} already in ${projectName}: ${summarizeFilenames(duplicates)}.`,
    };
  }

  if (saved.length > 0) {
    return {
      variant: "success",
      title: saved.length === 1 ? "File captured" : `${saved.length} files captured`,
      description:
        saved.length === 1
          ? `${saved[0].file.name} was added to ${projectName}.`
          : `The files were added to ${projectName}.`,
    };
  }

  return {
    variant: "info",
    title: "Nothing captured",
    description: `No files were added to ${projectName}.`,
  };
}
