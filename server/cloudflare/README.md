# Reviewplz — Cloudflare backend (reference)

Cloudflare Pages Functions + D1. Free tier is plenty for review work.

You can either:

- **Same-origin** — drop `functions/api/*` into the Pages project that already
  serves the site you're reviewing, add the D1 binding, done. The widget calls
  `/api/...` (default), no CORS needed.
- **Standalone** — deploy this folder on its own and point the widget at it with
  `data-api="https://reviewplz.<you>.pages.dev/api"`. The included CORS
  middleware makes cross-origin work.

## Setup

```bash
cd server/cloudflare
npm install

# 1) create the database (copy the printed database_id)
npm run db:create

# 2) wire it up
cp wrangler.toml.example wrangler.toml
#   → paste database_id into wrangler.toml

# 3) create the tables
npm run db:schema

# 4) deploy
npm run deploy
```

`deploy.sh` copies `reviewplz.js` into `public/` so the deployment also serves
the widget at `/reviewplz.js`.

## API

| Method | Path | Body / query | Purpose |
|--------|------|--------------|---------|
| GET    | `/api/comments?board=<b>` | — | list comments on a board |
| POST   | `/api/comments` | `{board,text,author,sel,fx,fy,x,y,path}` | add a comment |
| PUT    | `/api/comments` | `{board,id,text?,resolved?}` | edit a comment's text and/or set resolved |
| DELETE | `/api/comments` | `{board,id}` | delete a comment (+ its replies) |
| GET    | `/api/replies?comment=<id>` | — | list a comment's replies |
| POST   | `/api/replies` | `{comment_id,board,text,author}` | add a reply |
| DELETE | `/api/replies` | `{id}` | delete a reply |

## Upgrading

v0.4 adds a `resolved` column to `comments`. Databases created before that need
one command (fresh installs get it from `schema.sql`):

```bash
wrangler d1 execute reviewplz --remote --command \
  "ALTER TABLE comments ADD COLUMN resolved INTEGER DEFAULT 0"
```

## Reading / clearing data

```bash
# list a board's comments
wrangler d1 execute reviewplz --remote --command \
  "SELECT id,author,text FROM comments WHERE board='myboard-desktop'"

# wipe a board after a review round
wrangler d1 execute reviewplz --remote --command \
  "DELETE FROM replies WHERE board LIKE 'myboard%'; DELETE FROM comments WHERE board LIKE 'myboard%'"
```

Boards are device-scoped: a board `myboard` stores under `myboard-desktop` and
`myboard-mobile`.
