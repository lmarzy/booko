import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import HomePage from "./pages/HomePage";
import ClubPage from "./pages/ClubPage";
import "./styles/globals.css";

function Router() {
  const clubMatch = window.location.pathname.match(/^\/clubs\/([^/]+)\/?$/);
  return clubMatch ? (
    <ClubPage clubId={decodeURIComponent(clubMatch[1])} />
  ) : (
    <HomePage />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
