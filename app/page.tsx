"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthMode = "signin" | "signup" | "forgot";
type Club = { id:string; name:string; description:string | null; created_at:string };
type Book = { catalogId:string; title:string; authors:string[]; description:string | null; pageCount:number | null; coverUrl:string | null; isbn13:string | null };
type LibraryBook = { id:string; title:string; authors:string[]; description:string | null; page_count:number | null; cover_url:string | null; google_books_id:string };

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [clubs, setClubs] = useState<Club[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Book[]>([]);
  const [library, setLibrary] = useState<LibraryBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setChecking(false); });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setClubs([]); return; }
    void Promise.all([loadClubs(), loadLibrary()]);
  }, [session]);

  async function loadClubs() {
    const { data, error } = await supabase.from("clubs").select("id,name,description,created_at").order("created_at", { ascending:false });
    if (error) setMessage(error.message); else setClubs(data ?? []);
  }

  async function loadLibrary() {
    const { data, error } = await supabase.from("user_books").select("created_at,book:books(id,title,authors,description,page_count,cover_url,google_books_id)").order("created_at", { ascending:false });
    if (error) { setMessage(error.message); return; }
    setLibrary((data ?? []).flatMap((row) => row.book ? [row.book as unknown as LibraryBook] : []));
  }

  async function searchBooks(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true); setMessage(""); setResults([]);
    try {
      const response = await fetch(`/api/books/search?q=${encodeURIComponent(query.trim())}`);
      const data = await response.json() as { books?:Book[]; error?:string };
      if (!response.ok) throw new Error(data.error || "Search failed");
      setResults(data.books ?? []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Search failed"); }
    setSearching(false);
  }

  async function saveBook(book:Book) {
    setSavingId(book.catalogId); setMessage("");
    const { error } = await supabase.rpc("add_book_to_library", {
      book_google_id:book.catalogId, book_title:book.title, book_authors:book.authors,
      book_description:book.description, book_page_count:book.pageCount, book_cover_url:book.coverUrl, book_isbn13:book.isbn13,
    });
    if (error) setMessage(error.message); else { setMessage(`“${book.title}” was added to your library.`); await loadLibrary(); }
    setSavingId(null);
  }

  async function submitAuth(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const name = String(form.get("name") || "").trim();
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password, options:{ data:{ display_name:name }, emailRedirectTo:window.location.origin } });
      setMessage(error?.message || "Check your email to confirm your Booko account.");
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo:window.location.origin });
      setMessage(error?.message || "Password reset instructions are on their way.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
    }
    setBusy(false);
  }

  async function createClub(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const { data, error } = await supabase.rpc("create_book_club", { club_name:String(form.get("name") || "").trim(), club_description:String(form.get("description") || "").trim() || null });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setShowCreate(false);
    if (data) await loadClubs();
  }

  if (checking) return <main className="loading-screen"><div className="brand"><span className="brand-mark">b</span><span>booko</span></div><p>Opening your reading room…</p></main>;
  if (!session) return <AuthScreen mode={mode} setMode={setMode} submit={submitAuth} busy={busy} message={message} />;

  const displayName = String(session.user.user_metadata?.display_name || session.user.email?.split("@")[0] || "Reader");
  return <main className="app-shell">
    <header className="app-header"><a className="brand" href="/"><span className="brand-mark">b</span><span>booko</span></a><nav><a className="active" href="#clubs">My clubs</a><a href="#reading">Reading</a></nav><div className="account"><span className="avatar">{displayName.slice(0,2).toUpperCase()}</span><div><strong>{displayName}</strong><small>{session.user.email}</small></div><button onClick={() => supabase.auth.signOut()}>Sign out</button></div></header>
    <section className="welcome"><div><span className="eyebrow">YOUR READING CIRCLE</span><h1>Welcome, {displayName}.</h1><p>{clubs.length ? "Your next good conversation starts here." : "Let’s create a place for your first shared story."}</p></div><div className="welcome-actions"><button className="secondary" onClick={() => setShowSearch(true)}>⌕ Find a book</button><button className="primary" onClick={() => setShowCreate(true)}>＋ Create a club</button></div></section>
    <section className="dashboard library-section" id="reading"><div className="section-title"><div><span className="eyebrow coral">YOUR BOOKSHELF</span><h2>Books you want to read</h2></div><button className="text-button" onClick={() => setShowSearch(true)}>Find a book →</button></div>
      {message && <p className="notice" role="status">{message}</p>}
      {library.length === 0 ? <button className="library-empty" onClick={() => setShowSearch(true)}><span>⌕</span><strong>Search for your first book</strong><small>Find it by title, author, or ISBN and add it to your reading list.</small></button> : <div className="book-grid">{library.map((book)=><article className="book-card" key={book.id}><BookCover title={book.title} url={book.cover_url}/><div><span className="pill">WANT TO READ</span><h3>{book.title}</h3><p className="byline">{book.authors.join(", ") || "Unknown author"}</p><small>{book.page_count ? `${book.page_count} pages` : "Page count unavailable"}</small></div></article>)}</div>}
    </section>
    <section className="dashboard" id="clubs"><div className="section-title"><div><span className="eyebrow coral">HOSTING & READING</span><h2>Your book clubs</h2></div><span>{clubs.length} {clubs.length === 1 ? "club" : "clubs"}</span></div>{message && <p className="notice" role="status">{message}</p>}
      {clubs.length === 0 ? <button className="empty-state" onClick={() => setShowCreate(true)}><span>＋</span><strong>Create your first book club</strong><small>Name your circle now. We’ll choose a book and invite members next.</small><em>Get started →</em></button> : <div className="club-list">{clubs.map((club,index)=><article className="club-card" key={club.id}><div className={`club-accent accent-${index%3}`}><span>{String(index+1).padStart(2,"0")}</span></div><div><span className="pill">HOST</span><h3>{club.name}</h3><p>{club.description || "A new reading circle, ready for its first book."}</p><div className="club-meta"><span>○ 1 member</span><span>Book not chosen</span></div></div><button aria-label={`Open ${club.name}`}>→</button></article>)}</div>}
    </section>
    {showCreate && <div className="modal-backdrop" onMouseDown={() => setShowCreate(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-club-title" onMouseDown={(e)=>e.stopPropagation()}><button className="close" onClick={()=>setShowCreate(false)} aria-label="Close">×</button><span className="eyebrow coral">YOUR FIRST CIRCLE</span><h2 id="new-club-title">Create a book club</h2><p>Give your new reading space a name. You can choose the book and invite people next.</p><form onSubmit={createClub}><label>Club name<input name="name" required minLength={2} maxLength={80} placeholder="e.g. Sunday Stories" autoFocus /></label><label>Description <small>Optional</small><textarea name="description" maxLength={240} placeholder="What brings this group together?" /></label><div className="form-actions"><button type="button" className="secondary" onClick={()=>setShowCreate(false)}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Creating…" : "Create club →"}</button></div></form></section></div>}
    {showSearch && <div className="modal-backdrop" onMouseDown={() => setShowSearch(false)}><section className="modal search-modal" role="dialog" aria-modal="true" aria-labelledby="book-search-title" onMouseDown={(e)=>e.stopPropagation()}><button className="close" onClick={()=>setShowSearch(false)} aria-label="Close">×</button><span className="eyebrow coral">BUILD YOUR BOOKSHELF</span><h2 id="book-search-title">Find your next book</h2><p>Search by title, author, or ISBN.</p><form className="search-form" onSubmit={searchBooks}><input aria-label="Search books" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="e.g. The Midnight Library" autoFocus/><button className="primary" disabled={searching || query.trim().length < 2}>{searching ? "Searching…" : "Search"}</button></form>{message && <p className="notice" role="status">{message}</p>}<div className="search-results">{!searching && results.length === 0 && query && <p className="search-hint">Search results will appear here.</p>}{results.map((book)=><article className="search-result" key={book.catalogId}><BookCover title={book.title} url={book.coverUrl}/><div><h3>{book.title}</h3><p className="byline">{book.authors.join(", ") || "Unknown author"}</p><small>{book.pageCount ? `${book.pageCount} pages` : "Page count unavailable"}</small>{book.description && <p>{book.description}</p>}</div><button className="secondary" disabled={savingId === book.catalogId || library.some((item)=>item.google_books_id===book.catalogId)} onClick={()=>saveBook(book)}>{library.some((item)=>item.google_books_id===book.catalogId) ? "Added ✓" : savingId===book.catalogId ? "Adding…" : "+ Add"}</button></article>)}</div><footer className="catalogue-credit">Book information provided by Open Library</footer></section></div>}
  </main>;
}

