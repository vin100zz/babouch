'use strict';

// ── Réglages communs aux éditeurs de l'accueil et du style des pages ───────
// Listes de lignes pour PropsPanel.render (en-tête, titre du site, fond…).
// `change(key, fn, opts)` est fourni par l'éditeur : instantané pour
// « Annuler », exécution de fn (qui modifie la copie de travail), puis mise à
// jour de la page (et du panneau si opts.panel).

const StyleItems = (function () {

  const MODES = [['cover', 'Remplir'], ['contain', 'Entière'], ['repeat', 'Mosaïque']];
  // Valeurs d'app.css, affichées tant que le site ne les a pas réglées.
  const HEADER_PADDING = { padY: 0, padX: 24 };

  /** Copie les clés de `patch` dans `obj` ; une valeur null ou '' retire la
   *  clé (le rendu retombe alors sur le CSS, comme avant tout réglage). */
  function assign(obj, patch) {
    Object.keys(patch).forEach(k => {
      if (patch[k] == null || patch[k] === '') delete obj[k];
      else obj[k] = patch[k];
    });
    return obj;
  }

  /** Complète les objets de style manquants (sites anciens, site neuf) sans
   *  ajouter aucune des clés facultatives (marges, polices…) : seules celles
   *  que l'utilisateur règle seront écrites dans data.json. */
  function normalize(site) {
    if (!site.home) site.home = {};
    if (!Array.isArray(site.home.images)) site.home.images = [];
    site.home.headerStyle = Object.assign({}, HomeView.DEFAULT_HEADER_STYLE, site.home.headerStyle || {});
    site.home.background = Object.assign({}, HomeView.DEFAULT_BACKGROUND, site.home.background || {});
    const ps = site.pagesStyle = site.pagesStyle || {};
    ps.background = Object.assign({}, HomeView.DEFAULT_BACKGROUND, ps.background || {});
    ps.headerBackground = Object.assign({}, HomeView.DEFAULT_HEADER_BACKGROUND, ps.headerBackground || {});
    // Titre des autres pages : au départ, celui de l'accueil.
    ps.headerTitle = HomeView.pagesTitleStyle(site);
    ps.section = Object.assign({}, ContentView.DEFAULT_SECTION_STYLE, ps.section || {});
    ps.blocTexte = Object.assign({}, ContentView.DEFAULT_BLOC_TEXTE_STYLE, ps.blocTexte || {});
    ps.pageTitle = Object.assign({}, ContentView.DEFAULT_PAGE_TITLE_STYLE, ps.pageTitle || {});
    ps.image = Object.assign({}, ContentView.DEFAULT_IMAGE_STYLE, ps.image || {});
    ps.footerIcon = Object.assign({}, ContentView.DEFAULT_FOOTER_ICON, ps.footerIcon || {});
    if (!Array.isArray(site.chapitres)) site.chapitres = [];
    return site;
  }

  /** En-tête : titre du site (texte, police…), remplissage, image de fond
   *  (titre et image propres à l'accueil ou aux autres pages selon `context`),
   *  marge intérieure. */
  function header(site, context, change) {
    const hs = site.home.headerStyle;
    const img = context === 'home' ? hs : site.pagesStyle.headerBackground;
    return [
      ...siteTitle(site, context, change, 'Titre du site'),
      { group: 'Remplissage' },
      ...PropsPanel.fillRows(() => hs.bg, v => change('header.bg', () => { hs.bg = v; })),
      { group: 'Image de fond' },
      { type: 'image', label: context === 'home' ? "Sur l'accueil" : 'Sur les pages', root: 'style', removable: true,
        get: () => img.image, set: p => change('header.image', () => { img.image = p; }, { panel: true }) },
      img.image && { type: 'seg', label: 'Affichage', options: MODES,
        get: () => img.mode || 'cover', set: v => change('header.mode', () => { img.mode = v; }, { panel: true }) },
      { group: 'Marges' },
      ...PropsPanel.spacingRows(
        k => hs[k] != null ? hs[k] : HEADER_PADDING[k],
        (k, v) => change('header.' + k, () => { hs[k] = v; }),
        { innerOnly: true }),
    ];
  }

  /** Titre du site : texte (commun à tout le site) + le widget Texte commun
   *  (police, taille, couleur, alignement), sur les clés title* du header de
   *  l'accueil ou de celui des autres pages selon `context`. */
  function siteTitle(site, context, change, group) {
    const hs = context === 'home' ? site.home.headerStyle : site.pagesStyle.headerTitle;
    const KEYS = { font: 'titleFont', fontFile: 'titleFontFile', size: 'titleSize', color: 'titleColor', align: 'titleAlign' };
    return [
      { group: group || 'Texte' },
      { type: 'text', label: 'Titre', placeholder: SITE_NAME,
        get: () => site.titre_site || '', set: v => change('titre', () => { site.titre_site = v; }) },
      ...PropsPanel.textRows({
        get: k => hs[KEYS[k]],
        set: patch => change('title.' + Object.keys(patch).join(), () => {
          // titleFont '' et titleFontFile null : valeurs « aucune » du serveur.
          Object.keys(patch).forEach(k => { hs[KEYS[k]] = patch[k] == null ? (k === 'font' ? '' : null) : patch[k]; });
        }, { panel: 'font' in patch || 'align' in patch }),
      }, { align: true, sizeMin: 10, sizeMax: 150 }),
    ];
  }

  /** Fond d'une page : couleur + opacité, image facultative et son affichage. */
  function background(bg, change) {
    return [
      { group: 'Remplissage' },
      ...PropsPanel.fillRows(() => bg.color, v => change('bg.color', () => { bg.color = v; })),
      { group: 'Image de fond' },
      { type: 'image', label: 'Image', root: 'style', removable: true,
        get: () => bg.image, set: p => change('bg.image', () => { bg.image = p; }, { panel: true }) },
      bg.image && { type: 'seg', label: 'Affichage', options: MODES,
        get: () => bg.mode || 'cover', set: v => change('bg.mode', () => { bg.mode = v; }, { panel: true }) },
    ];
  }

  /**
   * Adaptateur du widget Texte pour un ou plusieurs objets de style à clés
   * directes (font, fontFile, size, color, align). `defaults` : valeurs
   * affichées tant que la clé est absente (celles du CSS). Plusieurs objets
   * aux valeurs différentes : get() renvoie null (« Mixte »).
   * `getTarget(obj)` renvoie l'objet de style à modifier (créé au besoin) ;
   * `keyMap` renomme une clé (ex. color → textColor).
   */
  function textAdapter(objs, getTarget, defaults, change, key, keyMap) {
    keyMap = keyMap || {};
    const field = k => keyMap[k] || k;
    return {
      get(k) {
        const vals = objs.map(o => {
          const t = getTarget(o, false) || {};
          const v = t[field(k)];
          return v != null ? v : (defaults[k] != null ? defaults[k] : null);
        });
        return vals.every(v => v === vals[0]) ? vals[0] : null;
      },
      set(patch) {
        change(key + '.' + Object.keys(patch).join(), () => {
          objs.forEach(o => {
            const mapped = {};
            Object.keys(patch).forEach(k => { mapped[field(k)] = patch[k]; });
            assign(getTarget(o, true), mapped);
          });
        }, { panel: 'font' in patch || 'align' in patch });
      },
    };
  }

  return { MODES, assign, normalize, header, siteTitle, background, textAdapter };
})();
