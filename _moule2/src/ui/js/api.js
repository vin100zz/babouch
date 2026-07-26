'use strict';

// Client API générique _moule2. Chaque site charge ce fichier avec deux
// variables globales déjà définies par son index.html :
//   SITE_NAME    → nom du site (segment d'URL et clé du fichier JSON)
//   ENGINE_BASE  → chemin relatif vers le dossier _moule2 (ex: '../_moule2')

const Api = (function () {
  const baseUrl = ENGINE_BASE + '/src/server/Api';

  async function _get(endpoint, params) {
    const p = Object.assign({ site: SITE_NAME }, params || {});
    const qs = Object.keys(p)
      .filter(k => p[k] !== undefined && p[k] !== null)
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(p[k]))
      .join('&');
    const r = await fetch(baseUrl + '/' + endpoint + '?' + qs);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error || 'Erreur HTTP ' + r.status);
    }
    return r.json();
  }

  async function _post(endpoint, body) {
    const r = await fetch(baseUrl + '/' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const resp = await r.json().catch(() => ({}));
      throw new Error(resp.error || 'Erreur HTTP ' + r.status);
    }
    return r.json();
  }

  return {
    getSite() {
      return _get('site.php', {});
    },
    saveSite(data) {
      return _post('save.php', { site: SITE_NAME, data });
    },
    listDocuments(dir, opts) {
      opts = opts || {};
      return _get('documents.php', { dir: dir || '', root: opts.root || 'documents', type: opts.type || 'image' });
    },
    async uploadDocument(file, dir) {
      const form = new FormData();
      form.append('file', file);
      form.append('site', SITE_NAME);
      form.append('dir', dir || '');
      const r = await fetch(baseUrl + '/upload.php', { method: 'POST', body: form });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || 'Erreur upload HTTP ' + r.status);
      }
      return r.json();
    },
  };
})();
