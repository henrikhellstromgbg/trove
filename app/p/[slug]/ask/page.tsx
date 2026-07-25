import { redirect } from "next/navigation";

// Ask is the project home now. Keep this route as a redirect so old links and
// bookmarks (including ?conversation= and ?q=) still land in the right place.
export default async function AskPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["conversation", "q"]) {
    const value = sp[key];
    if (typeof value === "string" && value) query.set(key, value);
  }
  const suffix = query.toString();
  redirect(suffix ? `/p/${slug}?${suffix}` : `/p/${slug}`);
}
