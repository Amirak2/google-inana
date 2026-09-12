/** Fetch-native adapter for the retained Express-style route handlers. */
type Handler = (req: any, res: any, next: () => void) => any;
function router() {
  const routes: { method: string; path: string; handlers: Handler[] }[] = [];
  const middleware: Handler[] = [];
  const app: any = { use: (fn: Handler) => middleware.push(fn) };
  for (const method of ['get','post','put','patch','delete']) app[method] = (path: string, ...handlers: Handler[]) => routes.push({ method: method.toUpperCase(), path, handlers });
  app.fetch = async (request: Request) => {
    const url = new URL(request.url);
    const method = request.method === 'HEAD' ? 'GET' : request.method;
    const parts = url.pathname.split('/').filter(Boolean);
    const route = routes.find(r => r.method === method && r.path.split('/').filter(Boolean).length === parts.length && r.path.split('/').filter(Boolean).every((p,i) => p.startsWith(':') || p === parts[i]));
    if (!route) return Response.json({ error: 'مسیر پیدا نشد.' }, { status: 404 });
    const params: Record<string,string> = {};
    try { route.path.split('/').filter(Boolean).forEach((p,i) => { if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(parts[i]); }); }
    catch { return Response.json({ error: 'آدرس نامعتبر است.' }, { status: 400 }); }
    let body: any = {};
    if (!['GET','HEAD'].includes(request.method)) {
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > 4 * 1024 * 1024) return Response.json({ error: 'حجم درخواست بیش از حد مجاز است.' }, { status: 413 });
      const text = new TextDecoder().decode(bytes);
      try { body = text ? request.headers.get('content-type')?.includes('application/x-www-form-urlencoded') ? Object.fromEntries(new URLSearchParams(text)) : JSON.parse(text) : {}; }
      catch { return Response.json({ error: 'ساختار درخواست نامعتبر است.' }, { status: 400 }); }
    }
    const headers = Object.fromEntries(request.headers);
    headers['x-forwarded-for'] = request.headers.get('cf-connecting-ip') || 'unknown';
    const req = { method: request.method, path: url.pathname, headers, socket: { remoteAddress: headers['x-forwarded-for'] }, params, query: Object.fromEntries(url.searchParams), body };
    let output: string | undefined;
    const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
    const finish: (() => void)[] = [];
    const res: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      setHeader(key: string, value: string) { responseHeaders.set(key, value); return this; },
      on(event: string, fn: () => void) { if (event === 'finish') finish.push(fn); return this; },
      json(data: any) { responseHeaders.set('Content-Type', 'application/json; charset=utf-8'); output = JSON.stringify(data); return this; },
      send(data: any) { output = String(data); return this; },
    };
    for (const handler of [...middleware, ...route.handlers]) {
      let next = false;
      await handler(req, res, () => { next = true; });
      if (output !== undefined || !next) break;
    }
    if (output === undefined) throw new Error('Route completed without a response');
    finish.forEach(fn => fn());
    return new Response(request.method === 'HEAD' ? null : output, { status: res.statusCode, headers: responseHeaders });
  };
  return app;
}
router.json = (_options: any): Handler => (_req,_res,next) => next();
router.urlencoded = (_options: any): Handler => (_req,_res,next) => next();
export default router;
