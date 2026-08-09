"use client";

import { FormEvent, useState } from "react";

export type ClubView = { id:number; name:string; bookTitle:string; author:string; meetingDate:string; readingPace:string; createdAt:string; members:string[] };

export default function ClubDashboard({ initialClubs, user, signOutHref }: { initialClubs:ClubView[]; user:{displayName:string;email:string}; signOutHref:string }) {
  const [items, setItems] = useState(initialClubs);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());
    const response = await fetch("/api/clubs", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(payload) });
    const result = await response.json() as { club?:ClubView; error?:string };
    setSaving(false);
    if (!response.ok || !result.club) { setError(result.error || "We couldn’t create your club."); return; }
    setItems((current) => [result.club!, ...current]); setCreating(false);
  }

  const initials = user.displayName.split(/\s|@/).filter(Boolean).slice(0,2).map((part) => part[0]?.toUpperCase()).join("");
  return <main>
    <header className="topbar"><a className="brand" href="/" aria-label="Booko home"><span className="brand-mark">b</span><span>booko</span></a><nav aria-label="Main navigation"><a className="active" href="/clubs">My clubs</a><a href="/#features">Discover</a></nav><div className="account-menu"><div className="account-copy"><strong>{user.displayName}</strong><small>Host</small></div><span className="avatar">{initials || "B"}</span><a href={signOutHref}>Sign out</a></div></header>
    <section className="dashboard-welcome"><div><span className="eyebrow">YOUR READING CIRCLE</span><h1>Welcome back, {user.displayName.split(" ")[0].split("@")[0]}.</h1><p>{items.length ? "Your next great conversation is already taking shape." : "Every memorable book club starts with one good choice."}</p></div><button className="primary" onClick={() => setCreating(true)}>＋ Start a book club</button></section>
    <section className="clubs" id="clubs"><div className="section-heading"><div><span className="eyebrow coral">HOSTING</span><h2>Your book clubs</h2></div><span className="club-count">{items.length} {items.length === 1 ? "club" : "clubs"}</span></div>
      {items.length === 0 ? <button className="large-empty" onClick={() => setCreating(true)}><span className="plus">＋</span><strong>Start your first story</strong><small>Choose a book, invite your readers, and set the first gathering.</small><em>Create a club →</em></button> : <div className="club-grid full-grid">{items.map((club,index) => <article className="club-card" key={club.id}><div className={`cover cover-${index%3}`}><span className="cover-kicker">CURRENT READ</span><strong>{club.bookTitle}</strong><small>{club.author}</small></div><div className="club-info"><div className="status"><i /> Reading now</div><h3>{club.name}</h3><p className="book-title">{club.bookTitle}</p><div className="progress-label"><span>Reading pace</span><b>{club.readingPace}</b></div><div className="progress"><span style={{width:"12%"}} /></div><div className="meeting"><span className="calendar">▦</span><div><small>NEXT GATHERING</small><strong>{new Date(`${club.meetingDate}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}</strong></div></div><div className="card-footer"><div className="member-stack"><span className="member m0">{initials.slice(0,1)}</span>{club.members.slice(0,3).map((email,i)=><span className={`member m${i+1}`} key={email}>{email[0].toUpperCase()}</span>)}<em>{club.members.length+1} members</em></div><button>Open club <span>→</span></button></div></div></article>)}</div>}
    </section>
    {creating && <div className="modal-backdrop" role="presentation" onMouseDown={() => setCreating(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-title" onMouseDown={(e)=>e.stopPropagation()}><div className="modal-top"><div><span className="eyebrow coral">HOST A CLUB</span><h2 id="create-title">Start your reading circle</h2></div><button className="close" onClick={()=>setCreating(false)} aria-label="Close">×</button></div><p className="modal-intro">Choose the story, set the pace, and invite the people you want around the table.</p><form onSubmit={createClub}><label>Club name<input name="name" placeholder="e.g. After Hours Readers" required autoFocus maxLength={80}/></label><div className="field-row"><label>Book title<input name="bookTitle" placeholder="James" required maxLength={160}/></label><label>Author<input name="author" placeholder="Percival Everett" required maxLength={120}/></label></div><label>Invite members <span className="optional">comma separated emails</span><textarea name="members" placeholder="maya@email.com, noah@email.com" /></label><div className="field-row"><label>First gathering<input name="meetingDate" type="date" required min={new Date().toISOString().slice(0,10)} /></label><label>Reading pace<select name="readingPace" defaultValue="Steady · 25 pages/day"><option>Relaxed · 15 pages/day</option><option>Steady · 25 pages/day</option><option>Page-turner · 40 pages/day</option></select></label></div>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="secondary" onClick={()=>setCreating(false)}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving?"Creating…":"Create club →"}</button></div></form></section></div>}
  </main>;
}
