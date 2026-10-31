'use strict';

// ── Style des pages : apparence commune à toutes les pages de contenu ──────
// Affiche une page d'exemple (jamais publiée), rendue par le même code que
// les vraies pages (ContentView), avec un exemplaire de chaque élément :
// titre de page, sections à plusieurs colonnes, texte, image, son, tableau
// HTML, icône de fin. Cliquer un élément affiche ses réglages, qui
// s'appliquent à tous les éléments du même type sur tout le site.

const StyleEditor = (function () {

  const LOREM_1 = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante venenatis dapibus, posuere velit aliquet. Cras mattis consectetur purus sit amet fermentum.';
  const LOREM_2 = 'Donec ullamcorper nulla non metus auctor fringilla. Vestibulum id ligula porta felis euismod semper. Nullam quis risus eget urna mollis ornare vel eu leo.';
  const SAMPLE = [
    { titre: 'Une section à deux colonnes', colonnes: [
      [{ type: 'TEXTE', html: LOREM_1 + '<br/><br/>' + LOREM_2, align: 'left' }],
      [{ type: 'DOCUMENTS', fichier: 'exemple-paysage.jpg', width: 100 }],
    ] },
    { titre: 'Image, son et tableau', colonnes: [
      [{ type: 'DOCUMENTS', fichier: 'exemple-portrait.jpg', width: 70 }],
      [{ type: 'DOCUMENTS', fichier: 'exemple-son.mp3', width: 100 }, { type: 'TEXTE', html: LOREM_2, align: 'center' }],
      [{ type: 'HTML', html: '<table><tr><th>Année</th><th>Lieu</th></tr><tr><td>1849</td><td>Lorem</td></tr><tr><td>1869</td><td>Ipsum</td></tr></table>' }],
    ] },
  ];
  // Images d'exemple dessinées en SVG : la page d'exemple ne dépend d'aucun
  // fichier du site.
  const SAMPLE_SRC = {
    'exemple-paysage.jpg': _svgUri('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice"><rect width="160" height="120" fill="#cfd8e3"/><circle cx="118" cy="34" r="12" fill="#f3f4f6"/><path d="M0 120 L50 60 L85 95 L110 72 L160 120 Z" fill="#8a9bb0"/></svg>'),
    'exemple-portrait.jpg': _svgUri('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="380" viewBox="0 0 300 380"><rect width="300" height="380" fill="#e7e1d3"/><circle cx="150" cy="140" r="62" fill="#4a3f36"/><path d="M40 380 C40 260 95 210 150 210 C205 210 260 260 260 380 Z" fill="#2b2a27"/></svg>'),
    'exemple-son.mp3': 'data:audio/mpeg;base64,',
  };
  function _svgUri(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }

  // Valeurs d'app.css, affichées tant que le site ne les a pas réglées.
  const BOXES = {
    pageTitle: { name: 'Titre de page', what: 'le titre de chaque page', align: true,
      text: { size: 32, align: 'center' }, spacing: { padY: 24, padX: 0, mTop: 28, mBottom: 28 } },
    section: { name: 'Titres de section', what: 'les titres de section', align: true,
      text: { size: 18, align: 'left' }, spacing: { padY: 10, padX: 24, mTop: 0, mBottom: 0 } },
    blocTexte: { name: 'Blocs de texte', what: 'les blocs de texte', align: false,
      text: { size: 17 }, spacing: null },
  };
  const NAMES = {
    bg: 'Fond des pages', header: 'En-tête', title: 'Titre du site', pageTitle: 'Titre de page',
    section: 'Titres de section', blocTexte: 'Blocs de texte', image: 'Images et vidéos', footerIcon: 'Icône de fin de page',
  };

  function open(container, siteData, onDone) {
    const site = StyleItems.normalize(clone(siteData));
    const ps = () => site.pagesStyle;
    let sel = null;
    let pending = 0;

    const studio = Studio.open({
      container,
      title: 'Style des pages',
      subtitle: "Page d'exemple, jamais publiée",
      snapshot: () => JSON.stringify({ titre_site: site.titre_site, headerStyle: site.home.headerStyle, pagesStyle: site.pagesStyle }),
      restore(s) {
        const d = JSON.parse(s);
        site.titre_site = d.titre_site;
        site.home.headerStyle = d.headerStyle;
        site.pagesStyle = d.pagesStyle;
        renderPage();
        renderPanel();
      },
      save: async () => (await Api.saveSite(site)).data,
      onPick(id) { select(id); },
      onKey(e) { if (e.key === 'Escape') select(null); },
      onClose: onDone,
    });

    function change(key, fn, opts) {
      studio.record(key);
      fn();
      // Page d'exemple courte : reconstruite en entier, une fois par image.
      if (!pending) pending = requestAnimationFrame(() => { pending = 0; renderPage(); });
      if (opts && opts.panel) renderPanel();
    }

    function renderPage() {
      studio.untrackAll();
      const page = studio.page;
      page.innerHTML = '';

      const contentPage = el('div', 'm2-content-page');
      HomeView.applyBackgroundStyle(contentPage, ps().background);
      const topbar = el('div', 'm2-page-topbar');
      const headerEl = SiteChrome.header(site, 'pages');
      topbar.appendChild(headerEl);
      topbar.appendChild(SiteChrome.breadcrumb(site, [
        { node: { keyword: 'chapitre', label: 'Un chapitre' }, cumulativePath: 'chapitre' },
        { node: { keyword: 'exemple', label: "Page d'exemple" }, cumulativePath: 'chapitre/exemple' },
      ]));
      contentPage.appendChild(topbar);

      const wrap = el('div', 'm2-page');
      const titleEl = txt('div', 'm2-page__title', "Titre de la page d'exemple");
      ContentView.applyPageTitleStyle(titleEl, ps().pageTitle);
      wrap.appendChild(titleEl);
      wrap.appendChild(ContentView.render(SAMPLE, ps(), {
        editing: true,
        resolveSrc: path => SAMPLE_SRC[path] || '',
        onElement(elm, kind, obj) {
          if (kind === 'sectionTitle') studio.track(elm, 'section', NAMES.section);
          if (kind === 'block' && obj.type === 'TEXTE') studio.track(elm, 'blocTexte', NAMES.blocTexte);
          if (kind === 'block' && obj.type === 'DOCUMENTS') {
            const media = elm.querySelector('img, video');
            if (media) studio.track(media, 'image', NAMES.image);
          }
        },
      }));
      contentPage.appendChild(wrap);

      // Sans icône choisie, un emplacement (propre à la page d'exemple) permet
      // quand même de la sélectionner pour en ajouter une.
      let footer = SiteChrome.footerIcon(site);
      if (!footer) {
        footer = el('div', 'm2-page-footer');
        footer.appendChild(txt('div', 'st-placeholder', 'Icône de fin de page : aucune'));
      }
      contentPage.appendChild(footer);
      page.appendChild(contentPage);

      studio.track(contentPage, 'bg', NAMES.bg);
      studio.track(headerEl, 'header', NAMES.header);
      studio.track(headerEl.querySelector('.m2-header__title'), 'title', NAMES.title);
      studio.track(titleEl, 'pageTitle', NAMES.pageTitle);
      studio.track(footer.firstChild, 'footerIcon', NAMES.footerIcon);
    }

    function select(id) {
      sel = id;
      studio.setSelection(id ? [id] : []);
      studio.setSelTitle(id ? NAMES[id] : 'Style des pages');
      renderPanel();
    }

    function renderPanel() {
      PropsPanel.render(studio.panel, panelItems());
    }

    function panelItems() {
      switch (sel) {
        case 'bg': return StyleItems.background(ps().background, change);
        case 'header': return StyleItems.header(site, 'pages', change);
        case 'title': return StyleItems.siteTitle(site, change);
        case 'pageTitle': case 'section': case 'blocTexte': return boxItems(sel);
        case 'image': return imageItems();
        case 'footerIcon': return footerItems();
        default: return [{ hint: "Cliquez sur un élément de la page d'exemple : ses réglages s'appliqueront à toutes les pages du site." }];
      }
    }

    // Titres de page, titres de section et blocs TEXTE : remplissage, texte,
    // bordure (et marges pour les titres).
    function boxItems(key) {
      const s = ps()[key];
      const cfg = BOXES[key];
      const set = prop => v => change(key + '.' + prop, () => { s[prop] = v; });
      return [
        { group: 'Remplissage' },
        ...PropsPanel.fillRows(() => s.bg, set('bg')),
        { group: 'Texte' },
        ...PropsPanel.textRows(
          StyleItems.textAdapter([s], o => o, Object.assign({ color: s.textColor }, cfg.text), change, key, { color: 'textColor' }),
          { align: cfg.align, sizeMin: 10, sizeMax: 80 }),
        { group: 'Bordure' },
        { type: 'range', label: 'Épaisseur', min: 0, max: 20, unit: ' px', get: () => s.borderWidth, set: set('borderWidth') },
        { type: 'color', label: 'Couleur', get: () => s.borderColor, set: set('borderColor') },
        { type: 'range', label: 'Arrondi', min: 0, max: 60, unit: ' px', get: () => s.borderRadius, set: set('borderRadius') },
        cfg.spacing && { group: 'Marges' },
        ...(cfg.spacing ? PropsPanel.spacingRows(k => s[k] != null ? s[k] : cfg.spacing[k], (k, v) => change(key + '.' + k, () => { s[k] = v; })) : []),
      ];
    }

    function imageItems() {
      const s = ps().image;
      return [
        { group: 'Bordure' },
        { type: 'range', label: 'Épaisseur', min: 0, max: 20, unit: ' px', get: () => s.borderWidth, set: v => change('image.bw', () => { s.borderWidth = v; }) },
        { type: 'color', label: 'Couleur', get: () => s.borderColor, set: v => change('image.bc', () => { s.borderColor = v; }) },
        { type: 'range', label: 'Arrondi', min: 0, max: 100, unit: ' px', get: () => s.borderRadius, set: v => change('image.br', () => { s.borderRadius = v; }) },
      ];
    }

    function footerItems() {
      const s = ps().footerIcon;
      return [
        { group: 'Icône' },
        { type: 'image', label: 'Image', root: 'style', removable: true, empty: 'Aucune icône',
          get: () => s.image, set: p => change('footer.image', () => { s.image = p; }, { panel: true }) },
        s.image && { type: 'range', label: 'Largeur', min: 12, max: 300, unit: ' px', get: () => s.width, set: v => change('footer.width', () => { s.width = v; }) },
      ];
    }

    renderPage();
    select(null);
  }

  return { open };
})();
