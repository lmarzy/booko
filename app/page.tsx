"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthMode = "signin" | "signup" | "forgot";
type Club = { id:string; host_id:string; name:string; description:string | null; created_at:string };
type Book = { catalogId:string; title:string; authors:string[]; description:string | null; pageCount:number | null; coverUrl:string | null; isbn13:string | null };
type LibraryBook = { id:string; title:string; authors:string[]; description:string | null; page_count:number | null; cover_url:string | null; google_books_id:string };
type ClubBook = { is_current:boolean; nominated_by:string; nominated_at:string; book:LibraryBook; votes:{ user_id:string }[] };
type Invitation = { id:string; expires_at:string; club:Club };
type ConfirmAction = { title:string; description:string; confirmLabel:string; run:()=>Promise<void> };

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
  const [activeClub, setActiveClub] = useState<Club | null>(null);
  const [clubBooks, setClubBooks] = useState<ClubBook[]>([]);
  const [searchClub, setSearchClub] = useState<Club | null>(null);
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([]);
  const [createStep, setCreateStep] = useState(1);
  const [newClub, setNewClub] = useState<Club | null>(null);
  const [inviteEmails, setInviteEmails] = useState("");
  const [toast, setToast] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [newlyNominatedId, setNewlyNominatedId] = useState<string | null>(null);
  const messageTimer = useRef<number | null>(null);
  const nominationTimer = useRef<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setChecking(false); });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => () => {
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    if (nominationTimer.current) window.clearTimeout(nominationTimer.current);
  }, []);

  function showTemporaryMessage(text:string) {
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    setToast(text);
    messageTimer.current = window.setTimeout(() => setToast(""), 4000);
  }

  useEffect(() => {
    if (!session) { setClubs([]); return; }
    void Promise.all([loadClubs(), loadLibrary(), loadInvitations()]);
  }, [session]);

  async function loadClubs() {
    const { data, error } = await supabase.from("clubs").select("id,host_id,name,description,created_at").order("created_at", { ascending:false });
    if (error) setMessage(error.message); else setClubs(data ?? []);
  }

  async function openClub(club:Club) {
    setActiveClub(club); setMessage("");
    await loadClubBooks(club.id);
  }

  async function loadClubBooks(clubId:string) {
    const { data, error } = await supabase.from("club_books").select("is_current,nominated_by,nominated_at,book:books(id,title,authors,description,page_count,cover_url,google_books_id),votes:book_votes(user_id)").eq("club_id",clubId).order("is_current",{ascending:false}).order("nominated_at",{ascending:false});
    if (error) setMessage(error.message); else setClubBooks((data ?? []) as unknown as ClubBook[]);
  }

  function openBookSearch(club:Club|null = null) {
    setSearchClub(club); setShowSearch(true); setQuery(""); setResults([]); setMessage("");
  }

  async function loadLibrary() {
    const { data, error } = await supabase.from("user_books").select("created_at,book:books(id,title,authors,description,page_count,cover_url,google_books_id)").order("created_at", { ascending:false });
    if (error) { setMessage(error.message); return; }
    setLibrary((data ?? []).flatMap((row) => row.book ? [row.book as unknown as LibraryBook] : []));
  }

  async function loadInvitations() {
    const { data, error } = await supabase.from("club_invitations").select("id,expires_at,club:clubs(id,host_id,name,description,created_at)").eq("status","pending").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false});
    if (error) setMessage(error.message); else setPendingInvites((data ?? []).flatMap((item)=>item.club?[item as unknown as Invitation]:[]));
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
    const bookFields = { book_google_id:book.catalogId, book_title:book.title, book_authors:book.authors, book_description:book.description, book_page_count:book.pageCount, book_cover_url:book.coverUrl, book_isbn13:book.isbn13 };
    const { error } = searchClub
      ? await supabase.rpc("nominate_book_to_club", { target_club_id:searchClub.id, ...bookFields })
      : await supabase.rpc("add_book_to_library", bookFields);
    if (error) setMessage(error.message); else if (searchClub) {
      const nominatedClub=searchClub;
      await loadClubBooks(nominatedClub.id);
      setActiveClub(nominatedClub);
      setNewlyNominatedId(book.catalogId);
      setShowSearch(false);
      setSearchClub(null);
      if(showCreate)closeCreateWizard();
      showTemporaryMessage(`“${book.title}” is now on ${nominatedClub.name}'s shortlist.`);
      if(nominationTimer.current)window.clearTimeout(nominationTimer.current);
      nominationTimer.current=window.setTimeout(()=>setNewlyNominatedId(null),3200);
    } else { showTemporaryMessage(`“${book.title}” was added to your library.`); await loadLibrary(); }
    setSavingId(null);
  }

  async function toggleVote(bookId:string) {
    if (!activeClub) return;
    const { error } = await supabase.rpc("toggle_book_vote",{target_club_id:activeClub.id,target_book_id:bookId});
    if (error) setMessage(error.message); else await loadClubBooks(activeClub.id);
  }

  async function chooseBook(bookId:string) {
    if (!activeClub) return;
    const { error } = await supabase.rpc("select_club_book",{target_club_id:activeClub.id,target_book_id:bookId});
    if (error) setMessage(error.message); else { showTemporaryMessage("The club's current book has been chosen."); await loadClubBooks(activeClub.id); }
  }

  function removeLibraryBook(book:LibraryBook) {
    setConfirmAction({title:"Remove this book?",description:`“${book.title}” will be removed from your personal library.`,confirmLabel:"Remove book",run:async()=>{
      const {error}=await supabase.from("user_books").delete().eq("book_id",book.id);
      if(error)setMessage(error.message);else{showTemporaryMessage("Book removed from your library.");await loadLibrary();}
    }});
  }

  function removeShortlistBook(item:ClubBook) {
    if(!activeClub)return;
    const club=activeClub;
    setConfirmAction({title:"Remove this nomination?",description:`“${item.book.title}” will be removed from ${club.name}'s shortlist, including its votes.`,confirmLabel:"Remove nomination",run:async()=>{
      const {error}=await supabase.rpc("remove_club_book",{target_club_id:club.id,target_book_id:item.book.id});
      if(error)setMessage(error.message);else{showTemporaryMessage("Book removed from the shortlist.");await loadClubBooks(club.id);}
    }});
  }

  function deleteClub(club:Club) {
    setConfirmAction({title:"Delete this book club?",description:`“${club.name}” and all its invitations, nominations, and votes will be permanently deleted.`,confirmLabel:"Delete club",run:async()=>{
      const {error}=await supabase.from("clubs").delete().eq("id",club.id);
      if(error)setMessage(error.message);else{if(activeClub?.id===club.id)setActiveClub(null);showTemporaryMessage("Book club deleted.");await loadClubs();}
    }});
  }

  async function runConfirmedAction() {
    if(!confirmAction)return;
    setConfirming(true);
    await confirmAction.run();
    setConfirming(false);
    setConfirmAction(null);
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
    if (data) {
      const created:Club={id:String(data),host_id:session!.user.id,name:String(form.get("name")||"").trim(),description:String(form.get("description")||"").trim()||null,created_at:new Date().toISOString()};
      setNewClub(created); setCreateStep(2); await loadClubs();
    }
  }

  async function saveInvitations(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(!newClub)return;
    const emails=inviteEmails.split(/[\s,;]+/).map((email)=>email.trim()).filter(Boolean);
    if(!emails.length){setCreateStep(3);return;}
    setBusy(true); const {data,error}=await supabase.rpc("invite_club_members",{target_club_id:newClub.id,invite_emails:emails}); setBusy(false);
    if(error)setMessage(error.message);else{showTemporaryMessage(`${data} invitation${data===1?"":"s"} added.`);setCreateStep(3);}
  }

  function closeCreateWizard() {
    setShowCreate(false);setCreateStep(1);setNewClub(null);setInviteEmails("");setMessage("");
  }

  async function respondToInvite(invitationId:string,accept:boolean) {
    const {error}=await supabase.rpc("respond_to_club_invitation",{invitation_id:invitationId,accept_invitation:accept});
    if(error)setMessage(error.message);else{showTemporaryMessage(accept?"Welcome to your new book club.":"Invitation declined.");await Promise.all([loadInvitations(),loadClubs()]);}
  }

  if (checking) return <main className="loading-screen"><div className="brand"><span className="brand-mark">b</span><span>booko</span></div><p>Opening your reading room…</p></main>;
  if (!session) return <AuthScreen mode={mode} setMode={setMode} submit={submitAuth} busy={busy} message={message} />;

  const displayName = String(session.user.user_metadata?.display_name || session.user.email?.split("@")[0] || "Reader");
  return <main className="app-shell">
    <header className="app-header"><a className="brand" href="/"><span className="brand-mark">b</span><span>booko</span></a><nav><a className="active" href="#clubs">My clubs</a><a href="#reading">Reading</a></nav><div className="account"><span className="avatar">{displayName.slice(0,2).toUpperCase()}</span><div className="account-info"><strong>{displayName}</strong><small>{session.user.email}</small><button onClick={() => supabase.auth.signOut()}>Sign out</button></div></div></header>
    <section className="welcome"><div><span className="eyebrow">YOUR READING CIRCLE</span><h1>Welcome, {displayName}.</h1><p>{clubs.length ? "Your next good conversation starts here." : "Let’s create a place for your first shared story."}</p></div><div className="welcome-actions"><button className="secondary" onClick={() => openBookSearch()}>⌕ Find a book</button><button className="primary" onClick={() => {setCreateStep(1);setNewClub(null);setShowCreate(true)}}>＋ Create a club</button></div></section>
    {pendingInvites.length>0&&<section className="invite-tray" aria-label="Club invitations"><span className="eyebrow">YOU'RE INVITED</span>{pendingInvites.map((invite)=><article key={invite.id}><div><strong>{invite.club.name}</strong><small>{invite.club.description||"A reading circle would like you to join."}</small></div><div><button className="secondary" onClick={()=>respondToInvite(invite.id,false)}>Decline</button><button className="primary" onClick={()=>respondToInvite(invite.id,true)}>Accept</button></div></article>)}</section>}
    <section className="dashboard library-section" id="reading"><div className="section-title"><div><span className="eyebrow coral">YOUR BOOKSHELF</span><h2>Books you want to read</h2></div><button className="text-button" onClick={() => openBookSearch()}>Find a book →</button></div>
      {message && <p className="notice" role="status">{message}</p>}
      {library.length === 0 ? <button className="library-empty" onClick={() => openBookSearch()}><span>⌕</span><strong>Search for your first book</strong><small>Find it by title, author, or ISBN and add it to your reading list.</small></button> : <div className="book-grid">{library.map((book)=><article className="book-card" key={book.id}><button className="delete-control" onClick={()=>removeLibraryBook(book)} aria-label={`Remove ${book.title}`}>×</button><BookCover title={book.title} url={book.cover_url}/><div><span className="pill">WANT TO READ</span><h3>{book.title}</h3><p className="byline">{book.authors.join(", ") || "Unknown author"}</p><small>{book.page_count ? `${book.page_count} pages` : "Page count unavailable"}</small></div></article>)}</div>}
    </section>
    <section className="dashboard" id="clubs"><div className="section-title"><div><span className="eyebrow coral">HOSTING & READING</span><h2>Your book clubs</h2></div><span>{clubs.length} {clubs.length === 1 ? "club" : "clubs"}</span></div>{message && <p className="notice" role="status">{message}</p>}
      {clubs.length === 0 ? <button className="empty-state" onClick={() => setShowCreate(true)}><span>＋</span><strong>Create your first book club</strong><small>Name your circle now. We’ll choose a book and invite members next.</small><em>Get started →</em></button> : <div className="club-list">{clubs.map((club,index)=><article className="club-card" key={club.id}>{club.host_id===session.user.id&&<button className="delete-control" onClick={()=>deleteClub(club)} aria-label={`Delete ${club.name}`}>×</button>}<div className={`club-accent accent-${index%3}`}><span>{String(index+1).padStart(2,"0")}</span></div><div><span className="pill">{club.host_id===session.user.id ? "HOST" : "MEMBER"}</span><h3>{club.name}</h3><p>{club.description || "A new reading circle, ready for its first book."}</p><div className="club-meta"><span>○ Club member</span><span>Open the shortlist</span></div></div><div className="club-actions"><button onClick={()=>openClub(club)} aria-label={`Open ${club.name}`}>→</button></div></article>)}</div>}
    </section>
    {showCreate && <div className="modal-backdrop" onMouseDown={closeCreateWizard}><section className="modal wizard-modal" role="dialog" aria-modal="true" aria-labelledby="new-club-title" onMouseDown={(e)=>e.stopPropagation()}><button className="close" onClick={closeCreateWizard} aria-label="Close">×</button><div className="wizard-steps"><span className={createStep>=1?"done":""}>1</span><i/><span className={createStep>=2?"done":""}>2</span><i/><span className={createStep>=3?"done":""}>3</span></div>{createStep===1&&<><span className="eyebrow coral">STEP 1 OF 3</span><h2 id="new-club-title">Name your book club</h2><p>Give your reading circle a name and a little personality.</p><form onSubmit={createClub}><label>Club name<input name="name" required minLength={2} maxLength={80} placeholder="e.g. Sunday Stories" autoFocus /></label><label>Description <small>Optional</small><textarea name="description" maxLength={240} placeholder="What brings this group together?" /></label><div className="form-actions"><button type="button" className="secondary" onClick={closeCreateWizard}>Cancel</button><button className="primary" disabled={busy}>{busy?"Creating…":"Next: invite members →"}</button></div></form></>}{createStep===2&&<><span className="eyebrow coral">STEP 2 OF 3</span><h2 id="new-club-title">Invite your readers</h2><p>Enter email addresses separated by commas or spaces. They’ll see the invitation when they sign in with that email.</p><form onSubmit={saveInvitations}><label>Member emails<textarea value={inviteEmails} onChange={(e)=>setInviteEmails(e.target.value)} placeholder="alex@example.com, sam@example.com" autoFocus /></label><div className="form-actions"><button type="button" className="secondary" onClick={()=>setCreateStep(3)}>Skip for now</button><button className="primary" disabled={busy}>{busy?"Adding…":"Add invitations →"}</button></div></form></>}{createStep===3&&<><span className="eyebrow coral">STEP 3 OF 3</span><h2 id="new-club-title">Build the first shortlist</h2><p>Nominate a few books now, or finish and let your members add their own suggestions.</p><div className="wizard-finish"><button className="nominate-card" onClick={()=>newClub&&openBookSearch(newClub)}><span>⌕</span><strong>Search and nominate books</strong><small>Start your club’s first vote.</small></button><div className="form-actions"><button className="secondary" onClick={closeCreateWizard}>Finish for now</button><button className="primary" onClick={()=>{if(newClub){closeCreateWizard();void openClub(newClub)}}}>Open club →</button></div></div></>}</section></div>}
    {activeClub && <div className="modal-backdrop" onMouseDown={() => setActiveClub(null)}><section className="modal club-modal" role="dialog" aria-modal="true" aria-labelledby="club-title" onMouseDown={(e)=>e.stopPropagation()}><button className="close" onClick={()=>setActiveClub(null)} aria-label="Close">×</button><span className="eyebrow coral">CLUB SHORTLIST</span><div className="club-modal-heading"><div><h2 id="club-title">{activeClub.name}</h2><p>{activeClub.description || "Choose the story your club will share next."}</p></div><button className="primary" onClick={()=>openBookSearch(activeClub)}>＋ Nominate a book</button></div>{message && <p className="notice" role="status">{message}</p>}{clubBooks.length===0 ? <button className="shortlist-empty" onClick={()=>openBookSearch(activeClub)}><strong>No books nominated yet</strong><small>Search the catalogue and add the first contender.</small></button> : <div className="shortlist">{clubBooks.map((item)=><article className={`shortlist-book ${item.is_current?"current":""} ${item.book.google_books_id===newlyNominatedId?"just-added":""}`} key={item.book.id}>{item.book.google_books_id===newlyNominatedId&&<span className="added-flag">JUST ADDED</span>}<BookCover title={item.book.title} url={item.book.cover_url}/><div><span className="pill">{item.is_current?"CURRENT READ":"NOMINATED"}</span><h3>{item.book.title}</h3><p className="byline">{item.book.authors.join(", ")||"Unknown author"}</p><small>{item.book.page_count?`${item.book.page_count} pages`:"Page count unavailable"}</small></div><div className="vote-actions"><button className={item.votes.some(v=>v.user_id===session.user.id)?"voted":""} onClick={()=>toggleVote(item.book.id)}>♥ {item.votes.length}</button>{activeClub.host_id===session.user.id&&!item.is_current&&<button className="secondary" onClick={()=>chooseBook(item.book.id)}>Choose</button>}{(activeClub.host_id===session.user.id||item.nominated_by===session.user.id)&&<button className="remove-action" onClick={()=>removeShortlistBook(item)}>Remove</button>}</div></article>)}</div>}</section></div>}
    {showSearch && <div className="modal-backdrop search-layer" onMouseDown={() => setShowSearch(false)}><section className="modal search-modal" role="dialog" aria-modal="true" aria-labelledby="book-search-title" onMouseDown={(e)=>e.stopPropagation()}><button className="close" onClick={()=>setShowSearch(false)} aria-label="Close">×</button><span className="eyebrow coral">{searchClub?"CLUB NOMINATION":"BUILD YOUR BOOKSHELF"}</span><h2 id="book-search-title">{searchClub?`Nominate for ${searchClub.name}`:"Find your next book"}</h2><p>{searchClub?"Choose a book and you’ll return to the updated shortlist, ready to vote.":"Search by title, author, or ISBN."}</p><form className="search-form" onSubmit={searchBooks}><input aria-label="Search books" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="e.g. The Midnight Library" autoFocus/><button className="primary" disabled={searching || query.trim().length < 2}>{searching ? "Searching…" : "Search"}</button></form>{message && <p className="notice" role="status">{message}</p>}<div className="search-results">{!searching && results.length === 0 && query && <p className="search-hint">Search results will appear here.</p>}{results.map((book)=>{const alreadyAdded=searchClub?clubBooks.some((item)=>item.book.google_books_id===book.catalogId):library.some((item)=>item.google_books_id===book.catalogId);return <article className="search-result" key={book.catalogId}><BookCover title={book.title} url={book.coverUrl}/><div><h3>{book.title}</h3><p className="byline">{book.authors.join(", ") || "Unknown author"}</p><small>{book.pageCount ? `${book.pageCount} pages` : "Page count unavailable"}</small>{book.description && <p>{book.description}</p>}</div><button className="secondary" disabled={savingId === book.catalogId || alreadyAdded} onClick={()=>saveBook(book)}>{alreadyAdded?"On shortlist ✓":savingId===book.catalogId?"Nominating…":searchClub?"Nominate →":"＋ Add"}</button></article>})}</div><footer className="catalogue-credit">Book information provided by Open Library</footer></section></div>}
    {confirmAction&&<div className="modal-backdrop confirm-layer" onMouseDown={()=>!confirming&&setConfirmAction(null)}><section className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(e)=>e.stopPropagation()}><button className="close" onClick={()=>setConfirmAction(null)} disabled={confirming} aria-label="Close">×</button><span className="eyebrow coral">PLEASE CONFIRM</span><h2 id="confirm-title">{confirmAction.title}</h2><p>{confirmAction.description}</p><div className="form-actions"><button className="secondary" onClick={()=>setConfirmAction(null)} disabled={confirming}>Cancel</button><button className="danger-button" onClick={runConfirmedAction} disabled={confirming}>{confirming?"Removing…":confirmAction.confirmLabel}</button></div></section></div>}
    {toast&&<div className="toast" role="status"><span>✓</span><p>{toast}</p><button onClick={()=>setToast("")} aria-label="Dismiss notification">×</button></div>}
  </main>;
}

