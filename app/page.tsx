"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthMode = "signin" | "signup" | "forgot";
type Club = { id:string; host_id:string; name:string; description:string | null; created_at:string };
type Book = { catalogId:string; title:string; authors:string[]; description:string | null; pageCount:number | null; coverUrl:string | null; isbn13:string | null };
type LibraryBook = { id:string; title:string; authors:string[]; description:string | null; page_count:number | null; cover_url:string | null; google_books_id:string };
type PersonalBook = LibraryBook & { status:"want_to_read"|"reading"|"finished"; current_page:number|null; progress_percent:number; started_at:string|null; finished_at:string|null; rating:number|null; review:string|null };
type ClubBook = { is_current:boolean; nominated_by:string; nominated_at:string; book:LibraryBook; votes:{ user_id:string }[] };
type Invitation = { id:string; expires_at:string; club:Club };
type ConfirmAction = { title:string; description:string; confirmLabel:string; run:()=>Promise<void> };
type ReadingProgress = { user_id:string; display_name:string; current_page:number|null; progress_percent:number; finished_at:string|null };
type DashboardRead = { club:Club; book:LibraryBook; progress_percent:number };

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
  const [library, setLibrary] = useState<PersonalBook[]>([]);
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
  const [readingProgress, setReadingProgress] = useState<ReadingProgress[]>([]);
  const [progressMode, setProgressMode] = useState<"page"|"percent">("page");
  const [progressValue, setProgressValue] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [dashboardReads, setDashboardReads] = useState<DashboardRead[]>([]);
  const [libraryFilter,setLibraryFilter]=useState<"want_to_read"|"reading"|"finished">("want_to_read");
  const [showPersonalProgress,setShowPersonalProgress]=useState(false);
  const [personalMode,setPersonalMode]=useState<"page"|"percent">("page");
  const [personalValue,setPersonalValue]=useState("");
  const [savingPersonal,setSavingPersonal]=useState(false);
  const [reviewTarget,setReviewTarget]=useState<PersonalBook|null>(null);
  const [reviewRating,setReviewRating]=useState(0);
  const [reviewText,setReviewText]=useState("");
  const [savingReview,setSavingReview]=useState(false);
  const [loadingDashboard,setLoadingDashboard]=useState(true);
  const [accountOpen,setAccountOpen]=useState(false);
  const messageTimer = useRef<number | null>(null);
  const nominationTimer = useRef<number | null>(null);
  const modalOpen = showCreate || showSearch || Boolean(activeClub) || Boolean(confirmAction) || showLibrary || showPersonalProgress || Boolean(reviewTarget);

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [modalOpen]);

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
    setLoadingDashboard(true);
    void Promise.all([loadClubs(), loadLibrary(), loadInvitations()]).finally(()=>setLoadingDashboard(false));
  }, [session]);

  async function loadClubs() {
    const { data, error } = await supabase.from("clubs").select("id,host_id,name,description,created_at").order("created_at", { ascending:false });
    if (error) setMessage(error.message); else { const loaded=data??[];setClubs(loaded);await loadDashboardReads(loaded); }
  }

  async function loadDashboardReads(loadedClubs:Club[]) {
    if(!loadedClubs.length){setDashboardReads([]);return;}
    const {data,error}=await supabase.from("club_books").select("club_id,book:books(id,title,authors,description,page_count,cover_url,google_books_id)").eq("is_current",true).in("club_id",loadedClubs.map((club)=>club.id));
    if(error){setMessage(error.message);return;}
    const reads=await Promise.all((data??[]).map(async(row)=>{
      const club=loadedClubs.find((item)=>item.id===row.club_id);
      if(!club||!row.book)return null;
      const {data:progress}=await supabase.rpc("get_club_reading_progress",{target_club_id:club.id,target_book_id:(row.book as unknown as LibraryBook).id});
      const mine=(progress??[]).find((item:ReadingProgress)=>item.user_id===session?.user.id);
      return {club,book:row.book as unknown as LibraryBook,progress_percent:Number(mine?.progress_percent??0)};
    }));
    setDashboardReads(reads.filter(Boolean) as DashboardRead[]);
  }

  async function openClub(club:Club) {
    window.location.href=`/clubs/${club.id}`;
  }

  async function loadClubBooks(clubId:string) {
    const { data, error } = await supabase.from("club_books").select("is_current,nominated_by,nominated_at,book:books(id,title,authors,description,page_count,cover_url,google_books_id),votes:book_votes(user_id)").eq("club_id",clubId).order("is_current",{ascending:false}).order("nominated_at",{ascending:false});
    if (error) { setMessage(error.message); return; }
    const books=(data ?? []) as unknown as ClubBook[];
    setClubBooks(books);
    const current=books.find((item)=>item.is_current);
    if(current){if(!current.book.page_count)setProgressMode("percent");await loadReadingProgress(clubId,current.book.id);}else setReadingProgress([]);
  }

  async function loadReadingProgress(clubId:string,bookId:string) {
    const {data,error}=await supabase.rpc("get_club_reading_progress",{target_club_id:clubId,target_book_id:bookId});
    if(error)setMessage(error.message);else setReadingProgress((data??[]) as ReadingProgress[]);
  }

  async function updateReadingProgress(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current=clubBooks.find((item)=>item.is_current);
    if(!activeClub||!current||progressValue==="")return;
    setSavingProgress(true);setMessage("");
    const numericValue=Number(progressValue);
    const {error}=await supabase.rpc("update_club_reading_progress",{
      target_club_id:activeClub.id,target_book_id:current.book.id,
      entered_page:progressMode==="page"?numericValue:null,
      entered_percent:progressMode==="percent"?numericValue:null
    });
    if(error)setMessage(error.message);else{
      await loadReadingProgress(activeClub.id,current.book.id);
      setProgressValue("");showTemporaryMessage("Your reading progress was updated.");
    }
    setSavingProgress(false);
  }

  function openBookSearch(club:Club|null = null) {
    setSearchClub(club); setShowSearch(true); setQuery(""); setResults([]); setMessage("");
  }

  async function loadLibrary() {
    const { data, error } = await supabase.from("user_books").select("status,current_page,progress_percent,started_at,finished_at,created_at,book:books(id,title,authors,description,page_count,cover_url,google_books_id)").order("created_at", { ascending:false });
    if (error) { setMessage(error.message); return; }
    const {data:reviews}=await supabase.from("reading_reviews").select("book_id,rating,review").is("club_id",null);
    setLibrary((data ?? []).flatMap((row) => row.book ? [{...(row.book as unknown as LibraryBook),status:row.status,current_page:row.current_page,progress_percent:Number(row.progress_percent),started_at:row.started_at,finished_at:row.finished_at,rating:Number(reviews?.find((review)=>review.book_id===(row.book as unknown as LibraryBook).id)?.rating)||null,review:reviews?.find((review)=>review.book_id===(row.book as unknown as LibraryBook).id)?.review??null} as PersonalBook] : []));
  }

  function startPersonalBook(book:PersonalBook){
    const current=library.find((item)=>item.status==="reading");
    const run=async()=>{const {error}=await supabase.rpc("start_personal_book",{target_book_id:book.id});if(error)setMessage(error.message);else{await loadLibrary();setShowLibrary(false);setShowPersonalProgress(true);showTemporaryMessage(`You’re now reading “${book.title}”.`);}};
    if(current&&current.id!==book.id)setConfirmAction({title:"Change your personal read?",description:`“${current.title}” will return to Want to read, and “${book.title}” will become your current personal book.`,confirmLabel:"Start new book",run});else void run();
  }

  async function updatePersonalProgress(event:FormEvent<HTMLFormElement>){event.preventDefault();const current=library.find((item)=>item.status==="reading");if(!current||personalValue==="")return;setSavingPersonal(true);const number=Number(personalValue);const completed=personalMode==="percent"?number===100:number===current.page_count;const {error}=await supabase.rpc("update_personal_reading_progress",{target_book_id:current.id,entered_page:personalMode==="page"?number:null,entered_percent:personalMode==="percent"?number:null});if(error)setMessage(error.message);else{await loadLibrary();setPersonalValue("");if(completed){setShowPersonalProgress(false);setReviewTarget(current);setReviewRating(current.rating??0);setReviewText(current.review??"");}else showTemporaryMessage("Your personal reading progress was updated.");}setSavingPersonal(false);}

  function openPersonalReview(book:PersonalBook){setReviewTarget(book);setReviewRating(book.rating??0);setReviewText(book.review??"");}
  async function savePersonalReview(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!reviewTarget||reviewRating<1)return;setSavingReview(true);const {error}=await supabase.rpc("save_reading_review",{target_book_id:reviewTarget.id,target_rating:reviewRating,review_text:reviewText,target_club_id:null});if(error)setMessage(error.message);else{await loadLibrary();setReviewTarget(null);showTemporaryMessage(`Your review of “${reviewTarget.title}” was saved.`);}setSavingReview(false);}

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
      setNewlyNominatedId(book.catalogId);
      setShowSearch(false);
      setSearchClub(null);
      if(showCreate)closeCreateWizard();
      window.location.href=`/clubs/${nominatedClub.id}`;
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
  const currentClubBook=clubBooks.find((item)=>item.is_current)??null;
  const personalCurrent=library.find((book)=>book.status==="reading")??null;
  return <main className="app-shell">
    <header className="app-header"><a className="brand" href="/"><span className="brand-mark">b</span><span>booko</span></a><div className="account-menu" onBlur={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setAccountOpen(false)}}><button className="avatar avatar-button" aria-label="Open account menu" aria-expanded={accountOpen} onClick={()=>setAccountOpen((open)=>!open)}>{displayName.slice(0,2).toUpperCase()}</button>{accountOpen&&<div className="account-popover"><span className="eyebrow coral">SIGNED IN AS</span><strong>{displayName}</strong><small>{session.user.email}</small><button className="logout-button" onClick={()=>supabase.auth.signOut()}>Log out →</button></div>}</div></header>
    <section className="welcome dashboard-welcome"><div><span className="eyebrow">YOUR READING CIRCLE</span><h1>Welcome, {displayName}.</h1><p>{clubs.length ? "Pick up where you left off, or see what your clubs are reading." : "Let’s create a place for your first shared story."}</p></div><div className="welcome-actions"><button className="secondary" disabled={loadingDashboard} onClick={() => setShowLibrary(true)}>▤ {loadingDashboard?"Loading library…":"My library"} {!loadingDashboard&&<span>{library.length}</span>}</button><button className="primary" onClick={() => {setCreateStep(1);setNewClub(null);setShowCreate(true)}}>＋ Create a club</button></div></section>
    {pendingInvites.length>0&&<section className="invite-tray" aria-label="Club invitations"><span className="eyebrow">YOU'RE INVITED</span>{pendingInvites.map((invite)=><article key={invite.id}><div><strong>{invite.club.name}</strong><small>{invite.club.description||"A reading circle would like you to join."}</small></div><div><button className="secondary" onClick={()=>respondToInvite(invite.id,false)}>Decline</button><button className="primary" onClick={()=>respondToInvite(invite.id,true)}>Accept</button></div></article>)}</section>}
    <section className="dashboard current-dashboard"><div className="section-title"><div><span className="eyebrow coral">CURRENTLY READING</span><h2>Your active books</h2></div><span>{loadingDashboard?"Loading…":`${dashboardReads.length+(library.some((book)=>book.status==="reading")?1:0)} in progress`}</span></div>{loadingDashboard?<LoadingCards count={2} variant="read"/>:dashboardReads.length===0&&!library.some((book)=>book.status==="reading")?<div className="quiet-empty"><span>☰</span><div><strong>No current reads yet</strong><small>Start a personal book from your library, or choose one with a club.</small></div></div>:<div className="current-read-grid">{library.filter((book)=>book.status==="reading").map((book)=><button className="current-read-card personal-read-card" onClick={()=>{if(!book.page_count)setPersonalMode("percent");setShowPersonalProgress(true)}} key={book.id}><BookCover title={book.title} url={book.cover_url}/><div><span className="eyebrow gold">PERSONAL READ</span><h3>{book.title}</h3><p className="byline">{book.authors.join(", ")||"Unknown author"}</p><div className="dashboard-progress"><i style={{width:`${book.progress_percent}%`}}/></div><strong>{Math.round(book.progress_percent)}% complete</strong></div><b>Update →</b></button>)}{dashboardReads.map((read)=><a className="current-read-card" href={`/clubs/${read.club.id}`} key={read.club.id}><BookCover title={read.book.title} url={read.book.cover_url}/><div><span className="eyebrow gold">{read.club.name}</span><h3>{read.book.title}</h3><p className="byline">{read.book.authors.join(", ")||"Unknown author"}</p><div className="dashboard-progress"><i style={{width:`${read.progress_percent}%`}}/></div><strong>{Math.round(read.progress_percent)}% complete</strong></div><b>Continue →</b></a>)}</div>}</section>
    <section className="dashboard" id="clubs"><div className="section-title"><div><span className="eyebrow coral">HOSTING & READING</span><h2>Your book clubs</h2></div><span>{clubs.length} {clubs.length === 1 ? "club" : "clubs"}</span></div>{message && <p className="notice" role="status">{message}</p>}
      {loadingDashboard?<LoadingCards count={2} variant="club"/>:clubs.length === 0 ? <button className="empty-state" onClick={() => setShowCreate(true)}><span>＋</span><strong>Create your first book club</strong><small>Name your circle now. We’ll choose a book and invite members next.</small><em>Get started →</em></button> : <div className="club-list">{clubs.map((club,index)=><article className="club-card" key={club.id}>{club.host_id===session.user.id&&<button className="delete-control" onClick={()=>deleteClub(club)} aria-label={`Delete ${club.name}`}>×</button>}<div className={`club-accent accent-${index%3}`}><span>{String(index+1).padStart(2,"0")}</span></div><div><span className="pill">{club.host_id===session.user.id ? "HOST" : "MEMBER"}</span><h3>{club.name}</h3><p>{club.description || "A new reading circle, ready for its first book."}</p><div className="club-meta"><span>○ Club member</span><span>View club and reading progress</span></div></div><div className="club-actions"><a href={`/clubs/${club.id}`} aria-label={`Open ${club.name}`}>→</a></div></article>)}</div>}
    </section>
    {showLibrary&&<div className="modal-backdrop" onMouseDown={()=>setShowLibrary(false)}><section className="modal library-modal" role="dialog" aria-modal="true" aria-labelledby="library-title" onMouseDown={(event)=>event.stopPropagation()}><button className="close" onClick={()=>setShowLibrary(false)} aria-label="Close">×</button><div className="library-modal-heading"><div><span className="eyebrow coral">MY PERSONAL LIBRARY</span><h2 id="library-title">Your books</h2><p>Independent from every club shortlist and reading history.</p></div></div><div className="library-tabs"><div className="library-tab-options"><button className={libraryFilter==="want_to_read"?"active":""} onClick={()=>setLibraryFilter("want_to_read")}>Want to read <span>{library.filter((book)=>book.status==="want_to_read").length}</span></button><button className={libraryFilter==="reading"?"active":""} onClick={()=>setLibraryFilter("reading")}>Reading <span>{library.filter((book)=>book.status==="reading").length}</span></button><button className={libraryFilter==="finished"?"active":""} onClick={()=>setLibraryFilter("finished")}>Finished <span>{library.filter((book)=>book.status==="finished").length}</span></button></div><button className="library-find" onClick={()=>openBookSearch()}>⌕ Find a book</button></div>{message&&<p className="notice">{message}</p>}{library.filter((book)=>book.status===libraryFilter).length===0?<div className="library-filter-empty"><strong>No books here yet</strong><small>{libraryFilter==="want_to_read"?"Search for a book and save it to your personal library.":libraryFilter==="reading"?"Start a book from your Want to read list.":"Books you complete will move here automatically."}</small></div>:<div className="book-grid">{library.filter((book)=>book.status===libraryFilter).map((book)=><article className="book-card library-book-card" key={book.id}>{book.status!=="reading"&&<button className="delete-control" onClick={()=>removeLibraryBook(book)} aria-label={`Remove ${book.title}`}>×</button>}<BookCover title={book.title} url={book.cover_url}/><div><span className="pill">{book.status==="finished"?"READ":book.status==="reading"?"READING":"WANT TO READ"}</span><h3>{book.title}</h3><p className="byline">{book.authors.join(", ")||"Unknown author"}</p><small>{book.status==="reading"?`${Math.round(book.progress_percent)}% complete`:book.status==="finished"&&book.rating?`${"★".repeat(book.rating)}${"☆".repeat(5-book.rating)}`:book.page_count?`${book.page_count} pages`:"Page count unavailable"}</small>{book.status!=="finished"?<button className="book-action" onClick={()=>book.status==="reading"?(setShowLibrary(false),setShowPersonalProgress(true)):startPersonalBook(book)}>{book.status==="reading"?"Update progress →":"Start reading →"}</button>:<button className="book-action" onClick={()=>openPersonalReview(book)}>{book.rating?"Edit review →":"Rate & review →"}</button>}</div></article>)}</div>}</section></div>}
    {showPersonalProgress&&personalCurrent&&<div className="modal-backdrop" onMouseDown={()=>setShowPersonalProgress(false)}><section className="modal personal-progress-modal" role="dialog" aria-modal="true" onMouseDown={(event)=>event.stopPropagation()}><button className="close" onClick={()=>setShowPersonalProgress(false)}>×</button><span className="eyebrow coral">PERSONAL READ</span><div className="personal-progress-book"><BookCover title={personalCurrent.title} url={personalCurrent.cover_url}/><div><h2>{personalCurrent.title}</h2><p className="byline">{personalCurrent.authors.join(", ")||"Unknown author"}</p><strong>{Math.round(personalCurrent.progress_percent)}% complete</strong><div className="dashboard-progress"><i style={{width:`${personalCurrent.progress_percent}%`}}/></div></div></div><form className="personal-progress-form" onSubmit={updatePersonalProgress}><div className="progress-form-heading"><div><span className="eyebrow">UPDATE YOUR PROGRESS</span><small>{personalCurrent.current_page!=null&&personalCurrent.page_count?`Page ${personalCurrent.current_page} of ${personalCurrent.page_count}`:"Use a page number or percentage."}</small></div><div className="mode-switch"><button type="button" className={personalMode==="page"?"active":""} disabled={!personalCurrent.page_count} onClick={()=>setPersonalMode("page")}>Page</button><button type="button" className={personalMode==="percent"?"active":""} onClick={()=>setPersonalMode("percent")}>Percent</button></div></div><div className="progress-entry"><input type="number" min="0" max={personalMode==="page"?(personalCurrent.page_count??undefined):100} step={personalMode==="page"?1:.1} required value={personalValue} onChange={(event)=>setPersonalValue(event.target.value)} placeholder={personalMode==="page"?`0–${personalCurrent.page_count??"?"}`:"0–100"}/><span>{personalMode==="page"?"pages":"%"}</span><button className="primary" disabled={savingPersonal}>{savingPersonal?"Saving…":"Update"}</button></div></form></section></div>}
    {showCreate && <div className="modal-backdrop" onMouseDown={closeCreateWizard}><section className="modal wizard-modal" role="dialog" aria-modal="true" aria-labelledby="new-club-title" onMouseDown={(e)=>e.stopPropagation()}><button className="close" onClick={closeCreateWizard} aria-label="Close">×</button><div className="wizard-steps"><span className={createStep>=1?"done":""}>1</span><i/><span className={createStep>=2?"done":""}>2</span><i/><span className={createStep>=3?"done":""}>3</span></div>{createStep===1&&<><span className="eyebrow coral">STEP 1 OF 3</span><h2 id="new-club-title">Name your book club</h2><p>Give your reading circle a name and a little personality.</p><form onSubmit={createClub}><label>Club name<input name="name" required minLength={2} maxLength={80} placeholder="e.g. Sunday Stories" autoFocus /></label><label>Description <small>Optional</small><textarea name="description" maxLength={240} placeholder="What brings this group together?" /></label><div className="form-actions"><button type="button" className="secondary" onClick={closeCreateWizard}>Cancel</button><button className="primary" disabled={busy}>{busy?"Creating…":"Next: invite members →"}</button></div></form></>}{createStep===2&&<><span className="eyebrow coral">STEP 2 OF 3</span><h2 id="new-club-title">Invite your readers</h2><p>Enter email addresses separated by commas or spaces. They’ll see the invitation when they sign in with that email.</p><form onSubmit={saveInvitations}><label>Member emails<textarea value={inviteEmails} onChange={(e)=>setInviteEmails(e.target.value)} placeholder="alex@example.com, sam@example.com" autoFocus /></label><div className="form-actions"><button type="button" className="secondary" onClick={()=>setCreateStep(3)}>Skip for now</button><button className="primary" disabled={busy}>{busy?"Adding…":"Add invitations →"}</button></div></form></>}{createStep===3&&<><span className="eyebrow coral">STEP 3 OF 3</span><h2 id="new-club-title">Build the first shortlist</h2><p>Nominate a few books now, or finish and let your members add their own suggestions.</p><div className="wizard-finish"><button className="nominate-card" onClick={()=>newClub&&openBookSearch(newClub)}><span>⌕</span><strong>Search and nominate books</strong><small>Start your club’s first vote.</small></button><div className="form-actions"><button className="secondary" onClick={closeCreateWizard}>Finish for now</button><button className="primary" onClick={()=>{if(newClub){closeCreateWizard();void openClub(newClub)}}}>Open club →</button></div></div></>}</section></div>}
    {showSearch && <div className="modal-backdrop search-layer" onMouseDown={() => setShowSearch(false)}><section className="modal search-modal" role="dialog" aria-modal="true" aria-labelledby="book-search-title" onMouseDown={(e)=>e.stopPropagation()}><button className="close" onClick={()=>setShowSearch(false)} aria-label="Close">×</button><span className="eyebrow coral">{searchClub?"CLUB NOMINATION":"BUILD YOUR BOOKSHELF"}</span><h2 id="book-search-title">{searchClub?`Nominate for ${searchClub.name}`:"Find your next book"}</h2><p>{searchClub?"Choose a book and you’ll return to the updated shortlist, ready to vote.":"Search by title, author, or ISBN."}</p><form className="search-form" onSubmit={searchBooks}><input aria-label="Search books" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="e.g. The Midnight Library" autoFocus/><button className="primary" disabled={searching || query.trim().length < 2}>{searching ? "Searching…" : "Search"}</button></form>{message && <p className="notice" role="status">{message}</p>}<div className="search-results">{!searching && results.length === 0 && query && <p className="search-hint">Search results will appear here.</p>}{results.map((book)=>{const alreadyAdded=searchClub?clubBooks.some((item)=>item.book.google_books_id===book.catalogId):library.some((item)=>item.google_books_id===book.catalogId);return <article className="search-result" key={book.catalogId}><BookCover title={book.title} url={book.coverUrl}/><div><h3>{book.title}</h3><p className="byline">{book.authors.join(", ") || "Unknown author"}</p><small>{book.pageCount ? `${book.pageCount} pages` : "Page count unavailable"}</small>{book.description && <p>{book.description}</p>}</div><button className="secondary" disabled={savingId === book.catalogId || alreadyAdded} onClick={()=>saveBook(book)}>{alreadyAdded?"On shortlist ✓":savingId===book.catalogId?"Nominating…":searchClub?"Nominate →":"＋ Add"}</button></article>})}</div><footer className="catalogue-credit">Book information provided by Open Library</footer></section></div>}
    {confirmAction&&<div className="modal-backdrop confirm-layer" onMouseDown={()=>!confirming&&setConfirmAction(null)}><section className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(e)=>e.stopPropagation()}><button className="close" onClick={()=>setConfirmAction(null)} disabled={confirming} aria-label="Close">×</button><span className="eyebrow coral">PLEASE CONFIRM</span><h2 id="confirm-title">{confirmAction.title}</h2><p>{confirmAction.description}</p><div className="form-actions"><button className="secondary" onClick={()=>setConfirmAction(null)} disabled={confirming}>Cancel</button><button className="danger-button" onClick={runConfirmedAction} disabled={confirming}>{confirming?"Removing…":confirmAction.confirmLabel}</button></div></section></div>}
    {toast&&<div className="toast" role="status"><span>✓</span><p>{toast}</p><button onClick={()=>setToast("")} aria-label="Dismiss notification">×</button></div>}
    {reviewTarget&&<div className="modal-backdrop review-layer" onMouseDown={()=>!savingReview&&setReviewTarget(null)}><section className="modal review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onMouseDown={(event)=>event.stopPropagation()}><button className="close" onClick={()=>setReviewTarget(null)} disabled={savingReview} aria-label="Close">×</button><span className="eyebrow coral">BOOK FINISHED</span><h2 id="review-title">How was {reviewTarget.title}?</h2><p>Your rating and review stay in your personal reading history.</p><form onSubmit={savePersonalReview}><fieldset className="star-rating"><legend>Your rating</legend>{[1,2,3,4,5].map((star)=><button type="button" key={star} className={star<=reviewRating?"selected":""} onClick={()=>setReviewRating(star)} aria-label={`${star} star${star===1?"":"s"}`}>★</button>)}</fieldset><label>Your review <small>Optional</small><textarea maxLength={2000} value={reviewText} onChange={(event)=>setReviewText(event.target.value)} placeholder="What stayed with you after the final page?"/></label><div className="form-actions"><button type="button" className="secondary" onClick={()=>{setReviewTarget(null);showTemporaryMessage("Book moved to your finished library.")}} disabled={savingReview}>Skip for now</button><button className="primary" disabled={savingReview||reviewRating<1}>{savingReview?"Saving…":"Save review →"}</button></div></form></section></div>}
  </main>;
}

