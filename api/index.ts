import app from '../server';

export default function handler(req: any, res: any) {
  const { __path, __route, ...rest } = req.query || {};
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(rest)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else if (value !== undefined) params.append(key, String(value));
  }

  const route = __route === 'auth-callback'
    ? '/auth/callback'
    : '/api/' + String(__path || '').replace(/^\\/+/, '');
  const query = params.toString();
  req.url = query ? route + '?' + query : route;

  return app(req, res);
}