function BookCover({title,url}:{title:string;url:string|null}) {
  return url ? <img className="book-cover" src={url} alt={`Cover of ${title}`} /> : <div className="book-cover cover-placeholder" aria-label={`No cover available for ${title}`}><span>b</span></div>;
}

function AuthScreen({mode,setMode,submit,busy,message}:{mode:AuthMode;setMode:(m:AuthMode)=>void;submit:(e:FormEvent<HTMLFormElement>)=>void;busy:boolean;message:string}) {
  const titles = { signin:["Welcome back","Continue your next chapter."], signup:["Create your account","Your first great discussion starts here."], forgot:["Reset your password","We’ll send you a secure reset link."] } as const;
  return <main className="auth-page"><section className="auth-story"><a className="brand light" href="/"><span className="brand-mark">b</span><span>booko</span></a><div className="story-copy"><span className="eyebrow gold">READ TOGETHER</span><h1>Good books<br/>become great<br/>conversations.</h1><p>Create a circle for the readers you love, then keep every chapter, gathering, and thought in one calm place.</p></div><div className="book-stack" aria-hidden="true"><i/><i/><i/></div><small>FOR BOOK CLUBS, BIG AND SMALL</small></section><section className="auth-panel"><div className="auth-card"><span className="eyebrow coral">BOOKO ACCOUNT</span><h2>{titles[mode][0]}</h2><p>{titles[mode][1]}</p><form onSubmit={submit}>{mode === "signup" && <label>Your name<input name="name" required maxLength={80} autoComplete="name" placeholder="Alex Reader" /></label>}<label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>{mode !== "forgot" && <label>Password<input name="password" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="At least 8 characters" /></label>}<button className="primary full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in →" : mode === "signup" ? "Create account →" : "Send reset link →"}</button></form>{message && <p className="notice" role="status">{message}</p>}<div className="auth-links">{mode === "signin" ? <><button onClick={()=>{setMode("forgot")}}>Forgot password?</button><span>New to Booko? <button onClick={()=>setMode("signup")}>Create an account</button></span></> : <span>Already have an account? <button onClick={()=>setMode("signin")}>Sign in</button></span>}</div></div></section></main>;
}
