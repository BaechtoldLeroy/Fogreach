// worker/index.js — Einstieg des Cloudflare-Workers fuer fogreach.fogreach.workers.dev.
//
// Das Spiel selbst bleibt eine statische Seite (public/, vom Build kopiert).
// Nur /api/* laeuft durch diesen Code (run_worker_first in wrangler.jsonc);
// alles andere liefert die Asset-Bindung aus.
import { behandle } from './feedback.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/feedback')) return behandle(request, env);
    if (url.pathname.startsWith('/api/')) return new Response('Nicht gefunden', { status: 404 });
    return env.ASSETS.fetch(request);
  }
};
