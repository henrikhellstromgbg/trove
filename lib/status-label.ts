// Human label for a raw status/trigger enum shown in the UI. The stored values
// are lowercase ("ready", "completed", "manual", "ok"); every visible label has
// to be sentence case (C1). Use this wherever a status string reaches the DOM.
const SPECIAL: Record<string, string> = { ok: "OK" };

export function statusLabel(value: string | null | undefined): string {
  if (!value) return "";
  if (SPECIAL[value]) return SPECIAL[value];
  return value.charAt(0).toUpperCase() + value.slice(1);
}
