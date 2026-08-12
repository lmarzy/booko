import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("builds a static React entry page", async () => {
  const html = await readFile(
    new URL("../dist/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /<title>Booko — Read better, together<\/title>/);
  assert.match(html, /src="\/assets\/[^"]+\.js"/);
  assert.match(html, /href="\/assets\/[^"]+\.css"/);
});

test("keeps client-side club routes working on Netlify", async () => {
  const config = await readFile(
    new URL("../netlify.toml", import.meta.url),
    "utf8",
  );
  const source = await readFile(
    new URL("../src/main.tsx", import.meta.url),
    "utf8",
  );
  assert.match(config, /publish = "dist"/);
  assert.match(config, /from = "\/\*"/);
  assert.match(config, /to = "\/index\.html"/);
  assert.match(config, /status = 200/);
  assert.ok(source.includes("\\/clubs\\/"));
  assert.match(source, /<ClubPage clubId=/);
});

test("routes book searches through a Netlify function", async () => {
  const client = await readFile(
    new URL("../lib/books.ts", import.meta.url),
    "utf8",
  );
  const handler = await readFile(
    new URL("../netlify/functions/books-search.ts", import.meta.url),
    "utf8",
  );
  assert.match(client, /\/\.netlify\/functions\/books-search/);
  assert.match(handler, /https:\/\/openlibrary\.org\/search\.json/);
  assert.match(handler, /\{ books \}/);
});

test("only loads invitations addressed to the signed-in user", async () => {
  const homePage = await readFile(
    new URL("../src/pages/HomePage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(homePage, /const email = session\?\.user\.email/);
  assert.match(homePage, /\.eq\("email", email\)/);
});
