/// <reference types="@cloudflare/workers-types" />

// Permissive CORS so the widget can also call this API cross-origin
// (e.g. host the API once and point several sites at it via data-api).
// Same-origin deploys are unaffected.

const cors: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  const res = await context.next();
  const out = new Response(res.body, res);
  for (const k in cors) out.headers.set(k, cors[k]);
  return out;
};