function BookCover({title,url}:{title:string;url:string|null}) {
  return url ? <img className="book-cover" src={url} alt={`Cover of ${title}`} /> : <div className="book-cover cover-placeholder" aria-label={`No cover available for ${title}`}><span>b</span></div>;
}

function AuthScreen({mode,setMode,submit,busy,message}:{mode:AuthMode;setMode:(m:AuthMode)=>void;submit:(e:FormEvent<HTMLFormElement>)=>void;busy:boolean;message:string}) {
  const titles = { signin:["Welcome back","Continue your next chapter."], signup:["Create your account","Your first great discussion starts here."], forgot:["Reset your password","We’ll send you a secure reset link."] } as const;
  return <main className="auth-page"><section className="auth-story"><a className="brand light" href="/"><span className="brand-mark">b</span><span>booko</span></a><div className="story-copy"><span className="eyebrow gold">READ TOGETHER</span><h1>Good books<br/>become great<br/>conversations.</h1><p>Create a circle for the readers you love, then keep every chapter, gathering, and thought in one calm place.</p></div><div className="book-stack" aria-hidden="true"><i/><i/><i/></div><small>FOR BOOK CLUBS, BIG AND SMALL</small></section><section className="auth-panel"><div className="auth-card"><span className="eyebrow coral">BOOKO ACCOUNT</span><h2>{titles[mode][0]}</h2><p>{titles[mode][1]}</p><form onSubmit={submit}>{mode === "signup" && <label>Your name<input name="name" required maxLength={80} autoComplete="name" placeholder="Alex Reader" /></label>}<label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>{mode !== "forgot" && <label>Password<input name="password" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="At least 8 characters" /></label>}<button className="primary full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in →" : mode === "signup" ? "Create account →" : "Send reset link →"}</button></form>{message && <p className="notice" role="status">{message}</p>}<div className="auth-links">{mode === "signin" ? <><button onClick={()=>{setMode("forgot")}}>Forgot password?</button><span>New to Booko? <button onClick={()=>setMode("signup")}>Create an account</button></span></> : <span>Already have an account? <button onClick={()=>setMode("signin")}>Sign in</button></span>}</div></div></section></main>;
}
