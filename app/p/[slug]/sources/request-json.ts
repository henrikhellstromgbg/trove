export type RequestJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fetcher: Fetcher = fetch
): Promise<RequestJsonResult<T>> {
  try {
    const response = await fetcher(input, init);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : `Error ${response.status}`;
      return { ok: false, error: message };
    }

    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Unable to reach Trove. Try again." };
  }
}
