'use strict';

// ── Tutoriels vidéo (menu crayon › « Tutoriels vidéo ») ────────────────────
// Lecteur en fenêtre des vidéos générées par _moule2/tutos (voir son README),
// servies depuis ENGINE_BASE/tutos/videos/. Titres et dates de tournage
// viennent de videos/manifest.json, réécrit à chaque tournage : une vidéo
// refaite ou renommée apparaît ici sans toucher à ce fichier.

const VideoTutorials = (function () {

  // Ordre d'affichage ; le titre ne sert que si le manifeste est illisible.
  const VIDEOS = [
    { nom: 'accueil', titre: "Comment éditer la page d'accueil ?" },
    { nom: 'page', titre: 'Comment éditer une page ?' },
    { nom: 'style', titre: 'Comment éditer le style des pages ?' },
    { nom: 'plan', titre: 'Comment éditer le plan du site ?' },
  ];
  const BASE = ENGINE_BASE + '/tutos/videos/';

  /** Ouvre le lecteur sur la vidéo `nom` (la première par défaut). */
  async function open(nom) {
    let manifest = {};
    try {
      const r = await fetch(BASE + 'manifest.json', { cache: 'no-cache' });
      if (r.ok) manifest = await r.json();
    } catch (e) { /* titres par défaut */ }
    const list = VIDEOS.map(v => Object.assign({}, v, manifest[v.nom] || {}));
    // La date du tournage invalide le cache quand une vidéo est refaite.
    const src = (v, ext) => BASE + v.nom + '.' + ext + (v.date ? '?d=' + v.date : '');

    const overlay = el('div', 'm2-tutos');
    const dialog = el('div', 'm2-tutos__dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Tutoriels vidéo');
    overlay.appendChild(dialog);

    const head = el('div', 'm2-tutos__head');
    const title = txt('h2', 'm2-tutos__title', '');
    const close = txt('button', 'm2-tutos__close', '✕');
    close.type = 'button'; close.title = 'Fermer'; close.setAttribute('aria-label', 'Fermer');
    head.appendChild(title);
    head.appendChild(close);
    dialog.appendChild(head);

    const video = document.createElement('video');
    video.className = 'm2-tutos__video';
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    dialog.appendChild(video);

    const tabs = el('div', 'm2-tutos__list');
    tabs.setAttribute('role', 'tablist');
    const buttons = list.map(v => {
      const b = el('button', 'm2-tutos__item');
      b.type = 'button'; b.setAttribute('role', 'tab');
      const img = document.createElement('img');
      img.className = 'm2-tutos__thumb'; img.src = src(v, 'jpg'); img.alt = '';
      b.appendChild(img);
      b.appendChild(txt('span', 'm2-tutos__name', v.titre));
      b.addEventListener('click', () => show(v, true));
      tabs.appendChild(b);
      return b;
    });
    dialog.appendChild(tabs);

    function show(v, play) {
      title.textContent = v.titre;
      video.poster = src(v, 'jpg');
      video.src = src(v, 'mp4');
      buttons.forEach((b, i) => {
        const on = list[i] === v;
        b.classList.toggle('m2-tutos__item--on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      if (play) video.play().catch(() => {});
    }

    function onKey(e) { if (e.key === 'Escape') shut(); }
    function shut() {
      video.pause();
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    }
    close.addEventListener('click', shut);
    overlay.addEventListener('click', e => { if (e.target === overlay) shut(); });
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    show(list.find(v => v.nom === nom) || list[0], false);
    close.focus();
  }

  return { open };
})();
