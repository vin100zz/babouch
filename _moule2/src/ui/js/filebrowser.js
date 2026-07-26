'use strict';

// ── Explorateur de documents façon Windows ──────────────────────────────────
// Porté depuis famille2/src/ui/js/editor.js::_showImageBrowser, généralisé
// pour interroger l'API _moule2 (documents.php) au lieu d'un chemin fixe.

const FileBrowser = (function () {

  function open(onSelect, opts) {
    opts = opts || {};
    const root = opts.root || 'documents';
    const type = opts.type || 'image';
    const rootLabel = opts.rootLabel || root;
    const ASSET_BASE = root + '/';

    const overlay = el('div', 'imgbr-overlay');
    const modal   = el('div', 'imgbr-modal');
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });

    function _close() { document.body.removeChild(overlay); }

    async function _browse(dir) {
      modal.innerHTML = '';

      const hdr = el('div', 'imgbr-hdr');
      hdr.appendChild(txt('span', 'imgbr-title', type === 'font' ? '🔤 Sélectionner une police' : '📁 Sélectionner un document'));
      const closeBtn = el('button', 'imgbr-close');
      closeBtn.type = 'button'; closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', _close);
      hdr.appendChild(closeBtn);
      modal.appendChild(hdr);

      const crumbs = el('div', 'imgbr-breadcrumb');
      const rootCrumb = el('span', 'imgbr-crumb imgbr-crumb--link');
      rootCrumb.textContent = rootLabel;
      rootCrumb.addEventListener('click', () => _browse(''));
      crumbs.appendChild(rootCrumb);
      if (dir) {
        const parts = dir.split('/');
        parts.forEach((part, i) => {
          crumbs.appendChild(txt('span', 'imgbr-sep', ' › '));
          const isLast = i === parts.length - 1;
          const crumb = el('span', 'imgbr-crumb' + (isLast ? '' : ' imgbr-crumb--link'));
          crumb.textContent = part;
          if (!isLast) {
            const p = parts.slice(0, i + 1).join('/');
            crumb.addEventListener('click', () => _browse(p));
          }
          crumbs.appendChild(crumb);
        });
      }
      modal.appendChild(crumbs);

      const body = el('div', 'imgbr-body');
      body.textContent = 'Chargement…';
      modal.appendChild(body);

      try {
        const data = await Api.listDocuments(dir, { root, type });
        body.innerHTML = '';

        if (dir) {
          const up = el('div', 'imgbr-item imgbr-item--dir');
          up.textContent = '📁 ..';
          const parent = dir.includes('/') ? dir.replace(/\/[^/]+$/, '') : '';
          up.addEventListener('click', () => _browse(parent));
          body.appendChild(up);
        }

        data.dirs.forEach(d => {
          const item = el('div', 'imgbr-item imgbr-item--dir');
          item.textContent = '📁 ' + d.name;
          item.addEventListener('click', () => _browse(d.path));
          body.appendChild(item);
        });

        data.files.forEach(f => {
          const item = el('div', 'imgbr-item imgbr-item--file');
          if (type === 'font') {
            item.appendChild(txt('span', 'imgbr-thumb imgbr-thumb--font', '🔤'));
          } else {
            const thumb = document.createElement('img');
            thumb.src = ASSET_BASE + f.path; thumb.alt = ''; thumb.className = 'imgbr-thumb'; thumb.loading = 'lazy';
            item.appendChild(thumb);
          }
          item.appendChild(txt('span', 'imgbr-name', f.name));
          item.addEventListener('click', () => { onSelect(f.path); _close(); });
          body.appendChild(item);
        });

        if (!data.dirs.length && !data.files.length) {
          body.appendChild(txt('div', 'imgbr-empty', 'Dossier vide.'));
        }
      } catch (e) {
        body.textContent = 'Erreur : ' + e.message;
      }
    }

    _browse(opts.initialDir || '');
  }

  return { open };
})();
