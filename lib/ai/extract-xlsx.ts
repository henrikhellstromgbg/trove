import * as XLSX from "xlsx";
import { readUploadBuffer } from "@/lib/files";

export type XlsxExtracted = {
  title: string;
  text: string;
};

export async function extractFromXlsx(
  blobUrl: string,
  filename: string
): Promise<XlsxExtracted> {
  const buffer = await readUploadBuffer(blobUrl);

  const workbook = XLSX.read(buffer, { type: "buffer" });

  const sections: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet).trim();
    if (csv) {
      sections.push(`=== ${sheetName} ===\n${csv}`);
    }
  }
  const text = sections.join("\n\n").trim();

  const base = filename.replace(/\.[^.]+$/, "");
  const sheetSummary = workbook.SheetNames.slice(0, 3).join(", ");
  const title =
    base || sheetSummary || "Untitled spreadsheet";

  return { title: title.slice(0, 120), text };
}
