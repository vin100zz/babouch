'use strict';

// ── Plan du site : arborescence des pages ──────────────────────────────────
// Liste repliable des rubriques et des pages (glisser-déposer pour déplacer),
// et à droite les réglages de la page sélectionnée : titre, adresse,
// emplacement, suppression. L'adresse (keyword) d'une nouvelle page suit son
// titre ; la changer met à jour les liens des blocs de la page d'accueil.

const TreeEditor = (function () {

  const ICON = {
    folder: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h9A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>',
    page: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
    grip: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
    chev: 'M9 6l6 6-6 6',
    back: 'M15 6l-6 6 6 6',
  };

  /** Adresse (keyword) tirée d'un titre : sans accents, [a-z0-9_-]. */
  function slugify(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
  }
  function uniqueKeyword(base, siblings, self) {
    let k = base, i = 2;
    while (siblings.some(n => n !== self && n.keyword === k)) k = base + '-' + (i++);
    return k;
  }
  const isFolder = n => !!(n.chapitres && n.chapitres.length);
  function countLeaves(nodes) {
    return (nodes || []).reduce((sum, n) => sum + (isFolder(n) ? countLeaves(n.chapitres) : 1), 0);
  }
  function plural(n, word) { return n + ' ' + word + (n > 1 ? 's' : ''); }

  /**
   * onDone(siteEnregistré|null, nav) : nav = { path, edit } pour ouvrir une
   * page (edit : directement dans l'éditeur de page) après la fermeture.
   */
  function open(container, siteData, onDone) {
    const site = clone(siteData);
    if (!Array.isArray(site.chapitres)) site.chapitres = [];
    if (!site.home) site.home = { images: [] };
    if (!Array.isArray(site.home.images)) site.home.images = [];

    const openNodes = new WeakSet();   // rubriques dépliées
    const fresh = new WeakSet();       // pages créées ici : l'adresse suit le titre
    let sel = null, query = '', keywordOpen = false;
    let dirty = false, savedSite = null;
    const undoStack = [], redoStack = [];
    let lastKey = null, lastAt = 0;
    let dragNode = null;

    container.innerHTML = '';
    const root = el('div', 'pl');
    container.appendChild(root);

    // ── Barre du haut ──
    const top = el('div', 'pl-top');
    const back = el('button', 'pl-back');
    back.type = 'button';
    back.innerHTML = PropsPanel.svgIcon(ICON.back);
    back.appendChild(document.createTextNode('Retour au site'));
    const titles = el('div', 'pl-top__titles');
    titles.appendChild(txt('div', 'st-top__sub', site.titre_site || SITE_NAME));
    titles.appendChild(txt('div', 'pl-top__title', 'Plan du site'));
    const status = el('span', 'st-status__text');
    const dot = el('span', 'st-status__dot');
    const undoBtn = el('button', 'st-iconbtn');
    undoBtn.type = 'button'; undoBtn.title = 'Annuler (Ctrl+Z)'; undoBtn.setAttribute('aria-label', 'Annuler la dernière modification');
    undoBtn.innerHTML = PropsPanel.svgIcon('M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3');
    const redoBtn = el('button', 'st-iconbtn');
    redoBtn.type = 'button'; redoBtn.title = 'Rétablir (Ctrl+Y)'; redoBtn.setAttribute('aria-label', 'Rétablir');
    redoBtn.innerHTML = PropsPanel.svgIcon('M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3');
    const saveBtn = txt('button', 'st-save', 'Enregistrer');
    saveBtn.type = 'button';
    [back, titles, dot, status, undoBtn, redoBtn, saveBtn].forEach(n => top.appendChild(n));
    root.appendChild(top);

    const body = el('div', 'pl-body');
    const treeCard = el('section', 'pl-card pl-tree');
    treeCard.setAttribute('aria-label', 'Pages du site');
    const details = el('aside', 'pl-card pl-details');
    details.setAttribute('aria-label', 'Page sélectionnée');
    body.appendChild(treeCard);
    body.appendChild(details);
    root.appendChild(body);

    // Barre d'outils de la liste (construite une fois : le champ de recherche
    // garde ainsi le focus pendant la frappe).
    const toolbar = el('div', 'pl-toolbar');
    const addBtn = PropsPanel.button('+ Nouvelle page', () => addPage());
    const search = document.createElement('input');
    search.type = 'search'; search.className = 'pp-input pl-search';
    search.placeholder = 'Rechercher une page…';
    search.setAttribute('aria-label', 'Rechercher une page');
    search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); renderTree(); });
    const expandBtn = PropsPanel.button('Tout déplier', () => { allFolders(site.chapitres).forEach(n => openNodes.add(n)); renderTree(); }, 'light');
    const collapseBtn = PropsPanel.button('Tout replier', () => { allFolders(site.chapitres).forEach(n => openNodes.delete(n)); renderTree(); }, 'light');
    [addBtn, search, expandBtn, collapseBtn].forEach(n => toolbar.appendChild(n));
    treeCard.appendChild(toolbar);
    const countEl = el('div', 'pl-count');
    treeCard.appendChild(countEl);
    const list = el('div', 'pl-list');
    list.setAttribute('role', 'tree');
    treeCard.appendChild(list);

    function allFolders(nodes) {
      let out = [];
      (nodes || []).forEach(n => { if (isFolder(n)) out = out.concat([n], allFolders(n.chapitres)); });
      return out;
    }

    // ── Historique + enregistrement ──
    const snapshot = () => JSON.stringify({ chapitres: site.chapitres, images: site.home.images });
    function record(key) {
      if (key && key === lastKey && Date.now() - lastAt < 1200) { lastAt = Date.now(); return; }
      undoStack.push(snapshot()); redoStack.length = 0;
      lastKey = key || null; lastAt = Date.now();
    }
    function restore(s) {
      const d = JSON.parse(s);
      site.chapitres = d.chapitres;
      site.home.images = d.images;
      sel = null;
      lastKey = null;
      changed();
    }
    function undo() { if (undoStack.length) { redoStack.push(snapshot()); restore(undoStack.pop()); } }
    function redo() { if (redoStack.length) { undoStack.push(snapshot()); restore(redoStack.pop()); } }
    function changed() { dirty = true; renderAll(); }
    function renderStatus() {
      status.textContent = dirty ? 'Non enregistré' : (savedSite ? 'Enregistré' : 'Aucune modification');
      dot.className = 'st-status__dot' + (dirty ? ' st-status__dot--dirty' : (savedSite ? ' st-status__dot--ok' : ''));
      saveBtn.disabled = !dirty;
      undoBtn.disabled = !undoStack.length;
      redoBtn.disabled = !redoStack.length;
    }
    async function save() {
      if (!dirty) return true;
      saveBtn.disabled = true;
      status.textContent = 'Enregistrement…';
      try {
        savedSite = (await Api.saveSite(site)).data;
        dirty = false;
        renderStatus();
        return true;
      } catch (e) {
        renderStatus();
        alert('Erreur lors de la sauvegarde :\n' + e.message);
        return false;
      }
    }
    // Quitter vers une page : propose d'enregistrer d'abord.
    async function leave(nav) {
      if (dirty) {
        if (confirm('Enregistrer les modifications du plan du site avant de continuer ?')) {
          if (!(await save())) return;
        } else if (!confirm('Quitter sans enregistrer ? Vos modifications seront perdues.')) {
          return;
        }
      }
      close();
      onDone(savedSite, nav || null);
    }
    function onKeydown(e) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
      if (Studio.isTyping(e.target)) return;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    }
    function onBeforeUnload(e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } }
    function close() {
      document.removeEventListener('keydown', onKeydown);
      window.removeEventListener('beforeunload', onBeforeUnload);
      container.innerHTML = '';
    }
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('beforeunload', onBeforeUnload);
    back.addEventListener('click', () => leave(null));
    saveBtn.addEventListener('click', save);
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);

    // ── Repères dans l'arbre ──
    function parentInfo(target, nodes, parent) {
      nodes = nodes || site.chapitres;
      for (const n of nodes) {
        if (n === target) return { parent: parent || null, siblings: nodes };
        if (n.chapitres) {
          const r = parentInfo(target, n.chapitres, n);
          if (r) return r;
        }
      }
      return null;
    }
    function pathOf(target) {
      const p = [];
      let n = target;
      while (n) { p.unshift(n.keyword); const info = parentInfo(n); n = info && info.parent; }
      return p.join('/');
    }
    const contains = (rootNode, target) => rootNode === target || (rootNode.chapitres || []).some(c => contains(c, target));

    // ── Opérations ──
    function newNode() {
      const n = { keyword: '', label: 'Nouvelle page', chapitres: [], sections: [] };
      fresh.add(n);
      return n;
    }
    function addPage() {
      record(null);
      const n = newNode();
      let siblings = site.chapitres, at = siblings.length;
      if (sel && isFolder(sel)) { siblings = sel.chapitres; at = siblings.length; openNodes.add(sel); }
      else if (sel) { const info = parentInfo(sel); siblings = info.siblings; at = siblings.indexOf(sel) + 1; }
      n.keyword = uniqueKeyword(slugify(n.label), siblings, n);
      siblings.splice(at, 0, n);
      sel = n;
      changed();
      focusTitle();
    }
    function addChild(node) {
      if (!isFolder(node) && node.sections && node.sections.length &&
          !confirm('« ' + (node.label || node.keyword) + ' » contient ' + plural(node.sections.length, 'section') +
                   ' de contenu, qui seront perdues en la transformant en rubrique. Continuer ?')) return;
      record(null);
      const n = newNode();
      node.chapitres = node.chapitres || [];
      n.keyword = uniqueKeyword(slugify(n.label), node.chapitres, n);
      node.chapitres.push(n);
      delete node.sections;
      openNodes.add(node);
      sel = n;
      changed();
      focusTitle();
    }
    function remove(node) {
      const info = parentInfo(node);
      const n = isFolder(node) ? countLeaves(node.chapitres) : 0;
      const msg = isFolder(node)
        ? 'Supprimer la rubrique « ' + (node.label || node.keyword) + ' » et ses ' + plural(n, 'page') + ' ?'
        : 'Supprimer la page « ' + (node.label || node.keyword) + ' » et tout son contenu ?';
      if (!confirm(msg)) return;
      record(null);
      info.siblings.splice(info.siblings.indexOf(node), 1);
      // Une rubrique vidée redevient une page (vide).
      if (info.parent && !info.parent.chapitres.length) info.parent.sections = [];
      // Liens de l'accueil vers une page de premier niveau supprimée.
      if (!info.parent) site.home.images.forEach(img => { if (img.lien === node.keyword) img.lien = null; });
      sel = null;
      changed();
    }
    // Déplace `node` dans `newParent` (null : en haut du site), à la fin, ou
    // juste avant / après `anchor` (un de ses futurs frères).
    function moveTo(node, newParent, anchor, after) {
      const from = parentInfo(node);
      const oldPath = from.parent ? null : node.keyword;
      from.siblings.splice(from.siblings.indexOf(node), 1);
      if (from.parent && !from.parent.chapitres.length) from.parent.sections = [];
      const siblings = newParent ? (newParent.chapitres = newParent.chapitres || []) : site.chapitres;
      if (newParent) { delete newParent.sections; openNodes.add(newParent); }
      node.keyword = uniqueKeyword(node.keyword, siblings, node);
      const index = anchor ? siblings.indexOf(anchor) + (after ? 1 : 0) : siblings.length;
      siblings.splice(index, 0, node);
      // Une page de premier niveau qui descend d'un niveau n'est plus une
      // cible de lien de l'accueil.
      if (oldPath && newParent) site.home.images.forEach(img => { if (img.lien === oldPath) img.lien = null; });
    }
    function setKeyword(node, raw) {
      const info = parentInfo(node);
      const old = node.keyword;
      const k = uniqueKeyword(slugify(raw), info.siblings, node);
      node.keyword = k;
      if (!info.parent && old !== k) site.home.images.forEach(img => { if (img.lien === old) img.lien = k; });
    }

    // ── Liste ──
    function matches(node) {
      if (!query) return true;
      return (node.label || node.keyword || '').toLowerCase().includes(query) || (node.chapitres || []).some(matches);
    }
    function renderTree() {
      list.innerHTML = '';
      countEl.textContent = plural(countLeaves(site.chapitres), 'page') + ' · glissez une ligne par sa poignée pour la déplacer';
      addBtn.textContent = sel && isFolder(sel) ? '+ Nouvelle page dans « ' + (sel.label || sel.keyword) + ' »' : '+ Nouvelle page';
      const walk = (nodes, depth) => nodes.forEach(n => {
        if (!matches(n)) return;
        list.appendChild(renderRow(n, depth));
        if (isFolder(n) && (openNodes.has(n) || query)) walk(n.chapitres, depth + 1);
      });
      walk(site.chapitres, 0);
      if (!site.chapitres.length) list.appendChild(txt('div', 'pp-hint', 'Aucune page pour le moment : cliquez sur « + Nouvelle page ».'));
    }

    function renderRow(node, depth) {
      const folder = isFolder(node);
      const row = el('div', 'pl-row' + (node === sel ? ' pl-row--sel' : ''));
      row.setAttribute('role', 'treeitem');
      row.setAttribute('aria-selected', node === sel ? 'true' : 'false');
      if (folder) row.setAttribute('aria-expanded', openNodes.has(node) ? 'true' : 'false');
      row.draggable = true;

      const grip = el('span', 'pl-grip');
      grip.innerHTML = ICON.grip;
      grip.title = 'Glisser pour déplacer';
      row.appendChild(grip);
      const indent = el('span', 'pl-indent');
      indent.style.width = (depth * 24) + 'px';
      row.appendChild(indent);

      if (folder) {
        const chev = el('button', 'pl-chev' + (openNodes.has(node) ? ' pl-chev--open' : ''));
        chev.type = 'button';
        chev.setAttribute('aria-label', (openNodes.has(node) ? 'Replier ' : 'Déplier ') + (node.label || node.keyword));
        chev.innerHTML = PropsPanel.svgIcon(ICON.chev, 14);
        chev.addEventListener('click', e => {
          e.stopPropagation();
          if (openNodes.has(node)) openNodes.delete(node); else openNodes.add(node);
          renderTree();
        });
        row.appendChild(chev);
      } else {
        row.appendChild(el('span', 'pl-chev-spacer'));
      }

      const main = el('button', 'pl-row__main');
      main.type = 'button';
      main.innerHTML = folder ? ICON.folder : ICON.page;
      main.appendChild(txt('span', 'pl-row__label' + (depth === 0 ? ' pl-row__label--top' : ''), node.label || node.keyword || '(sans titre)'));
      main.appendChild(txt('span', 'pl-row__meta', folder ? plural(countLeaves(node.chapitres), 'page')
        : (node.sections && node.sections.length ? plural(node.sections.length, 'section') : 'page vide')));
      main.addEventListener('click', () => { sel = node; keywordOpen = false; renderAll(); });
      row.appendChild(main);

      if (node === sel) {
        const acts = el('div', 'pl-row__acts');
        acts.appendChild(PropsPanel.button('+ Sous-page', () => addChild(node), 'sm'));
        acts.appendChild(PropsPanel.button('Ouvrir', () => leave({ path: pathOf(node), edit: false }), 'sm'));
        row.appendChild(acts);
      }

      // Glisser-déposer : avant / après la ligne, ou dedans (milieu).
      row.addEventListener('dragstart', e => {
        dragNode = node;
        row.classList.add('pl-row--dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', node.label || '');
      });
      row.addEventListener('dragend', () => { row.classList.remove('pl-row--dragging'); dragNode = null; });
      const zone = e => {
        const r = row.getBoundingClientRect();
        const ratio = (e.clientY - r.top) / r.height;
        return ratio < .28 ? 'before' : (ratio > .72 ? 'after' : 'into');
      };
      const clearDrop = () => row.classList.remove('pl-row--drop-before', 'pl-row--drop-after', 'pl-row--drop-into');
      row.addEventListener('dragover', e => {
        if (!dragNode || contains(dragNode, node)) return;
        e.preventDefault();
        const z = zone(e);
        row.classList.toggle('pl-row--drop-before', z === 'before');
        row.classList.toggle('pl-row--drop-after', z === 'after');
        row.classList.toggle('pl-row--drop-into', z === 'into');
      });
      row.addEventListener('dragleave', clearDrop);
      row.addEventListener('drop', e => {
        e.preventDefault();
        clearDrop();
        if (!dragNode || contains(dragNode, node)) return;
        const z = zone(e);
        if (z === 'into' && !isFolder(node) && node.sections && node.sections.length &&
            !confirm('« ' + (node.label || node.keyword) + ' » contient ' + plural(node.sections.length, 'section') +
                     ' de contenu, qui seront perdues en la transformant en rubrique. Continuer ?')) return;
        record(null);
        const moving = dragNode;
        if (z === 'into') moveTo(moving, node, null);
        else moveTo(moving, parentInfo(node).parent, node, z === 'after');
        sel = moving;
        dragNode = null;
        changed();
      });
      return row;
    }

    // ── Détails de la page sélectionnée ──
    function focusTitle() {
      const inp = details.querySelector('#pl-title');
      if (inp) { inp.focus(); inp.select(); }
    }
    function field(labelText, control, id) {
      const f = el('div', 'pl-field');
      const l = txt('label', 'pl-field__label', labelText);
      if (id) l.htmlFor = id;
      f.appendChild(l);
      f.appendChild(control);
      return f;
    }
    function folderOptions(node) {
      const out = [['', 'En haut du site']];
      const walk = (nodes, depth) => nodes.forEach(n => {
        if (contains(node, n)) return;
        if (isFolder(n)) out.push([pathOf(n), '  '.repeat(depth) + (n.label || n.keyword)]);
        if (n.chapitres) walk(n.chapitres, depth + 1);
      });
      walk(site.chapitres, 1);
      return out;
    }
    function nodeByPath(path) {
      let nodes = site.chapitres, node = null;
      path.split('/').forEach(k => { node = (nodes || []).find(n => n.keyword === k); nodes = node && node.chapitres; });
      return node;
    }

    function renderDetails() {
      details.innerHTML = '';
      if (!sel) {
        details.appendChild(txt('div', 'pp-hint', 'Cliquez sur une page de la liste pour la renommer, la déplacer ou la supprimer.'));
        return;
      }
      const node = sel;
      const info = parentInfo(node);
      details.appendChild(txt('h2', 'pl-details__title', node.label || node.keyword || '(sans titre)'));
      details.appendChild(txt('div', 'pl-details__where', info.parent ? 'Dans « ' + (info.parent.label || info.parent.keyword) + ' »' : 'En haut du site'));

      const titleInp = document.createElement('input');
      titleInp.type = 'text'; titleInp.id = 'pl-title'; titleInp.className = 'pp-input';
      titleInp.value = node.label || '';
      titleInp.addEventListener('input', () => {
        record('label');
        node.label = titleInp.value;
        if (fresh.has(node)) setKeyword(node, titleInp.value);
        dirty = true;
        details.querySelector('.pl-details__title').textContent = node.label || node.keyword || '(sans titre)';
        urlEl.textContent = '#/' + pathOf(node);
        renderTree();
        renderStatus();
      });
      details.appendChild(field('Titre de la page', titleInp, 'pl-title'));

      const urlBox = el('div', '');
      const urlEl = txt('div', 'pl-url', '#/' + pathOf(node));
      urlBox.appendChild(urlEl);
      if (keywordOpen) {
        const kwInp = document.createElement('input');
        kwInp.type = 'text'; kwInp.className = 'pp-input'; kwInp.value = node.keyword;
        kwInp.setAttribute('aria-label', 'Adresse de la page');
        kwInp.addEventListener('change', () => {
          record(null);
          fresh.delete(node);
          setKeyword(node, kwInp.value);
          changed();
        });
        urlBox.appendChild(kwInp);
        urlBox.appendChild(txt('div', 'pl-help', 'Lettres sans accents, chiffres, - et _. Les liens de la page d\'accueil sont mis à jour.'));
      } else {
        const more = txt('button', 'pl-link', "Modifier l'adresse (avancé)");
        more.type = 'button';
        more.addEventListener('click', () => { keywordOpen = true; renderDetails(); });
        urlBox.appendChild(more);
      }
      details.appendChild(field('Adresse de la page', urlBox));

      const moveSel = document.createElement('select');
      moveSel.id = 'pl-move'; moveSel.className = 'pp-input';
      const curParent = info.parent ? pathOf(info.parent) : '';
      folderOptions(node).forEach(([v, l]) => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = l;
        if (v === curParent) opt.selected = true;
        moveSel.appendChild(opt);
      });
      moveSel.addEventListener('change', () => {
        record(null);
        moveTo(node, moveSel.value ? nodeByPath(moveSel.value) : null);
        changed();
      });
      details.appendChild(field('Déplacer dans', moveSel, 'pl-move'));

      if (!info.parent && site.home.images.some(img => img.lien === node.keyword)) {
        details.appendChild(txt('div', 'pl-help', "Un bloc de la page d'accueil mène à cette page."));
      }

      const acts = el('div', 'pp-actions');
      acts.appendChild(PropsPanel.button('Voir la page', () => leave({ path: pathOf(node), edit: false })));
      if (!isFolder(node)) acts.appendChild(PropsPanel.button('Modifier le contenu', () => leave({ path: pathOf(node), edit: true })));
      details.appendChild(acts);
      const danger = el('div', 'pp-actions pl-danger');
      danger.appendChild(PropsPanel.button(isFolder(node)
        ? 'Supprimer la rubrique et ses ' + plural(countLeaves(node.chapitres), 'page') + '…'
        : 'Supprimer la page…', () => remove(node), 'danger'));
      details.appendChild(danger);
    }

    function renderAll() {
      renderTree();
      renderDetails();
      renderStatus();
    }
    renderAll();
  }

  return { open };
})();
