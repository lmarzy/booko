import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const accountHref = user ? "/clubs" : chatGPTSignInPath("/clubs");

  return (
    <main>
      <header className="topbar landing-nav">
        <a className="brand" href="/" aria-label="Booko home"><span className="brand-mark">b</span><span>booko</span></a>
        <nav aria-label="Main navigation"><a href="#how">How it works</a><a href="#features">Features</a></nav>
        <div className="header-actions">
          {!user && <a className="login-link" href={accountHref}>Sign in</a>}
          <a className="nav-cta" href={accountHref}>{user ? "Open my clubs" : "Create an account"} <span>→</span></a>
        </div>
      </header>

      <section className="hero public-hero">
        <div className="hero-copy">
          <span className="eyebrow">READ TOGETHER, STAY TOGETHER</span>
          <h1>Your book club,<br />beautifully organized.</h1>
          <p>Choose your next read, gather your favorite people, and keep every thoughtful conversation in one welcoming place.</p>
          <div className="hero-actions">
            <a className="primary link-button" href={accountHref}>{user ? "Go to your clubs" : "Start your first club"} <span>→</span></a>
            {!user && <span className="no-card">Free to start · no card needed</span>}
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="sun" /><div className="book book-back"><span>BOOK<br />CLUB</span></div><div className="book book-mid"><span>READ<br />WITH<br />FRIENDS</span></div><div className="book book-front"><span>THE<br />STORIES<br />WE SHARE</span></div><div className="spark spark-one">✦</div><div className="spark spark-two">✦</div>
        </div>
      </section>

      <section className="how" id="how">
        <span className="eyebrow coral">SIMPLE BY DESIGN</span><h2>From “we should” to chapter one.</h2>
        <div className="steps">
          <article><b>01</b><h3>Create your circle</h3><p>Name your club and become the host. Your private space is ready in seconds.</p></article>
          <article><b>02</b><h3>Pick the book</h3><p>Add the title, author, reading pace, and the date you want to gather.</p></article>
          <article><b>03</b><h3>Bring your people</h3><p>Invite members by email and keep everyone moving through the story together.</p></article>
        </div>
      </section>

      <section className="feature-band" id="features"><div><span className="eyebrow">YOUR SHARED SHELF</span><h2>Everything your club needs. Nothing it doesn’t.</h2></div><p>One calm home for your current read, member list, reading pace, and next gathering—protected by your account and available wherever you read.</p></section>
      <section className="quote"><span>“</span><blockquote>A reader lives a thousand lives before he dies.</blockquote><p>— GEORGE R.R. MARTIN</p></section>
    </main>
  );
}
