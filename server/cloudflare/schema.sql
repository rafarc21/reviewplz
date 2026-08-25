-- Reviewplz D1 schema. Apply with:
--   wrangler d1 execute reviewplz --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS comments (
  id     TEXT PRIMARY KEY,
  board  TEXT,
  x      REAL,        -- fallback position: % of document width
  y      REAL,        -- fallback position: % of document height
  path   TEXT,        -- location.pathname when the comment was made
  text   TEXT,
  author TEXT,
  ts     INTEGER,     -- epoch ms
  sel    TEXT,        -- CSS path of the anchored element
  fx     REAL,        -- fractional x offset within that element (0..1)
  fy     REAL,        -- fractional y offset within that element (0..1)
  resolved INTEGER DEFAULT 0  -- 1 = resolved; the widget hides these unless the filter shows them
);
CREATE INDEX IF NOT EXISTS idx_comments_board ON comments(board);

CREATE TABLE IF NOT EXISTS replies (
  id         TEXT PRIMARY KEY,
  comment_id TEXT,
  board      TEXT,
  author     TEXT,
  text       TEXT,
  ts         INTEGER
);
CREATE INDEX IF NOT EXISTS idx_replies_comment ON replies(comment_id);
