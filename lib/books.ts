export type CatalogueBook = {
  catalogId: string;
  title: string;
  authors: string[];
  description: string | null;
  pageCount: number | null;
  coverUrl: string | null;
  isbn13: string | null;
};

export async function searchBookCatalogue(rawQuery: string): Promise<CatalogueBook[]> {
  const query = rawQuery.trim();
  if (query.length < 2) throw new Error("Enter at least 2 characters.");
  const url = new URL("/.netlify/functions/books-search", window.location.origin);
  url.searchParams.set("q", query);
  const response = await fetch(url);
  const payload = await response.json() as { books?: CatalogueBook[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "Search failed");
  return payload.books ?? [];
}
