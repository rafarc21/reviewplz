/// <reference types="@cloudflare/workers-types" />

// Reviewplz comments API, stored in Cloudflare D1 (binding DB).
// GET ?board=<board> lists; POST appends; DELETE removes (cascades to replies).

interface Env {
  DB: D1Database;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const clean = (b: string | null | undefined) =>
  (b || 'default').slice(0, 60).replace(/[^a-zA-Z0-9_-]/g, '') || 'default';

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const board = clean(new URL(context.request.url).searchParams.get('board'));
  const { results } = await context.env.DB.prepare(
    'SELECT id, x, y, path, text, author, ts, sel, fx, fy FROM comments WHERE board = ?1 ORDER BY ts ASC'
  )
    .bind(board)
    .all();
  return json(results ?? []);
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const text = String(body.text ?? '').trim().slice(0, 2000);
  if (!text) return json({ error: 'empty' }, 400);
  const board = clean(body.board);
  const frac = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.min(1, Number(v))));
  const c = {
    id: crypto.randomUUID(),
    x: Math.max(0, Math.min(100, Number(body.x) || 0)),
    y: Math.max(0, Number(body.y) || 0),
    path: String(body.path ?? '/').slice(0, 200),
    text,
    author: String(body.author ?? 'Guest').trim().slice(0, 60) || 'Guest',
    ts: Date.now(),
    sel: body.sel ? String(body.sel).slice(0, 400) : null, // element anchor (CSS path)
    fx: frac(body.fx), // fractional offset within the anchored element
    fy: frac(body.fy),
  };
  await context.env.DB.prepare(
    'INSERT INTO comments (id, board, x, y, path, text, author, ts, sel, fx, fy) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)'
  )
    .bind(c.id, board, c.x, c.y, c.path, c.text, c.author, c.ts, c.sel, c.fx, c.fy)
    .run();
  return json(c, 201);
}

export async function onRequestDelete(context: { request: Request; env: Env }): Promise<Response> {
  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const id = String(body.id || '');
  await context.env.DB.batch([
    context.env.DB.prepare('DELETE FROM comments WHERE id = ?1 AND board = ?2').bind(id, clean(body.board)),
    context.env.DB.prepare('DELETE FROM replies WHERE comment_id = ?1').bind(id), // cascade
  ]);
  return json({ ok: true });
}
