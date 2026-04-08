# Masti Archive

A quieter Next.js tracker for books, movies, and Substack reads with built-in auth and a simple file-backed backend.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and set `SESSION_SECRET`.

3. Start the dev server:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Notes

- User accounts and entries are stored in Supabase
- Session auth uses an HTTP-only signed cookie.
- This backend is intentionally lightweight and local-friendly. It is good for personal use and prototyping.
