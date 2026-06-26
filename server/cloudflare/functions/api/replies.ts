/// <reference types="@cloudflare/workers-types" />

// Reviewlay threaded replies, stored in Cloudflare D1 (binding DB).
// GET ?comment=<id> lists a thread; POST appends; DELETE removes one reply.

interface Env {
  DB: D1Database;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const commentId = new URL(context.request.url).searchParams.get('comment') || '';
  if (!commentId) return json([]);
  const { results } = await context.env.DB.prepare(
    'SELECT id, author, text, ts FROM replies WHERE comment_id = ?1 ORDER BY ts ASC'
  )
    .bind(commentId)
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
  const commentId = String(body.comment_id ?? '').trim();
  if (!text || !commentId) return json({ error: 'empty' }, 400);
  const r = {
    id: crypto.randomUUID(),
    comment_id: commentId,
    board: String(body.board ?? '').slice(0, 60),
    author: String(body.author ?? 'Guest').trim().slice(0, 60) || 'Guest',
    text,
    ts: Date.now(),
  };
  await context.env.DB.prepare(
    'INSERT INTO replies (id, comment_id, board, author, text, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6)'
  )
    .bind(r.id, r.comment_id, r.board, r.author, r.text, r.ts)
    .run();
  return json(r, 201);
}

export async function onRequestDelete(context: { request: Request; env: Env }): Promise<Response> {
  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  await context.env.DB.prepare('DELETE FROM replies WHERE id = ?1').bind(String(body.id || '')).run();
  return json({ ok: true });
}
