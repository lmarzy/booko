type GoogleVolume = {
  id?: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string;
    pageCount?: number;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type?: string; identifier?: string }[];
  };
};

function plainText(value = "") {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ error: "Enter at least 2 characters." }, { status: 400 });

  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query.slice(0, 120));
  url.searchParams.set("printType", "books");
  url.searchParams.set("maxResults", "12");

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Book catalogue unavailable");
    const payload = (await response.json()) as { items?: GoogleVolume[] };
    const books = (payload.items ?? []).flatMap((item) => {
      const info = item.volumeInfo;
      if (!item.id || !info?.title) return [];
      const cover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null;
      return [{
        googleBooksId: item.id,
        title: info.title,
        authors: info.authors ?? [],
        description: plainText(info.description) || null,
        pageCount: Number.isInteger(info.pageCount) && Number(info.pageCount) > 0 ? info.pageCount : null,
        coverUrl: cover?.replace(/^http:/, "https:") ?? null,
        isbn13: info.industryIdentifiers?.find((identifier) => identifier.type === "ISBN_13")?.identifier ?? null,
      }];
    });
    return Response.json({ books }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return Response.json({ error: "We couldn't reach the book catalogue. Please try again." }, { status: 502 });
  }
}
