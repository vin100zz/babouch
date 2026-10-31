'use strict';

// ── Application _moule2 : routage + rendu lecture + ouverture des éditeurs ──
// Chaque page consommatrice (générée par _moule2/src/site-template.php)
// définit SITE_NAME et ENGINE_BASE puis charge ce fichier en dernier.

(function () {
  let SITE = null;          // { titre_site, home:{images:[]}, chapitres:[] }
  let editing = false;

  const root = document.getElementById('m2-root');

  async function boot() {
    root.innerHTML = '<div class="m2-loading">Chargement…</div>';
    try {
      SITE = await Api.getSite();
    } catch (e) {
      root.innerHTML = '<div class="m2-error">Erreur de chargement : ' + e.message + '</div>';
      return;
    }
    document.title = SITE.titre_site || SITE_NAME;
    window.addEventListener('hashchange', route);
    route();
  }

  function currentPath() {
    return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  }

  function route() {
    if (editing) return; // ne pas re-router pendant une édition en cours
    const path = currentPath();
    if (path.length === 0) { renderHome(); return; }
    const { configs, found } = SiteChrome.resolvePath(SITE, path);
    if (!found) { renderNotFound(); return; }
    const last = configs[configs.length - 1];
    if (last.node.chapitres && last.node.chapitres.length > 0) {
      renderSubmenu(last.node, last.cumulativePath, configs);
    } else {
      renderLeaf(last.node, configs);
    }
  }

  // ── Menu crayon : actions d'édition selon le type de page ────────────────
  // « Modifier cette page » : accueil et pages de contenu (feuilles) ; une
  // rubrique (liste de sous-pages, générée automatiquement) n'a rien à
  // modifier en propre.

  function editMenu(kind) {
    const items = [];
    if (kind === 'home') {
      items.push({ label: 'Modifier cette page', sub: "Blocs, en-tête et fond de l'accueil",
        onClick: () => openEditor(c => HomeEditor.open(c, SITE, onEditDone)) });
    } else if (kind === 'leaf') {
      const path = currentPath();
      items.push({ label: 'Modifier cette page', sub: 'Textes, images et sections',
        onClick: () => openEditor(c => PageEditor.open(c, SITE, path, onEditDone)) });
    }
    items.push({ label: 'Style des pages', sub: 'Couleurs, polices et bordures de tout le site',
      onClick: () => openEditor(c => StyleEditor.open(c, SITE, onEditDone)) });
    items.push({ label: 'Plan du site', sub: 'Ajouter, renommer, déplacer des pages',
      onClick: () => openEditor(c => TreeEditor.open(c, SITE, onTreeDone)) });
    // Ouvert sur la vidéo qui correspond à la page affichée.
    const tuto = kind === 'home' ? 'accueil' : (kind === 'leaf' ? 'page' : 'plan');
    items.push({ label: 'Tutoriels vidéo', sub: 'Voir comment modifier le site', separate: true,
      onClick: () => VideoTutorials.open(tuto) });
    return items;
  }

  function openEditor(openFn) {
    editing = true;
    window.scrollTo(0, 0);
    openFn(root);
  }

  function onEditDone(savedData) {
    editing = false;
    if (savedData) SITE = savedData;
    route();
  }

  // Le plan du site peut se fermer sur une page à afficher (nav.path), voire
  // à ouvrir directement dans l'éditeur de page (nav.edit).
  function onTreeDone(savedData, nav) {
    editing = false;
    if (savedData) SITE = savedData;
    if (!nav) { route(); return; }
    if (location.hash === '#/' + nav.path) route();
    else location.hash = '#/' + nav.path;
    if (nav.edit) openEditor(c => PageEditor.open(c, SITE, nav.path.split('/'), onEditDone));
  }

  // ── Page d'accueil ───────────────────────────────────────────────────────

  function renderHome() {
    root.innerHTML = '';

    // Header + canevas partagent un même fond (au lieu d'appliquer le fond
    // uniquement au canevas) : ainsi l'image/couleur de fond continue derrière
    // le header, visible à travers lui dès qu'il a de la transparence.
    const page = el('div', 'm2-home-page');
    HomeView.applyBackgroundStyle(page, SITE.home && SITE.home.background);
    page.appendChild(SiteChrome.header(SITE, 'home', { editMenu: editMenu('home') }));

    const wrap = el('div', 'm2-home');
    const images = (SITE.home && SITE.home.images) || [];
    if (images.length === 0) {
      wrap.appendChild(txt('div', 'm2-home__empty', 'Aucune image sur la page d\'accueil pour le moment.'));
    } else {
      wrap.appendChild(HomeView.render(images, { editable: false }));
    }
    page.appendChild(wrap);
    root.appendChild(page);
  }

  // ── Sous-menu ────────────────────────────────────────────────────────────

  // Header + breadcrumb + contenu partagent un même fond de page (voir
  // renderHome pour le même principe côté page d'accueil) : le fond continue
  // derrière le header, visible à travers lui dès qu'il a de la transparence.
  function _buildContentPage(configs, kind) {
    const page = el('div', 'm2-content-page');
    HomeView.applyBackgroundStyle(page, SITE.pagesStyle && SITE.pagesStyle.background);
    // Header + fil d'Ariane regroupés dans un même bloc collant (voir
    // .m2-page-topbar) : ainsi ils restent fixes ensemble au scroll, sans
    // dépendre de la hauteur (variable, personnalisable) du header.
    const topbar = el('div', 'm2-page-topbar');
    topbar.appendChild(SiteChrome.header(SITE, 'pages', { editMenu: editMenu(kind) }));
    if (configs) topbar.appendChild(SiteChrome.breadcrumb(SITE, configs));
    page.appendChild(topbar);
    return page;
  }

  function renderSubmenu(node, cumulativePath, configs) {
    root.innerHTML = '';
    const page = _buildContentPage(configs, 'hub');

    const wrap = el('div', 'm2-submenu');
    wrap.appendChild(txt('div', 'm2-submenu__title', node.label || node.keyword));
    const list = el('div', 'm2-submenu__list');
    node.chapitres.forEach(child => {
      const a = document.createElement('a');
      a.className = 'm2-submenu__item';
      a.href = '#/' + cumulativePath + '/' + child.keyword;
      a.textContent = child.label || child.keyword;
      list.appendChild(a);
    });
    wrap.appendChild(list);
    page.appendChild(wrap);
    root.appendChild(page);
  }

  // ── Page de contenu (feuille) ────────────────────────────────────────────

  function renderLeaf(node, configs) {
    root.innerHTML = '';
    const page = _buildContentPage(configs, 'leaf');

    const wrap = el('div', 'm2-page');
    const titleEl = txt('div', 'm2-page__title', node.label || node.keyword);
    ContentView.applyPageTitleStyle(titleEl, SITE.pagesStyle && SITE.pagesStyle.pageTitle);
    wrap.appendChild(titleEl);
    const sections = node.sections || [];
    if (sections.length === 0) {
      wrap.appendChild(txt('div', 'm2-page__empty', 'Cette page n\'a pas encore de contenu.'));
    } else {
      wrap.appendChild(ContentView.render(sections, SITE.pagesStyle));
    }
    page.appendChild(wrap);
    const footer = SiteChrome.footerIcon(SITE);
    if (footer) page.appendChild(footer);
    root.appendChild(page);
  }

  function renderNotFound() {
    root.innerHTML = '';
    const page = _buildContentPage(null, 'hub');
    page.appendChild(txt('div', 'm2-error', 'Page introuvable.'));
    root.appendChild(page);
  }

  boot();
})();
