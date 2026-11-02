// Free films from the Internet Archive. Rights vary by title, so check an item's page
// on archive.org before sharing or redistributing it.
const build = (q) =>
  "https://archive.org/advancedsearch.php?q=" + encodeURIComponent(q) +
  "&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=description&sort%5B%5D=downloads+desc&rows=30&output=json";

const text = (d) => (Array.isArray(d) ? d.join(" ") : d || "").replace(/<[^>]*>/g, "").slice(0, 400);

async function search(q) {
  const res = await fetch(build(q));
  if (!res.ok) throw new Error(`Archive ${res.status}`);
  const { response } = await res.json();
  return response.docs.map((d) => ({
    id: `ia-${d.identifier}`,
    archiveId: d.identifier,
    title: d.title,
    overview: text(d.description),
    poster_path: `https://archive.org/services/img/${d.identifier}`,
  }));
}

export const loadPublicDomain = () => search("collection:feature_films AND mediatype:movies");
export const loadHindiArchive = () => search("mediatype:movies AND (language:Hindi OR language:hin) AND collection:feature_films");

export async function resolveArchiveStream(identifier) {
  const res = await fetch(`https://archive.org/metadata/${identifier}`);
  if (!res.ok) return null;
  const { files = [] } = await res.json();
  const f =
    files.find((x) => x.format === "h.264" && x.name.endsWith(".mp4")) ||
    files.find((x) => x.format === "MPEG4" && x.name.endsWith(".mp4"));
  return f ? `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}` : null;
}
