"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthMode = "signin" | "signup" | "forgot";
type Club = { id:string; name:string; description:string | null; created_at:string };

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [clubs, setClubs] = useState<Club[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setChecking(false); });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setClubs([]); return; }
    void loadClubs();
  }, [session]);

  async function loadClubs() {
    const { data, error } = await supabase.from("clubs").select("id,name,description,created_at").order("created_at", { ascending:false });
    if (error) setMessage(error.message); else setClubs(data ?? []);
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
    <section className="welcome"><div><span className="eyebrow">YOUR READING CIRCLE</span><h1>Welcome, {displayName}.</h1><p>{clubs.length ? "Your next good conversation starts here." : "Let’s create a place for your first shared story."}</p></div><button className="primary" onClick={() => setShowCreate(true)}>＋ Create a club</button></section>
    <section className="dashboard" id="clubs"><div className="section-title"><div><span className="eyebrow coral">HOSTING & READING</span><h2>Your book clubs</h2></div><span>{clubs.length} {clubs.length === 1 ? "club" : "clubs"}</span></div>{message && <p className="notice" role="status">{message}</p>}
      {clubs.length === 0 ? <button className="empty-state" onClick={() => setShowCreate(true)}><span>＋</span><strong>Create your first book club</strong><small>Name your circle now. We’ll choose a book and invite members next.</small><em>Get started →</em></button> : <div className="club-list">{clubs.map((club,index)=><article className="club-card" key={club.id}><div className={`club-accent accent-${index%3}`}><span>{String(index+1).padStart(2,"0")}</span></div><div><span className="pill">HOST</span><h3>{club.name}</h3><p>{club.description || "A new reading circle, ready for its first book."}</p><div className="club-meta"><span>○ 1 member</span><span>Book not chosen</span></div></div><button aria-label={`Open ${club.name}`}>→</button></article>)}</div>}
    </section>
    {showCreate && <div className="modal-backdrop" onMouseDown={() => setShowCreate(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-club-title" onMouseDown={(e)=>e.stopPropagation()}><button className="close" onClick={()=>setShowCreate(false)} aria-label="Close">×</button><span className="eyebrow coral">YOUR FIRST CIRCLE</span><h2 id="new-club-title">Create a book club</h2><p>Give your new reading space a name. You can choose the book and invite people next.</p><form onSubmit={createClub}><label>Club name<input name="name" required minLength={2} maxLength={80} placeholder="e.g. Sunday Stories" autoFocus /></label><label>Description <small>Optional</small><textarea name="description" maxLength={240} placeholder="What brings this group together?" /></label><div className="form-actions"><button type="button" className="secondary" onClick={()=>setShowCreate(false)}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Creating…" : "Create club →"}</button></div></form></section></div>}
  </main>;
}

function AuthScreen({mode,setMode,submit,busy,message}:{mode:AuthMode;setMode:(m:AuthMode)=>void;submit:(e:FormEvent<HTMLFormElement>)=>void;busy:boolean;message:string}) {
  const titles = { signin:["Welcome back","Continue your next chapter."], signup:["Create your account","Your first great discussion starts here."], forgot:["Reset your password","We’ll send you a secure reset link."] } as const;
  return <main className="auth-page"><section className="auth-story"><a className="brand light" href="/"><span className="brand-mark">b</span><span>booko</span></a><div className="story-copy"><span className="eyebrow gold">READ TOGETHER</span><h1>Good books<br/>become great<br/>conversations.</h1><p>Create a circle for the readers you love, then keep every chapter, gathering, and thought in one calm place.</p></div><div className="book-stack" aria-hidden="true"><i/><i/><i/></div><small>FOR BOOK CLUBS, BIG AND SMALL</small></section><section className="auth-panel"><div className="auth-card"><span className="eyebrow coral">BOOKO ACCOUNT</span><h2>{titles[mode][0]}</h2><p>{titles[mode][1]}</p><form onSubmit={submit}>{mode === "signup" && <label>Your name<input name="name" required maxLength={80} autoComplete="name" placeholder="Alex Reader" /></label>}<label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>{mode !== "forgot" && <label>Password<input name="password" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="At least 8 characters" /></label>}<button className="primary full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in →" : mode === "signup" ? "Create account →" : "Send reset link →"}</button></form>{message && <p className="notice" role="status">{message}</p>}<div className="auth-links">{mode === "signin" ? <><button onClick={()=>{setMode("forgot")}}>Forgot password?</button><span>New to Booko? <button onClick={()=>setMode("signup")}>Create an account</button></span></> : <span>Already have an account? <button onClick={()=>setMode("signin")}>Sign in</button></span>}</div></div></section></main>;
}