function BookCover({title,url}:{title:string;url:string|null}) {
  return url ? <img className="book-cover" src={url} alt={`Cover of ${title}`} /> : <div className="book-cover cover-placeholder" aria-label={`No cover available for ${title}`}><span>b</span></div>;
}

function LoadingCards({count,variant}:{count:number;variant:"read"|"club"}){return <div className={variant==="read"?"current-read-grid":"club-list"} aria-label="Loading content">{Array.from({length:count},(_,index)=><div className={`skeleton-card skeleton-${variant}`} key={index}><i/><div><span/><strong/><small/><em/></div></div>)}</div>;}

function ProgressPanel({book,progress,currentUserId,mode,setMode,value,setValue,saving,submit}:{book:LibraryBook;progress:ReadingProgress[];currentUserId:string;mode:"page"|"percent";setMode:(mode:"page"|"percent")=>void;value:string;setValue:(value:string)=>void;saving:boolean;submit:(event:FormEvent<HTMLFormElement>)=>void}) {
  const mine=progress.find((item)=>item.user_id===currentUserId);
  return <section className="reading-panel">
    <div className="reading-summary"><BookCover title={book.title} url={book.cover_url}/><div><span className="eyebrow gold">NOW READING</span><h3>{book.title}</h3><p>{book.authors.join(", ")||"Unknown author"}</p><strong>{Math.round(Number(mine?.progress_percent||0))}% complete</strong><div className="progress-track"><i style={{width:`${Number(mine?.progress_percent||0)}%`}}/></div></div></div>
    <form className="progress-form" onSubmit={submit}><div className="progress-form-heading"><div><span className="eyebrow">YOUR PROGRESS</span><small>{mine?.current_page!=null&&book.page_count?`Page ${mine.current_page} of ${book.page_count}`:"Update whenever you finish a reading session."}</small></div><div className="mode-switch"><button type="button" className={mode==="page"?"active":""} onClick={()=>setMode("page")} disabled={!book.page_count}>Page</button><button type="button" className={mode==="percent"?"active":""} onClick={()=>setMode("percent")}>Percent</button></div></div><div className="progress-entry"><input type="number" min="0" max={mode==="page"?(book.page_count??undefined):100} step={mode==="page"?1:0.1} required value={value} onChange={(event)=>setValue(event.target.value)} placeholder={mode==="page"?`0–${book.page_count??"?"}`:"0–100"}/><span>{mode==="page"?"pages":"%"}</span><button className="primary" disabled={saving}>{saving?"Saving…":"Update"}</button></div></form>
    <div className="member-progress"><div className="member-progress-title"><span className="eyebrow">THE READING CIRCLE</span><small>{progress.length} {progress.length===1?"reader":"readers"}</small></div>{progress.map((reader)=><div className="member-row" key={reader.user_id}><span className="member-avatar">{reader.display_name.slice(0,2).toUpperCase()}</span><div><strong>{reader.user_id===currentUserId?"You":reader.display_name}</strong><div className="member-track"><i style={{width:`${Number(reader.progress_percent)}%`}}/></div></div><b>{Math.round(Number(reader.progress_percent))}%</b></div>)}</div>
  </section>;
}

