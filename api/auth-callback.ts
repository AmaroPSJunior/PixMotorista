import app from '../server';

export default function handler(req: any, res: any) {
  req.url = req.url.replace(/^\/api\/auth-callback/, '/auth/callback');
  return app(req, res);
}
