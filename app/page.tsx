"use client";

import { FormEvent, useState } from "react";

type Club = {
  name: string;
  book: string;
  author: string;
  date: string;
  members: string[];
};

const starterClub: Club = {
  name: "Sunday Stories",
  book: "The Heaven & Earth Grocery Store",
  author: "James McBride",
  date: "Aug 24, 7:00 PM",
  members: ["Maya", "Noah", "Priya", "You"],
};

export default function Home() {
  const [clubs, setClubs] = useState<Club[]>([starterClub]);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");

  function createClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const emails = String(data.get("members") || "")
      .split(",")
      .map((item) => item.trim().split("@")[0])
      .filter(Boolean);
    const title = String(data.get("book") || "James");
    const club: Club = {
      name: String(data.get("name") || "My book club"),
      book: title,
      author: String(data.get("author") || "Percival Everett"),
      date: "Sep 14, 6:30 PM",
      members: ["You", ...emails.slice(0, 3)],
    };
    setClubs((current) => [club, ...current]);
    setCreating(false);
    setNotice(`${club.name} is ready — invitations have been prepared.`);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Booko home">
          <span className="brand-mark">b</span>
          <span>booko</span>
        </a>
        <nav aria-label="Main navigation">
          <a className="active" href="#clubs">My clubs</a>
          <a href="#discover">Discover</a>
        </nav>
        <div className="header-actions">
          <button className="icon-button" aria-label="Notifications">●</button>
          <button className="avatar" aria-label="Open profile">LM</button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">YOUR READING CIRCLE</span>
          <h1>Good books are better<br />when shared.</h1>
          <p>Start a club, invite your people, and keep every thoughtful conversation in one place.</p>
          <button className="primary" onClick={() => setCreating(true)}>
            <span>＋</span> Start a book club
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="sun" />
          <div className="book book-back"><span>BOOK<br />CLUB</span></div>
          <div className="book book-mid"><span>READ<br />WITH<br />FRIENDS</span></div>
          <div className="book book-front"><span>THE<br />STORIES<br />WE SHARE</span></div>
          <div className="spark spark-one">✦</div>
          <div className="spark spark-two">✦</div>
        </div>
      </section>

      <section className="clubs" id="clubs">
        <div className="section-heading">
          <div>
            <span className="eyebrow coral">HOSTING</span>
            <h2>Your book clubs</h2>
          </div>
          <button className="text-button" onClick={() => setCreating(true)}>New club <span>→</span></button>
        </div>

        {notice && <div className="notice" role="status">✓ {notice}</div>}

        <div className="club-grid">
          {clubs.map((club, index) => (
            <article className="club-card" key={`${club.name}-${index}`}>
              <div className={`cover cover-${index % 3}`}>
                <span className="cover-kicker">CURRENT READ</span>
                <strong>{club.book}</strong>
                <small>{club.author}</small>
              </div>
              <div className="club-info">
                <div className="status"><i /> Reading now</div>
                <h3>{club.name}</h3>
                <p className="book-title">{club.book}</p>
                <div className="progress-label"><span>Group progress</span><b>{index === 0 ? "62%" : "Just started"}</b></div>
                <div className="progress"><span style={{ width: index === 0 ? "62%" : "8%" }} /></div>
                <div className="meeting">
                  <span className="calendar">▦</span>
                  <div><small>NEXT GATHERING</small><strong>{club.date}</strong></div>
                </div>
                <div className="card-footer">
                  <div className="member-stack" aria-label={`${club.members.length} members`}>
                    {club.members.slice(0, 4).map((member, memberIndex) => <span key={member} className={`member m${memberIndex}`}>{member.slice(0, 1)}</span>)}
                    <em>{club.members.length} members</em>
                  </div>
                  <button onClick={() => setNotice(`Opening ${club.name}…`)}>Open club <span>→</span></button>
                </div>
              </div>
            </article>
          ))}

          <button className="empty-card" onClick={() => setCreating(true)}>
            <span className="plus">＋</span>
            <strong>Start another story</strong>
            <small>Create a new club and bring your readers together.</small>
          </button>
        </div>
      </section>

      <section className="quote" id="discover">
        <span>“</span>
        <blockquote>A reader lives a thousand lives before he dies.</blockquote>
        <p>— GEORGE R.R. MARTIN</p>
      </section>

      {creating && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCreating(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div><span className="eyebrow coral">HOST A CLUB</span><h2 id="create-title">Start your reading circle</h2></div>
              <button className="close" onClick={() => setCreating(false)} aria-label="Close">×</button>
            </div>
            <p className="modal-intro">Choose the story, set the pace, and invite the people you want around the table.</p>
            <form onSubmit={createClub}>
              <label>Club name<input name="name" placeholder="e.g. After Hours Readers" required autoFocus /></label>
              <div className="field-row">
                <label>Book title<input name="book" placeholder="James" required /></label>
                <label>Author<input name="author" placeholder="Percival Everett" required /></label>
              </div>
              <label>Invite members <span className="optional">comma separated</span><textarea name="members" placeholder="maya@email.com, noah@email.com" /></label>
              <div className="field-row">
                <label>First gathering<input name="date" type="date" defaultValue="2026-09-14" /></label>
                <label>Reading pace<select name="pace" defaultValue="steady"><option value="relaxed">Relaxed · 15 pages/day</option><option value="steady">Steady · 25 pages/day</option><option value="fast">Page-turner · 40 pages/day</option></select></label>
              </div>
              <div className="form-actions"><button type="button" className="secondary" onClick={() => setCreating(false)}>Cancel</button><button type="submit" className="primary">Create club <span>→</span></button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
