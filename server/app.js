// Le serveur local, partagé par l'exécutable (navigateur) et l'application desktop. Il ne fait
// que deux choses — servir la page et collecter sur Prism (impossible depuis le navigateur :
// CORS et certificats auto-signés). Le document, lui, est construit dans la page, par le moteur (engine/).
import index from '../web/index.html';
import template from '../assets/asbuilt-default.docx' with { type: 'file' };
import { collectPcBundle, collectPes } from './bundle.js';
import { isBundle } from '../web/exportFile.js';

// `page` : les routes de la page. Par défaut la page embarquée (import HTML de Bun) ; l'application
// desktop passe la sienne, construite à part pour le navigateur.
// Jeton par lancement : la page le reçoit dans l'URL, toute autre origine l'ignore. Sans lui,
// n'importe quel site ouvert dans le navigateur pourrait faire collecter ce serveur local.
export function startServer(page = { '/': index }) {
  const token = crypto.randomUUID();

  // La collecte en cours, gardée en mémoire entre l'étape Prism Central et l'étape Prism Element.
  // Les identifiants, eux, ne sont jamais conservés.
  let bundle = null, ignoreSSL = true;

  const api = (handler) => ({
    POST: async (req) => {
      if (req.headers.get('x-token') !== token) return Response.json({ error: 'Jeton invalide' }, { status: 403 });
      try {
        const extra = await handler(await req.json());
        // Diagnostic : garde la collecte brute (sans identifiants) pour analyser un rendu.
        if (process.env.DUMP) await Bun.write(process.env.DUMP, JSON.stringify(bundle));
        return Response.json({ bundle, ...extra });
      } catch (err) { return Response.json({ error: err.message || String(err) }, { status: 502 }); }
    },
  });

  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: Number(process.env.PORT) || 0,
    idleTimeout: 255,   // une collecte sur un gros parc dépasse largement les 10 s par défaut
    routes: {
      ...page,
      '/template.docx': () => new Response(Bun.file(template)),
      '/api/pc': api(async (body) => {
        bundle = await collectPcBundle(body);
        ignoreSSL = body.ignoreSSL !== false;
      }),
      // Reprise d'une collecte exportée : le serveur la retrouve, pour retenter un Prism Element.
      '/api/import': api(async (body) => {
        if (!isBundle(body.bundle)) throw new Error('Collecte incomplète : Prism Central ou clusters absents');
        bundle = body.bundle;
        ignoreSSL = body.ignoreSSL !== false;
      }),
      '/api/pe': api(async ({ creds }) => {
        if (!bundle) throw new Error('Collecter le Prism Central d\'abord');
        return { errors: await collectPes(bundle, Array.isArray(creds) ? creds : [], ignoreSSL) };
      }),
    },
  });

  return { server, token, url: `http://127.0.0.1:${server.port}/#${token}` };
}
