type OpenLibraryBook = {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  first_sentence?: string[];
  number_of_pages_median?: number;
  isbn?: string[];
};

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ error: "Enter at least 2 characters." }, { status: 400 });

  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query.slice(0, 120));
  url.searchParams.set("limit", "12");
  url.searchParams.set("fields", "key,title,author_name,cover_i,first_sentence,number_of_pages_median,isbn");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Booko/0.1 (book club application; https://booko-reading-club.me-188d.chatgpt.site)",
      },
    });
    if (!response.ok) throw new Error(`Book catalogue returned ${response.status}`);
    const payload = (await response.json()) as { docs?: OpenLibraryBook[] };
    const books = (payload.docs ?? []).flatMap((item) => {
      if (!item.key || !item.title) return [];
      const isbn13 = item.isbn?.find((isbn) => /^\d{13}$/.test(isbn)) ?? null;
      return [{
        catalogId: item.key,
        title: item.title,
        authors: item.author_name ?? [],
        description: item.first_sentence?.[0]?.slice(0, 600) ?? null,
        pageCount: Number.isInteger(item.number_of_pages_median) && Number(item.number_of_pages_median) > 0 ? item.number_of_pages_median : null,
        coverUrl: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` : null,
        isbn13,
      }];
    });
    return Response.json({ books }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return Response.json({ error: "We couldn't reach Open Library. Please try again." }, { status: 502 });
  }
}
