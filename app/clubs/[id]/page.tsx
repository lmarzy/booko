"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";

type Club={id:string;host_id:string;name:string;description:string|null;created_at:string};
type Book={catalogId:string;title:string;authors:string[];description:string|null;pageCount:number|null;coverUrl:string|null;isbn13:string|null};
type SavedBook={id:string;title:string;authors:string[];description:string|null;page_count:number|null;cover_url:string|null;google_books_id:string};
type ClubBook={is_current:boolean;status:"nominated"|"current"|"finished";completed_at:string|null;nominated_by:string;nominated_at:string;book:SavedBook;votes:{user_id:string}[]};
type Progress={user_id:string;display_name:string;current_page:number|null;progress_percent:number;finished_at:string|null};
type ConfirmAction={title:string;description:string;label:string;run:()=>Promise<void>};

export default function ClubPage(){
  const params=useParams();
  const clubId=String(params.id);
  const [session,setSession]=useState<Session|null>(null);
  const [checking,setChecking]=useState(true);
  const [club,setClub]=useState<Club|null>(null);
  const [books,setBooks]=useState<ClubBook[]>([]);
  const [progress,setProgress]=useState<Progress[]>([]);
  const [message,setMessage]=useState("");
  const [toast,setToast]=useState("");
  const [mode,setMode]=useState<"page"|"percent">("page");
  const [value,setValue]=useState("");
  const [totalPages,setTotalPages]=useState("");
  const [savingProgress,setSavingProgress]=useState(false);
  const [showSearch,setShowSearch]=useState(false);
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<Book[]>([]);
  const [searching,setSearching]=useState(false);
  const [savingId,setSavingId]=useState<string|null>(null);
  const [confirmAction,setConfirmAction]=useState<ConfirmAction|null>(null);
  const [confirming,setConfirming]=useState(false);
  const [loadingClub,setLoadingClub]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [accountOpen,setAccountOpen]=useState(false);
  const toastTimer=useRef<number|null>(null);

  useEffect(()=>{supabase.auth.getSession().then(({data})=>{if(!data.session){window.location.href="/";return;}setSession(data.session);setChecking(false);});},[]);
  useEffect(()=>{if(session)void loadClub();},[session,clubId]);
  useEffect(()=>()=>{if(toastTimer.current)window.clearTimeout(toastTimer.current);},[]);

  function notify(text:string){setToast(text);if(toastTimer.current)window.clearTimeout(toastTimer.current);toastTimer.current=window.setTimeout(()=>setToast(""),4000);}

  async function loadClub(){
    setLoadingClub(true);
    const {data,error}=await supabase.from("clubs").select("id,host_id,name,description,created_at").eq("id",clubId).single();
    if(error){setMessage("This club could not be found, or you are not a member.");setLoadingClub(false);return;}
    setClub(data);await loadBooks(false);setLoadingClub(false);
  }

  async function loadBooks(showRefresh=true){
    if(showRefresh)setRefreshing(true);
    const {data,error}=await supabase.from("club_books").select("is_current,status,completed_at,nominated_by,nominated_at,book:books(id,title,authors,description,page_count,cover_url,google_books_id),votes:book_votes(user_id)").eq("club_id",clubId).order("is_current",{ascending:false}).order("nominated_at",{ascending:false});
    if(error){setMessage(error.message);setRefreshing(false);return;}
    const loaded=(data??[]) as unknown as ClubBook[];setBooks(loaded);
    const current=loaded.find((item)=>item.is_current);
    if(current){if(!current.book.page_count)setMode("percent");await loadProgress(current.book.id);}else setProgress([]);
    setRefreshing(false);
  }

  async function loadProgress(bookId:string){const {data,error}=await supabase.rpc("get_club_reading_progress",{target_club_id:clubId,target_book_id:bookId});if(error)setMessage(error.message);else setProgress((data??[]) as Progress[]);}

  async function updateProgress(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const current=books.find((item)=>item.is_current);if(!current||value==="")return;
    setSavingProgress(true);setMessage("");const number=Number(value);
    if(mode==="page"&&!current.book.page_count){
      if(!totalPages||Number(totalPages)<1){setMessage("Enter the book's total number of pages first.");setSavingProgress(false);return;}
      const {error:pageCountError}=await supabase.rpc("set_book_page_count",{target_club_id:clubId,target_book_id:current.book.id,total_pages:Number(totalPages)});
      if(pageCountError){setMessage(pageCountError.message);setSavingProgress(false);return;}
    }
    const {error}=await supabase.rpc("update_club_reading_progress",{target_club_id:clubId,target_book_id:current.book.id,entered_page:mode==="page"?number:null,entered_percent:mode==="percent"?number:null});
    if(error)setMessage(error.message);else{await loadBooks();setValue("");setTotalPages("");notify("Your reading progress was updated.");}setSavingProgress(false);
  }

  async function toggleVote(bookId:string){const {error}=await supabase.rpc("toggle_book_vote",{target_club_id:clubId,target_book_id:bookId});if(error)setMessage(error.message);else await loadBooks();}
  async function chooseBook(bookId:string){const {error}=await supabase.rpc("select_club_book",{target_club_id:clubId,target_book_id:bookId});if(error)setMessage(error.message);else{await loadBooks();notify("The club's current book has been chosen.");}}

  function removeBook(item:ClubBook){if(!club)return;setConfirmAction({title:"Remove this nomination?",description:`“${item.book.title}” and its votes will be removed from ${club.name}.`,label:"Remove nomination",run:async()=>{const {error}=await supabase.rpc("remove_club_book",{target_club_id:clubId,target_book_id:item.book.id});if(error)setMessage(error.message);else{await loadBooks();notify("Book removed from the shortlist.");}}});}
  function finishBook(item:ClubBook){if(!club)return;setConfirmAction({title:"Finish this club read?",description:`“${item.book.title}” will move into ${club.name}'s reading history. Member progress will be kept.`,label:"Finish book",run:async()=>{const {error}=await supabase.rpc("finish_club_book",{target_club_id:clubId,target_book_id:item.book.id});if(error)setMessage(error.message);else{await loadBooks();notify("The book was added to the club's reading history.");}}});}
  async function runConfirmed(){if(!confirmAction)return;setConfirming(true);await confirmAction.run();setConfirming(false);setConfirmAction(null);}

  async function searchBooks(event:FormEvent<HTMLFormElement>){event.preventDefault();if(query.trim().length<2)return;setSearching(true);setResults([]);setMessage("");try{const response=await fetch(`/api/books/search?q=${encodeURIComponent(query.trim())}`);const data=await response.json() as {books?:Book[];error?:string};if(!response.ok)throw new Error(data.error||"Search failed");setResults(data.books??[]);}catch(error){setMessage(error instanceof Error?error.message:"Search failed");}setSearching(false);}
  async function nominate(book:Book){setSavingId(book.catalogId);const {error}=await supabase.rpc("nominate_book_to_club",{target_club_id:clubId,book_google_id:book.catalogId,book_title:book.title,book_authors:book.authors,book_description:book.description,book_page_count:book.pageCount,book_cover_url:book.coverUrl,book_isbn13:book.isbn13});if(error)setMessage(error.message);else{await loadBooks();setShowSearch(false);notify(`“${book.title}” was added to the shortlist.`);}setSavingId(null);}

  if(checking||loadingClub)return <ClubPageSkeleton/>;
  if(!club)return <main className="club-page"><header className="app-header"><a className="brand" href="/"><span className="brand-mark">b</span><span>booko</span></a></header><section className="route-error"><h1>We couldn’t open this club.</h1><p>{message}</p><a className="primary" href="/">Back to dashboard</a></section></main>;
  const current=books.find((item)=>item.is_current)??null;
  const mine=progress.find((item)=>item.user_id===session?.user.id);
  const displayName=String(session?.user.user_metadata?.display_name||session?.user.email?.split("@")[0]||"Reader");
  return <main className="club-page">
    <header className="app-header"><a className="brand" href="/"><span className="brand-mark">b</span><span>booko</span></a><a className="back-link" href="/">← Dashboard</a><div className="account-menu" onBlur={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setAccountOpen(false)}}><button className="avatar avatar-button" aria-label="Open account menu" aria-expanded={accountOpen} onClick={()=>setAccountOpen((open)=>!open)}>{displayName.slice(0,2).toUpperCase()}</button>{accountOpen&&<div className="account-popover"><span className="eyebrow coral">SIGNED IN AS</span><strong>{displayName}</strong><small>{session?.user.email}</small><button className="logout-button" onClick={()=>supabase.auth.signOut().then(()=>window.location.href="/")}>Log out →</button></div>}</div></header>
    <section className="club-page-hero"><div><span className="eyebrow gold">{club.host_id===session?.user.id?"YOU HOST THIS CLUB":"YOUR BOOK CLUB"}</span><h1>{club.name}</h1><p>{club.description||"A reading circle for shared stories and good conversation."}</p></div><button className="primary" onClick={()=>{setShowSearch(true);setQuery("");setResults([])}}>＋ Nominate a book</button></section>
    <div className="club-page-content">{refreshing&&<div className="inline-loader"><i/>Updating your club…</div>}{message&&<p className="notice">{message}</p>}
      {current?<section className="current-reading-route"><div className="route-book"><BookCover title={current.book.title} url={current.book.cover_url}/><div><span className="eyebrow gold">CURRENT READ</span><h2>{current.book.title}</h2><p className="byline">{current.book.authors.join(", ")||"Unknown author"}</p>{current.book.description&&<p className="book-description">{current.book.description}</p>}<small>{current.book.page_count?`${current.book.page_count} pages`:"Page count unavailable"}</small>{club.host_id===session?.user.id&&<button className="finish-read" onClick={()=>finishBook(current)}>Mark club book finished →</button>}</div></div><form className="route-progress" onSubmit={updateProgress}><div className="progress-form-heading"><div><span className="eyebrow">YOUR PROGRESS</span><small>{mine?.current_page!=null&&current.book.page_count?`Page ${mine.current_page} of ${current.book.page_count}`:mode==="page"&&!current.book.page_count?"Add the book length once, then track by page.":"Update after each reading session."}</small></div><div className="mode-switch"><button type="button" className={mode==="page"?"active":""} onClick={()=>setMode("page")}>Page</button><button type="button" className={mode==="percent"?"active":""} onClick={()=>setMode("percent")}>Percent</button></div></div><strong className="large-percent">{Math.round(Number(mine?.progress_percent??0))}%</strong><div className="dashboard-progress"><i style={{width:`${Number(mine?.progress_percent??0)}%`}}/></div>{mode==="page"&&!current.book.page_count&&<label className="total-pages-field"><span>Total pages in this edition</span><input type="number" min="1" max="50000" required value={totalPages} onChange={(event)=>setTotalPages(event.target.value)} placeholder="e.g. 320"/></label>}<div className="progress-entry"><input type="number" min="0" max={mode==="page"?(current.book.page_count??(totalPages?Number(totalPages):undefined)):100} step={mode==="page"?1:.1} required value={value} onChange={(event)=>setValue(event.target.value)} placeholder={mode==="page"?current.book.page_count?`0–${current.book.page_count}`:"Current page":"0–100"}/><span>{mode==="page"?"pages":"%"}</span><button className="primary" disabled={savingProgress}>{savingProgress?"Saving…":"Update"}</button></div></form></section>:<section className="no-current-read"><span>☰</span><div><span className="eyebrow coral">CHOOSE WHAT’S NEXT</span><h2>No current book selected</h2><p>Vote on the shortlist below. The host can choose the club’s next read.</p></div></section>}
      {current&&<section className="route-section"><div className="section-title"><div><span className="eyebrow coral">THE READING CIRCLE</span><h2>Member progress</h2></div><span>{progress.length} {progress.length===1?"reader":"readers"}</span></div><div className="route-members">{progress.map((reader)=><article key={reader.user_id}><span className="member-avatar">{reader.display_name.slice(0,2).toUpperCase()}</span><div><strong>{reader.user_id===session?.user.id?"You":reader.display_name}</strong><div className="member-track"><i style={{width:`${Number(reader.progress_percent)}%`}}/></div><small>{reader.current_page!=null&&current.book.page_count?`Page ${reader.current_page} of ${current.book.page_count}`:"Not started yet"}</small></div><b>{Math.round(Number(reader.progress_percent))}%</b></article>)}</div></section>}
      <section className="route-section shortlist-route"><div className="section-title"><div><span className="eyebrow coral">{current?"WHAT’S NEXT":"CHOOSE THE FIRST READ"}</span><h2>Club shortlist</h2></div><span>{books.filter((item)=>item.status==="nominated").length} nominations</span></div>{books.filter((item)=>item.status==="nominated").length===0?<button className="shortlist-empty" onClick={()=>setShowSearch(true)}><strong>No books waiting on the shortlist</strong><small>Nominate a book to start the next vote.</small></button>:<div className="shortlist">{books.filter((item)=>item.status==="nominated").map((item)=><article className="shortlist-book" key={item.book.id}><BookCover title={item.book.title} url={item.book.cover_url}/><div><span className="pill">NOMINATED</span><h3>{item.book.title}</h3><p className="byline">{item.book.authors.join(", ")||"Unknown author"}</p><small>{item.book.page_count?`${item.book.page_count} pages`:"Page count unavailable"}</small></div><div className="vote-actions"><button className={item.votes.some((vote)=>vote.user_id===session?.user.id)?"voted":""} onClick={()=>toggleVote(item.book.id)}>♥ {item.votes.length}</button>{club.host_id===session?.user.id&&!current&&<button className="secondary" onClick={()=>chooseBook(item.book.id)}>Choose</button>}{(club.host_id===session?.user.id||item.nominated_by===session?.user.id)&&<button className="remove-action" onClick={()=>removeBook(item)}>Remove</button>}</div></article>)}</div>}</section>
      {books.some((item)=>item.status==="finished")&&<section className="route-section club-history"><div className="section-title"><div><span className="eyebrow coral">CLUB HISTORY</span><h2>Books you’ve read together</h2></div><span>{books.filter((item)=>item.status==="finished").length} finished</span></div><div className="history-grid">{books.filter((item)=>item.status==="finished").map((item)=><article key={item.book.id}><BookCover title={item.book.title} url={item.book.cover_url}/><div><span className="pill">READ</span><h3>{item.book.title}</h3><p className="byline">{item.book.authors.join(", ")||"Unknown author"}</p><small>{item.completed_at?`Finished ${new Date(item.completed_at).toLocaleDateString()}`:"Finished by the club"}</small></div></article>)}</div></section>}
    </div>
    {showSearch&&<div className="modal-backdrop search-layer" onMouseDown={()=>setShowSearch(false)}><section className="modal search-modal" onMouseDown={(event)=>event.stopPropagation()}><button className="close" onClick={()=>setShowSearch(false)}>×</button><span className="eyebrow coral">CLUB NOMINATION</span><h2>Nominate for {club.name}</h2><p>Search by title, author, or ISBN.</p><form className="search-form" onSubmit={searchBooks}><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="e.g. The Midnight Library" autoFocus/><button className="primary" disabled={searching||query.trim().length<2}>{searching?"Searching…":"Search"}</button></form><div className="search-results">{results.map((book)=>{const added=books.some((item)=>item.book.google_books_id===book.catalogId);return <article className="search-result" key={book.catalogId}><BookCover title={book.title} url={book.coverUrl}/><div><h3>{book.title}</h3><p className="byline">{book.authors.join(", ")||"Unknown author"}</p><small>{book.pageCount?`${book.pageCount} pages`:"Page count unavailable"}</small>{book.description&&<p>{book.description}</p>}</div><button className="secondary" disabled={added||savingId===book.catalogId} onClick={()=>nominate(book)}>{added?"On shortlist ✓":savingId===book.catalogId?"Nominating…":"Nominate →"}</button></article>})}</div></section></div>}
    {confirmAction&&<div className="modal-backdrop confirm-layer" onMouseDown={()=>!confirming&&setConfirmAction(null)}><section className="modal confirm-modal" onMouseDown={(event)=>event.stopPropagation()}><button className="close" onClick={()=>setConfirmAction(null)}>×</button><span className="eyebrow coral">PLEASE CONFIRM</span><h2>{confirmAction.title}</h2><p>{confirmAction.description}</p><div className="form-actions"><button className="secondary" onClick={()=>setConfirmAction(null)}>Cancel</button><button className="danger-button" onClick={runConfirmed} disabled={confirming}>{confirming?"Removing…":confirmAction.label}</button></div></section></div>}
    {toast&&<div className="toast" role="status"><span>✓</span><p>{toast}</p><button onClick={()=>setToast("")}>×</button></div>}
  </main>;
}

function BookCover({title,url}:{title:string;url:string|null}){return url?<img className="book-cover" src={url} alt={`Cover of ${title}`}/>:<div className="book-cover cover-placeholder"><span>b</span></div>;}

function ClubPageSkeleton(){return <main className="club-page skeleton-page" aria-label="Loading club"><header className="app-header"><a className="brand" href="/"><span className="brand-mark">b</span><span>booko</span></a></header><section className="club-page-hero"><div className="skeleton-copy"><i/><strong/><span/></div></section><div className="club-page-content"><section className="current-reading-route skeleton-route"><div/><div/></section><section className="route-section"><div className="skeleton-title"/><div className="route-members"><div className="skeleton-row"/><div className="skeleton-row"/></div></section></div></main>;}
