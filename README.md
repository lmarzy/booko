# Booko

Booko is a React book-club application powered by Supabase. Readers can manage a personal library, create clubs, invite members, nominate and vote on books, track reading progress, and leave reviews.

## Technology

- React 19 and Vite
- Supabase authentication and PostgreSQL
- Open Library book search through a small Netlify Function
- Static deployment on Netlify

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the Supabase project URL and publishable key.
3. Install dependencies with `pnpm install`.
4. Start the app with `pnpm dev`.

## Commands

- `pnpm dev` starts the local Vite server.
- `pnpm build` type-checks and creates the production site in `dist`.
- `pnpm test` builds and validates the static entry point and Netlify routing.
- `pnpm lint` runs ESLint.

## Netlify

Connect this repository to Netlify. The checked-in `netlify.toml` supplies the build command, publish directory, and single-page-app route fallback.

Add these environment variables in Netlify:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Supabase must also allow the Netlify production URL under **Authentication → URL Configuration**.
