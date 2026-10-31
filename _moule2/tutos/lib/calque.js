'use strict';

// ── Calque des tutoriels, injecté dans la page pendant l'enregistrement ──
// Exécuté dans le navigateur (page.addInitScript) avant les scripts du site.
// Dessine par-dessus l'éditeur, sans jamais intercepter la souris : curseur
// (Chromium ne filme pas le pointeur), onde de clic, sous-titre, projecteur,
// pastille de raccourci clavier et barre de progression. Le code de l'éditeur
// n'est pas modifié ; seul ce calque vit dans les vidéos.

(function () {
  if (window.__tuto) return;

  const CSS = `
    #tuto-calque { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
      font-family: "Segoe UI", system-ui, sans-serif; }
    #tuto-calque * { box-sizing: border-box; }
    .tuto-curseur { position: absolute; left: 0; top: 0; width: 30px; height: 38px; margin: -3px 0 0 -4px;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); transition: opacity .2s; }
    .tuto-onde { position: absolute; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
      border: 3px solid rgba(37,99,235,.95); background: rgba(37,99,235,.18);
      animation: tuto-onde .55s ease-out forwards; }
    @keyframes tuto-onde { from { transform: scale(.35); opacity: 1; } to { transform: scale(1.25); opacity: 0; } }
    .tuto-legende { position: absolute; bottom: 34px; transform: translateX(-50%); width: max-content;
      max-width: min(760px, calc(100% - 340px)); padding: 12px 22px; border-radius: 10px;
      background: rgba(15,23,42,.92); color: #fff; font-size: 23px; font-weight: 600; line-height: 1.35;
      text-align: center; text-wrap: balance; box-shadow: 0 6px 20px rgba(0,0,0,.25);
      opacity: 0; transition: opacity .3s, top .35s, bottom .35s; }
    .tuto-legende--visible { opacity: 1; }
    .tuto-legende--haut { bottom: auto; top: 26px; }
    .tuto-legende kbd, .tuto-touche kbd { display: inline-block; padding: 0 7px; border-radius: 5px;
      background: #fff; color: #0f172a; font: inherit; font-weight: 700; box-shadow: inset 0 -2px 0 #cbd5e1; }
    .tuto-projecteur { position: absolute; border-radius: 10px; outline: 3px solid #60a5fa;
      box-shadow: 0 0 0 9999px rgba(15,23,42,.5); opacity: 0;
      transition: opacity .35s, left .45s, top .45s, width .45s, height .45s; }
    .tuto-projecteur--visible { opacity: 1; }
    .tuto-touche { position: absolute; right: 26px; top: 26px; display: flex; gap: 6px; align-items: center;
      padding: 8px 14px; border-radius: 10px; background: rgba(15,23,42,.92); color: #fff;
      font-size: 22px; font-weight: 600; opacity: 0; transition: opacity .25s; }
    .tuto-touche--visible { opacity: 1; }
    .tuto-voile { position: absolute; inset: 0; background: rgba(15,23,42,.38); opacity: 0; transition: opacity .4s; }
    .tuto-voile--visible { opacity: 1; }
    .tuto-carte { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(.96);
      width: max-content; max-width: min(820px, calc(100% - 120px)); padding: 28px 40px; border-radius: 14px;
      background: rgba(15,23,42,.94); color: #fff; font-size: 34px; font-weight: 600; line-height: 1.3;
      text-align: center; text-wrap: balance; box-shadow: 0 18px 50px rgba(0,0,0,.35);
      opacity: 0; transition: opacity .4s, transform .4s; }
    .tuto-carte--visible { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    .tuto-carte kbd { display: inline-block; padding: 0 9px; border-radius: 6px; background: #fff; color: #0f172a;
      font: inherit; font-weight: 700; box-shadow: inset 0 -3px 0 #cbd5e1; }
    .tuto-fantome { position: absolute; left: 0; top: 0; padding: 6px 12px; border-radius: 8px;
      background: #fff; color: #1e293b; font-size: 15px; font-weight: 600; white-space: nowrap;
      border: 1px solid #93c5fd; box-shadow: 0 8px 20px rgba(15,23,42,.25); opacity: .95; }
    .tuto-titre { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%);
      padding: 34px 40px; background: rgba(15,23,42,.86); color: #fff; text-align: center;
      font-size: 46px; font-weight: 700; letter-spacing: -.01em; opacity: 0; transition: opacity .45s; }
    .tuto-titre--visible { opacity: 1; }
    .tuto-liste { position: absolute; min-width: 160px; padding: 4px; border-radius: 8px; background: #fff;
      border: 1px solid #cbd5e1; box-shadow: 0 10px 28px rgba(15,23,42,.25); font-size: 14px; color: #1e293b;
      opacity: 0; transition: opacity .2s; }
    .tuto-liste--visible { opacity: 1; }
    .tuto-liste div { padding: 6px 12px; border-radius: 5px; white-space: nowrap; }
    .tuto-liste div.choisi { background: #2563eb; color: #fff; }
    .tuto-progression { position: absolute; left: 0; right: 0; top: 0; height: 5px; display: flex; gap: 3px;
      background: rgba(15,23,42,.18); }
    .tuto-progression i { flex: 1; background: rgba(255,255,255,.55); transition: background .3s; }
    .tuto-progression i.fait { background: #2563eb; }
  `;

  const CURSEUR_SVG = '<svg viewBox="0 0 24 30" width="30" height="38" aria-hidden="true">'
    + '<path d="M2 2 L2 24 L8 18.5 L12.5 28 L16.5 26.2 L12 16.8 L20 16.8 Z" fill="#fff" stroke="#0f172a" '
    + 'stroke-width="1.8" stroke-linejoin="round"/></svg>';

  let racine, curseur, legende, projecteur, touche, progression, liste, titre, voile, carte;
  let souris = { x: -100, y: -100 };

  function monter() {
    if (racine && racine.isConnected) return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    racine = document.createElement('div');
    racine.id = 'tuto-calque';
    progression = div('tuto-progression');
    projecteur = div('tuto-projecteur');
    legende = div('tuto-legende');
    touche = div('tuto-touche');
    liste = div('tuto-liste');
    titre = div('tuto-titre');
    voile = div('tuto-voile');
    carte = div('tuto-carte');
    curseur = div('tuto-curseur');
    curseur.innerHTML = CURSEUR_SVG;
    // Le curseur passe sous la carte de lecture et le titre : ils ne sont
    // jamais masqués par lui.
    [progression, projecteur, legende, touche, liste, curseur, voile, carte, titre].forEach(n => racine.appendChild(n));
    // Hors de <body> : l'application remplace librement le contenu de la page.
    document.documentElement.appendChild(racine);
    placerCurseur();
  }

  function div(cls) { const d = document.createElement('div'); d.className = cls; return d; }

  function placerCurseur() {
    curseur.style.transform = 'translate(' + souris.x + 'px,' + souris.y + 'px)';
    eviterCurseur();
  }

  // Le sous-titre centré sur la page rendue, à droite de la barre d'édition
  // quand elle est affichée, pour ne jamais masquer les réglages.
  function centrerLegende() {
    const barre = document.querySelector('.st-sidebar');
    const gauche = barre ? barre.getBoundingClientRect().right : 0;
    legende.style.left = ((gauche + window.innerWidth) / 2) + 'px';
  }

  // Si le curseur s'approche du sous-titre, celui-ci passe en haut (ou revient).
  let hautImpose = false;
  function eviterCurseur() {
    if (!legende || !legende.classList.contains('tuto-legende--visible') || hautImpose) return;
    const r = legende.getBoundingClientRect();
    const enBas = !legende.classList.contains('tuto-legende--haut');
    if (enBas && souris.y > r.top - 60 && souris.x > r.left - 40 && souris.x < r.right + 40) {
      legende.classList.add('tuto-legende--haut');
    }
  }

  document.addEventListener('mousemove', e => {
    souris = { x: e.clientX, y: e.clientY };
    if (curseur) placerCurseur();
  }, true);

  function onde(x, y) {
    if (!racine) return;
    const o = div('tuto-onde');
    o.style.left = x + 'px';
    o.style.top = y + 'px';
    racine.appendChild(o);
    setTimeout(() => o.remove(), 600);
  }

  document.addEventListener('mousedown', e => onde(e.clientX, e.clientY), true);

  // Glisser-déposer natif (draggable) : le navigateur n'émet plus de
  // mousemove et son image fantôme n'est pas filmée. Le curseur suit donc
  // les dragover, accompagné d'une étiquette portant le texte glissé.
  let fantome = null;
  document.addEventListener('dragstart', e => {
    if (!racine) return;
    const texte = e.dataTransfer && e.dataTransfer.getData('text/plain');
    if (!texte) return;
    fantome = div('tuto-fantome');
    fantome.textContent = texte;
    racine.insertBefore(fantome, curseur);
  });
  document.addEventListener('dragover', e => {
    souris = { x: e.clientX, y: e.clientY };
    if (curseur) placerCurseur();
    if (fantome) fantome.style.transform = 'translate(' + (e.clientX + 16) + 'px,' + (e.clientY + 14) + 'px)';
  }, true);
  const finGlisser = () => { if (fantome) { fantome.remove(); fantome = null; } };
  document.addEventListener('dragend', finGlisser, true);
  document.addEventListener('drop', finGlisser, true);

  window.__tuto = {
    monter,

    legende(html, place) {
      monter();
      hautImpose = place === 'haut';
      legende.innerHTML = html;
      legende.classList.toggle('tuto-legende--haut', hautImpose);
      centrerLegende();
      legende.classList.add('tuto-legende--visible');
      eviterCurseur();
    },
    masquerLegende() { monter(); legende.classList.remove('tuto-legende--visible'); },

    eclairer(r) {
      monter();
      const m = 6;
      Object.assign(projecteur.style, {
        left: (r.x - m) + 'px', top: (r.y - m) + 'px',
        width: (r.width + 2 * m) + 'px', height: (r.height + 2 * m) + 'px',
      });
      projecteur.classList.add('tuto-projecteur--visible');
    },
    eteindre() { monter(); projecteur.classList.remove('tuto-projecteur--visible'); },

    onde,

    /** Explication de l'étape, au centre de l'écran sur un léger voile, le
     *  temps de la lire avant que les gestes ne commencent. */
    carte(html) {
      monter();
      carte.innerHTML = html;
      voile.classList.add('tuto-voile--visible');
      carte.classList.add('tuto-carte--visible');
    },
    masquerCarte() {
      monter();
      voile.classList.remove('tuto-voile--visible');
      carte.classList.remove('tuto-carte--visible');
    },

    /** Titre de la vidéo, en bandeau sur le site au tout début. */
    titre(html) { monter(); titre.innerHTML = html; titre.classList.add('tuto-titre--visible'); },
    masquerTitre() { monter(); titre.classList.remove('tuto-titre--visible'); },

    // Liste déroulante simulée : celle d'un <select> natif n'apparaît pas
    // dans le screencast. Renvoie le centre de l'option `choisi` (indice).
    liste(r, options, choisi) {
      monter();
      liste.innerHTML = '';
      options.forEach(o => {
        const d = div(''); d.textContent = o.texte;
        if (o.police) d.style.fontFamily = o.police;
        liste.appendChild(d);
      });
      Object.assign(liste.style, { left: r.x + 'px', top: (r.y + r.height + 2) + 'px', minWidth: r.width + 'px' });
      liste.classList.add('tuto-liste--visible');
      const c = liste.children[choisi].getBoundingClientRect();
      return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
    },
    choisirDansListe(i) {
      [...liste.children].forEach((d, j) => d.classList.toggle('choisi', j === i));
    },
    masquerListe() { monter(); liste.classList.remove('tuto-liste--visible'); },

    touche(html) { monter(); touche.innerHTML = html; touche.classList.add('tuto-touche--visible'); },
    masquerTouche() { monter(); touche.classList.remove('tuto-touche--visible'); },

    progression(fait, total) {
      monter();
      progression.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const seg = document.createElement('i');
        if (i < fait) seg.className = 'fait';
        progression.appendChild(seg);
      }
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monter);
  else monter();
})();