function AuthScreen({mode,setMode,submit,busy,message}:{mode:AuthMode;setMode:(m:AuthMode)=>void;submit:(e:FormEvent<HTMLFormElement>)=>void;busy:boolean;message:string}) {
  const titles = { signin:["Welcome back","Continue your next chapter."], signup:["Create your account","Your first great discussion starts here."], forgot:["Reset your password","We’ll send you a secure reset link."] } as const;
  return <main className="auth-page"><section className="auth-story"><a className="brand light" href="/"><span className="brand-mark">b</span><span>booko</span></a><div className="story-copy"><span className="eyebrow gold">READ TOGETHER</span><h1>Good books<br/>become great<br/>conversations.</h1><p>Create a circle for the readers you love, then keep every chapter, gathering, and thought in one calm place.</p></div><div className="book-stack" aria-hidden="true"><i/><i/><i/></div><small>FOR BOOK CLUBS, BIG AND SMALL</small></section><section className="auth-panel"><div className="auth-card"><span className="eyebrow coral">BOOKO ACCOUNT</span><h2>{titles[mode][0]}</h2><p>{titles[mode][1]}</p><form onSubmit={submit}>{mode === "signup" && <label>Your name<input name="name" required maxLength={80} autoComplete="name" placeholder="Alex Reader" /></label>}<label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>{mode !== "forgot" && <label>Password<input name="password" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="At least 8 characters" /></label>}<button className="primary full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in →" : mode === "signup" ? "Create account →" : "Send reset link →"}</button></form>{message && <p className="notice" role="status">{message}</p>}<div className="auth-links">{mode === "signin" ? <><button onClick={()=>{setMode("forgot")}}>Forgot password?</button><span>New to Booko? <button onClick={()=>setMode("signup")}>Create an account</button></span></> : <span>Already have an account? <button onClick={()=>setMode("signin")}>Sign in</button></span>}</div></div></section></main>;
}
