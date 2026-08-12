import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import ClubPage from "../app/clubs/[id]/page";
import "../app/globals.css";

function Router() {
  const clubMatch = window.location.pathname.match(/^\/clubs\/([^/]+)\/?$/);
  return clubMatch ? <ClubPage clubId={decodeURIComponent(clubMatch[1])} /> : <Home />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
