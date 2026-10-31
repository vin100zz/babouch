'use strict';

// ── Habillage commun des pages : header, fil d'Ariane, icône de fin ────────
// Construit à partir d'un objet site passé en paramètre (SITE en lecture, la
// copie de travail en édition) : les éditeurs affichent ainsi exactement le
// même habillage que le site publié, mis à jour en direct.

const SiteChrome = (function () {

  // Valeurs d'app.css (fond du fil d'Ariane, couleur de texte héritée).
  const DEFAULT_BREADCRUMB_STYLE = { bg: '#f1f5f9', textColor: '#1e293b' };
  const PENCIL_SVG ='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';

  /** Descend l'arbre selon les segments de chemin.
   *  Retourne { configs: [...noeuds traversés avec cumulativePath], found: bool } */
  function resolvePath(site, pathSegments) {
    let current = site.chapitres;
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

  // `context` : 'home' (header propre à la page d'accueil) ou 'pages' (header
  // propre aux autres pages) — même structure, mais remplissage, titre (police,
  // taille, couleur, alignement), marges et image de fond réglés séparément.
  // `opts.editMenu` : entrées du menu crayon [{label, sub, onClick}], en
  // lecture seulement (en édition, la barre d'édition le remplace).
  function header(site, context, opts) {
    opts = opts || {};
    const header = el('div', 'm2-header');
    // Fixe, en dehors de `.m2-header__left` : toujours en haut à gauche de la
    // page quel que soit l'alignement du titre, et uniquement sur la page
    // d'accueil (le contexte 'pages' ne l'affiche pas).
    if (context === 'home') header.appendChild(_buildNavMenu(site));
    const left = el('div', 'm2-header__left');
    left.appendChild(txt('span', 'm2-header__title', site.titre_site || SITE_NAME));
    header.appendChild(left);

    const right = el('div', 'm2-header__right');
    right.appendChild(_buildSearchBox(site));
    if (opts.editMenu && opts.editMenu.length) right.appendChild(_buildEditMenu(opts.editMenu));
    header.appendChild(right);

    const imageStyle = context === 'pages'
      ? (site.pagesStyle && site.pagesStyle.headerBackground)
      : (site.home && site.home.headerStyle);
    HomeView.applyHeaderStyle(header, HomeView.headerStyleFor(site, context), imageStyle);
    return header;
  }

  // Icône crayon + menu déroulant des actions d'édition (Modifier cette page,
  // Style des pages, Plan du site), propres au type de page affichée.
  function _buildEditMenu(items) {
    const wrap = el('div', 'm2-editmenu');
    const btn = el('button', 'm2-editmenu__btn');
    btn.type = 'button'; btn.title = 'Édition';
    btn.setAttribute('aria-label', 'Édition');
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = PENCIL_SVG;
    wrap.appendChild(btn);

    const menu = el('div', 'm2-editmenu__menu');
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    items.forEach(item => {
      const b = el('button', 'm2-editmenu__item');
      b.type = 'button'; b.setAttribute('role', 'menuitem');
      b.appendChild(txt('span', 'm2-editmenu__label', item.label));
      if (item.sub) b.appendChild(txt('span', 'm2-editmenu__sub', item.sub));
      b.addEventListener('click', () => { _setOpen(false); item.onClick(); });
      menu.appendChild(b);
    });
    wrap.appendChild(menu);

    function _setOpen(open) {
      if (open) _closeEditMenus();
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      wrap.classList.toggle('m2-editmenu--open', open);
    }
    btn.addEventListener('click', e => { e.stopPropagation(); _setOpen(menu.hidden); });
    menu.addEventListener('click', e => e.stopPropagation());
    return wrap;
  }

  // Un seul écouteur global (et non un par header construit) : ferme tout
  // menu crayon ouvert au clic ailleurs ou à Échap.
  function _closeEditMenus() {
    document.querySelectorAll('.m2-editmenu--open').forEach(w => {
      w.classList.remove('m2-editmenu--open');
      w.querySelector('.m2-editmenu__menu').hidden = true;
      w.querySelector('.m2-editmenu__btn').setAttribute('aria-expanded', 'false');
    });
  }
  document.addEventListener('click', _closeEditMenus);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') _closeEditMenus(); });

  function _buildSearchBox(site) {
    const searchWrap = el('div', 'm2-search');
    const input = document.createElement('input');
    input.type = 'text'; input.placeholder = '🔍 Rechercher';
    const list = el('ul', 'm2-search__list'); list.hidden = true;
    const allEntries = _flattenForSearch(site.chapitres, '');
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

  function _flattenForSearch(chapitres, prefix) {
    let out = [];
    (chapitres || []).forEach(node => {
      const path = prefix ? prefix + '/' + node.keyword : node.keyword;
      if (node.label) out.push({ label: node.label, path });
      if (node.chapitres && node.chapitres.length) out = out.concat(_flattenForSearch(node.chapitres, path));
    });
    return out;
  }

  // Icône « sandwich » + menu arborescent : ouverture au survol (comme la
  // liste de frères du fil d'Ariane et la cascade des sous-niveaux), clic
  // possible aussi en complément (utile au clavier/tactile). Atteint
  // n'importe quelle page sans repasser par les sous-menus intermédiaires.
  function _buildNavMenu(site) {
    const wrap = el('div', 'm2-navmenu');
    const btn = el('button', 'm2-hamburger-btn');
    btn.type = 'button'; btn.title = 'Naviguer dans le site';
    // Barres dessinées en CSS plutôt que le caractère ☰ : ce dernier n'est pas
    // centré verticalement de façon fiable selon les polices (métriques du
    // glyphe), les barres, elles, sont centrées par construction.
    btn.appendChild(el('span', 'm2-hamburger-btn__bars'));
    wrap.appendChild(btn);

    const menu = el('ul', 'm2-treemenu');
    _buildTreeMenuItems(menu, site.chapitres, '', null);
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

  // Fond et couleur du texte réglés dans Style des pages (pagesStyle.breadcrumb) ;
  // la page actuelle et les flèches reprennent la couleur du texte, atténuée.
  function breadcrumb(site, configs) {
    const bar = el('div', 'm2-breadcrumb');
    const style = Object.assign({}, DEFAULT_BREADCRUMB_STYLE, site.pagesStyle && site.pagesStyle.breadcrumb);
    bar.style.background = style.bg;
    bar.style.color = style.textColor;
    const home = document.createElement('a');
    home.className = 'm2-breadcrumb__home';
    home.href = '#/'; home.textContent = '🏠';
    bar.appendChild(home);
    configs.forEach((c, i) => {
      const siblings = i === 0 ? site.chapitres : configs[i - 1].node.chapitres;
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

  // Icône de fin de page (dossier style/), affichée en bas de toutes les
  // pages sauf la page d'accueil ; absente tant qu'aucune image n'a été
  // choisie (voir Style des pages en édition).
  function footerIcon(site) {
    const cfg = site.pagesStyle && site.pagesStyle.footerIcon;
    if (!cfg || !cfg.image) return null;
    const wrap = el('div', 'm2-page-footer');
    const img = document.createElement('img');
    img.src = 'style/' + cfg.image;
    img.alt = '';
    img.style.width = (cfg.width || 40) + 'px';
    wrap.appendChild(img);
    return wrap;
  }

  return { resolvePath, header, breadcrumb, footerIcon, DEFAULT_BREADCRUMB_STYLE };
})();
