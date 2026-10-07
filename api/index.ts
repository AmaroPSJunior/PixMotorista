export default async function handler(req: any, res: any) {
  const { __path, __route, ...rest } = req.query || {};
  const rawPath = Array.isArray(__path) ? __path.join('/') : String(__path || '');

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(rest)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else if (value !== undefined) params.append(key, String(value));
  }

  const route = __route === 'auth-callback'
    ? '/auth/callback'
    : '/api/' + rawPath.replace(/^\/+/, '');
  const query = params.toString();
  req.url = query ? route + '?' + query : route;

  const serverModulePath = '../dist/server.cjs';
  const mod: any = await import(serverModulePath);
  const app = mod.default?.default || mod.default || mod;
  return app(req, res);
}
