'use strict';

// ── Application _moule2 : routage + rendu lecture + bascule édition ────────
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

  // Descend l'arbre selon les segments de chemin.
  // Retourne { configs: [...noeuds traversés avec cumulativePath], found: bool }
  function resolvePath(pathSegments) {
    let current = SITE.chapitres;
    let cumulative = '';
    const configs = [];
    for (const seg of pathSegments) {
      const node = (current || []).find(c => c.keyword === seg);
      if (!node) return { configs, found: false };
      cumulative = cumulative ? cumulative + '/' + seg : seg;
      configs.push({ node, cumulativePath: cumulative });
      current = node.chapitres;
    }
    return { configs, found: true };
  }

  function route() {
    if (editing) return; // ne pas re-router pendant une édition en cours
    const path = currentPath();
    if (path.length === 0) { renderHome(); return; }
    const { configs, found } = resolvePath(path);
    if (!found) { renderNotFound(); return; }
    const last = configs[configs.length - 1];
    renderBreadcrumb(configs);
    if (last.node.chapitres && last.node.chapitres.length > 0) {
      renderSubmenu(last.node, last.cumulativePath);
    } else {
      renderLeaf(last.node, last.cumulativePath);
    }
  }

  // ── En-tête / fil d'Ariane ────────────────────────────────────────────────

  // `context` : 'home' (image de fond du header propre à la page d'accueil)
  // ou 'pages' (image de fond propre aux autres pages) — même header, même
  // couleur/police (home.headerStyle), mais image de fond distincte possible.
  function buildHeader(context) {
    const header = el('div', 'm2-header');
    // Fixe, en dehors de `.m2-header__left` : toujours en haut à gauche de la
    // page quel que soit l'alignement du titre, et uniquement sur la page
    // d'accueil (le contexte 'pages' ne l'affiche pas).
    if (context === 'home') header.appendChild(_buildNavMenu());
    const left = el('div', 'm2-header__left');
    left.appendChild(txt('span', 'm2-header__title', SITE.titre_site || SITE_NAME));
    header.appendChild(left);

    const right = el('div', 'm2-header__right');
    right.appendChild(_buildSearchBox());

    const editBtn = el('button', 'm2-edit-toggle');
    editBtn.type = 'button'; editBtn.textContent = '✏️ Modifier';
    editBtn.addEventListener('click', onEditClick);
    right.appendChild(editBtn);
    header.appendChild(right);

    const imageStyle = context === 'pages'
      ? (SITE.pagesStyle && SITE.pagesStyle.headerBackground)
      : (SITE.home && SITE.home.headerStyle);
    HomeView.applyHeaderStyle(header, SITE.home && SITE.home.headerStyle, imageStyle);
    return header;
  }

  function _buildSearchBox() {
    const searchWrap = el('div', 'm2-search');
    const input = document.createElement('input');
    input.type = 'text'; input.placeholder = '🔍 Rechercher';
    const list = el('ul', 'm2-search__list'); list.hidden = true;
    const allEntries = _flattenForSearch(SITE.chapitres, '');
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      list.innerHTML = '';
      if (q.length < 2) { list.hidden = true; return; }
      const matches = allEntries.filter(e => e.label.toLowerCase().includes(q)).slice(0, 20);
      matches.forEach(m => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#/' + m.path; a.textContent = m.label;
        a.addEventListener('click', () => { input.value = ''; list.hidden = true; });
        li.appendChild(a);
        list.appendChild(li);
      });
      list.hidden = matches.length === 0;
    });
    searchWrap.appendChild(input);
    searchWrap.appendChild(list);
    return searchWrap;
  }

  // Icône « sandwich » + menu arborescent : ouverture au survol (comme la
  // liste de frères du fil d'Ariane et la cascade des sous-niveaux), clic
  // possible aussi en complément (utile au clavier/tactile). Atteint
  // n'importe quelle page sans repasser par les sous-menus intermédiaires.
  function _buildNavMenu() {
    const wrap = el('div', 'm2-navmenu');
    const btn = el('button', 'm2-hamburger-btn');
    btn.type = 'button'; btn.title = 'Naviguer dans le site';
    // Barres dessinées en CSS plutôt que le caractère ☰ : ce dernier n'est pas
    // centré verticalement de façon fiable selon les polices (métriques du
    // glyphe), les barres, elles, sont centrées par construction.
    btn.appendChild(el('span', 'm2-hamburger-btn__bars'));
    wrap.appendChild(btn);

    const menu = el('ul', 'm2-treemenu');
    _buildTreeMenuItems(menu, SITE.chapitres, '', null);
    wrap.appendChild(menu);

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = wrap.classList.contains('m2-navmenu--open');
      _closeNavMenus();
      if (!wasOpen) wrap.classList.add('m2-navmenu--open');
    });
    return wrap;
  }

  // `currentNode`, si fourni, reçoit une mise en avant visuelle (utilisé par
  // le fil d'Ariane pour repérer la page actuelle dans la liste des frères).
  function _buildTreeMenuItems(ulEl, nodes, prefix, currentNode) {
    (nodes || []).forEach(node => {
      const path = prefix ? prefix + '/' + node.keyword : node.keyword;
      const li = el('li', 'm2-treemenu__item');
      const a = document.createElement('a');
      a.href = '#/' + path;
      a.appendChild(document.createTextNode(node.label || node.keyword));
      if (currentNode && node === currentNode) a.classList.add('m2-treemenu__link--current');
      if (node.chapitres && node.chapitres.length) {
        a.appendChild(txt('span', 'm2-treemenu__arrow', '›'));
        const sub = el('ul', 'm2-treemenu__submenu');
        _buildTreeMenuItems(sub, node.chapitres, path, currentNode);
        li.appendChild(a);
        li.appendChild(sub);
      } else {
        li.appendChild(a);
      }
      ulEl.appendChild(li);
    });
  }

  function _closeNavMenus() {
    document.querySelectorAll('.m2-navmenu--open').forEach(w => w.classList.remove('m2-navmenu--open'));
  }
  document.addEventListener('click', _closeNavMenus);

  function renderBreadcrumbBar(configs) {
    const bar = el('div', 'm2-breadcrumb');
    const home = document.createElement('a');
    home.className = 'm2-breadcrumb__home';
    home.href = '#/'; home.textContent = '🏠';
    bar.appendChild(home);
    configs.forEach((c, i) => {
      const siblings = i === 0 ? SITE.chapitres : configs[i - 1].node.chapitres;
      const parentPath = i === 0 ? '' : configs[i - 1].cumulativePath;
      bar.appendChild(_buildBreadcrumbSep(siblings, parentPath, c.node));

      if (i === configs.length - 1) {
        bar.appendChild(txt('span', 'm2-breadcrumb__current', c.node.label || c.node.keyword));
      } else {
        const a = document.createElement('a');
        a.href = '#/' + c.cumulativePath;
        a.textContent = c.node.label || c.node.keyword;
        bar.appendChild(a);
      }
    });
    return bar;
  }

  // Sépare deux niveaux du breadcrumb ; si le niveau a plusieurs pages
  // (frères), la flèche devient cliquable/survolable et ouvre la liste des
  // pages disponibles à ce niveau (permet de sauter vers un frère sans
  // repasser par la page parente).
  function _buildBreadcrumbSep(siblings, parentPath, currentNode) {
    const wrap = el('span', 'm2-breadcrumb__sepwrap');
    const sep = el('button', 'm2-breadcrumb__sep');
    sep.type = 'button';
    sep.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 1.5L7 5L3.5 8.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    wrap.appendChild(sep);

    if (siblings && siblings.length > 1) {
      wrap.classList.add('m2-breadcrumb__sepwrap--has-dropdown');
      // Même construction récursive que le menu sandwich : un frère qui a
      // lui-même des enfants cascade à son tour au survol, au lieu d'une
      // simple liste plate d'un seul niveau.
      const dropdown = el('ul', 'm2-treemenu m2-breadcrumb__dropdown');
      _buildTreeMenuItems(dropdown, siblings, parentPath, currentNode);
      wrap.appendChild(dropdown);
      sep.addEventListener('click', e => {
        e.stopPropagation();
        const wasOpen = wrap.classList.contains('m2-breadcrumb__sepwrap--open');
        _closeAllBreadcrumbDropdowns();
        if (!wasOpen) wrap.classList.add('m2-breadcrumb__sepwrap--open');
      });
    } else {
      sep.disabled = true;
    }
    return wrap;
  }

  function _closeAllBreadcrumbDropdowns() {
    document.querySelectorAll('.m2-breadcrumb__sepwrap--open').forEach(w => w.classList.remove('m2-breadcrumb__sepwrap--open'));
  }
  document.addEventListener('click', _closeAllBreadcrumbDropdowns);

  let _lastConfigs = [];
  function renderBreadcrumb(configs) { _lastConfigs = configs; }

  // ── Page d'accueil ───────────────────────────────────────────────────────

  function _flattenForSearch(chapitres, prefix) {
    let out = [];
    (chapitres || []).forEach(node => {
      const path = prefix ? prefix + '/' + node.keyword : node.keyword;
      if (node.label) out.push({ label: node.label, path });
      if (node.chapitres && node.chapitres.length) out = out.concat(_flattenForSearch(node.chapitres, path));
    });
    return out;
  }

  function renderHome() {
    root.innerHTML = '';

    // Header + canevas partagent un même fond (au lieu d'appliquer le fond
    // uniquement au canevas) : ainsi l'image/couleur de fond continue derrière
    // le header, visible à travers lui dès qu'il a de la transparence.
    const page = el('div', 'm2-home-page');
    HomeView.applyBackgroundStyle(page, SITE.home && SITE.home.background);
    page.appendChild(buildHeader('home'));

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
  function _buildContentPage() {
    const page = el('div', 'm2-content-page');
    HomeView.applyBackgroundStyle(page, SITE.pagesStyle && SITE.pagesStyle.background);
    page.appendChild(buildHeader('pages'));
    return page;
  }

  function renderSubmenu(node, cumulativePath) {
    root.innerHTML = '';
    const page = _buildContentPage();
    page.appendChild(renderBreadcrumbBar(_lastConfigs));

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

  function renderLeaf(node, cumulativePath) {
    root.innerHTML = '';
    const page = _buildContentPage();
    page.appendChild(renderBreadcrumbBar(_lastConfigs));

    const wrap = el('div', 'm2-page');
    wrap.appendChild(txt('div', 'm2-page__title', node.label || node.keyword));
    const sections = node.sections || [];
    if (sections.length === 0) {
      wrap.appendChild(txt('div', 'm2-page__empty', 'Cette page n\'a pas encore de contenu.'));
    } else {
      wrap.appendChild(ContentView.render(sections, SITE.pagesStyle));
    }
    page.appendChild(wrap);
    root.appendChild(page);
  }

  function renderNotFound() {
    root.innerHTML = '';
    const page = _buildContentPage();
    page.appendChild(txt('div', 'm2-error', 'Page introuvable.'));
    root.appendChild(page);
  }

  // ── Bascule édition ──────────────────────────────────────────────────────

  function onEditClick() {
    const path = currentPath();
    editing = true;
    root.innerHTML = '';

    if (path.length === 0) {
      TreeEditor.open(root, SITE, onEditDone, 'home');
      return;
    }
    const { configs, found } = resolvePath(path);
    if (!found) { editing = false; route(); return; }
    const last = configs[configs.length - 1];
    if (last.node.chapitres && last.node.chapitres.length > 0) {
      TreeEditor.open(root, SITE, onEditDone, 'tree');
    } else {
      openLeafEditor(last.node);
    }
  }

  function onEditDone(savedData) {
    editing = false;
    if (savedData) SITE = savedData;
    route();
  }

  function openLeafEditor(node) {
    const bar = el('div', 'ed-bar');
    bar.id = 'ed-fixed-bar';
    const saveBtn = el('button', 'ed-btn ed-btn--save');
    saveBtn.type = 'button'; saveBtn.textContent = 'Enregistrer';
    const cancelBtn = el('button', 'ed-btn ed-btn--cancel');
    cancelBtn.type = 'button'; cancelBtn.textContent = 'Annuler';
    bar.appendChild(saveBtn); bar.appendChild(cancelBtn);
    document.body.appendChild(bar);

    const workingNode = clone(node);
    if (!workingNode.sections) workingNode.sections = [];

    const wrap = el('div', 'm2-page');
    wrap.style.paddingTop = '20px';
    wrap.appendChild(ContentView.buildEditor(workingNode.sections));
    root.appendChild(wrap);

    cancelBtn.addEventListener('click', () => {
      bar.parentNode.removeChild(bar);
      editing = false;
      route();
    });
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true; saveBtn.textContent = 'Enregistrement…';
      try {
        node.sections = workingNode.sections;
        const saved = await Api.saveSite(SITE);
        SITE = saved.data;
        bar.parentNode.removeChild(bar);
        editing = false;
        route();
      } catch (e) {
        alert('Erreur lors de la sauvegarde :\n' + e.message);
        saveBtn.disabled = false; saveBtn.textContent = 'Enregistrer';
      }
    });
  }

  boot();
})();
