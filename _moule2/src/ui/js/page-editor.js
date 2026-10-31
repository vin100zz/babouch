'use strict';

// ── Modifier une page de contenu, directement sur la page ──────────────────
// La page est rendue par ContentView, exactement comme en lecture. Les outils
// (barres flottantes, « + », poignée de redimensionnement, ligne de dépôt)
// sont posés dans le calque de l'éditeur, par-dessus la page, sans jamais en
// modifier la mise en page. Un bloc TEXTE sélectionné s'écrit sur place.
// La barre de gauche n'affiche que les propriétés de la sélection.

const PageEditor = (function () {

  const ICONS = {
    up: 'M12 19V5M6 11l6-6 6 6',
    down: 'M12 5v14M6 13l6 6 6-6',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    plus: 'M12 5v14M5 12h14',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  };
  const GRIP_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.8"/><circle cx="15" cy="6" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="18" r="1.8"/><circle cx="15" cy="18" r="1.8"/></svg>';
  const COLUMNS = [[1, '1'], [2, '2'], [3, '3'], [4, '4']];

  function blockLabel(b) {
    if (b.type === 'TEXTE') return 'Texte';
    if (b.type === 'HTML') return 'HTML';
    if (isVideoPath(b.fichier)) return 'Vidéo';
    if (isAudioPath(b.fichier)) return 'Son';
    return 'Image';
  }

  function open(container, siteData, pathSegments, onDone) {
    const site = StyleItems.normalize(clone(siteData));
    const ps = site.pagesStyle;
    const configs = SiteChrome.resolvePath(site, pathSegments).configs;
    let node = configs[configs.length - 1].node;
    if (!Array.isArray(node.sections)) node.sections = [];

    let sel = null;             // 'pageTitle' | section | bloc (objets du JSON)
    let ids = new WeakMap(), nextId = 0;
    let objs = new Map();       // id suivi → objet
    let elOf = new Map();       // objet → élément rendu
    let colEls = [];            // { section, ci, el } : colonnes rendues
    let titleEl = null;
    let textEdit = null;        // { block, el, detach } : bloc TEXTE en cours d'écriture
    let plusTarget = null, secTarget = null;   // bloc / section survolés (outils « + »)
    let dragging = null;

    const snapshot = () => JSON.stringify({ label: node.label, sections: node.sections });
    const studio = Studio.open({
      container,
      site,
      title: node.label || node.keyword,
      subtitle: 'Modifier la page',
      snapshot,
      restore(s) {
        const d = JSON.parse(s);
        node.label = d.label;
        node.sections = d.sections;
        sel = sel === 'pageTitle' ? sel : null;
        renderPage();
        renderPanel();
      },
      save: async () => (await Api.saveSite(site)).data,
      onPick,
      onKey,
      onFrame,
      onClose(saved) {
        document.removeEventListener('mousedown', onDocMousedown);
        onDone(saved);
      },
    });

    function idOf(obj) {
      if (obj === 'pageTitle') return 'pageTitle';
      let id = ids.get(obj);
      if (!id) { id = 'o' + (++nextId); ids.set(obj, id); }
      objs.set(id, obj);
      return id;
    }
    const isSection = o => !!(o && o.colonnes);
    const isBlock = o => !!(o && o.type);

    // Instantané pour « Annuler » + modification ; `section` : seule cette
    // section est rendue à nouveau, sinon toute la page.
    function change(key, fn, opts) {
      opts = opts || {};
      studio.record(key);
      fn();
      if (opts.section) rerenderSection(opts.section); else renderPage();
      if (opts.panel) renderPanel();
    }

    // ── Rendu ──

    function renderPage() {
      detachText();
      studio.untrackAll();
      elOf = new Map(); colEls = []; objs = new Map();
      const page = studio.page;
      page.innerHTML = '';

      const contentPage = el('div', 'm2-content-page');
      HomeView.applyBackgroundStyle(contentPage, ps.background);
      const topbar = el('div', 'm2-page-topbar');
      topbar.appendChild(SiteChrome.header(site, 'pages'));
      topbar.appendChild(SiteChrome.breadcrumb(site, configs));
      contentPage.appendChild(topbar);

      const wrap = el('div', 'm2-page');
      titleEl = txt('div', 'm2-page__title', node.label || node.keyword);
      ContentView.applyPageTitleStyle(titleEl, ps.pageTitle);
      wrap.appendChild(titleEl);
      studio.track(titleEl, 'pageTitle', 'Titre de la page');
      node.sections.forEach(section => wrap.appendChild(renderSection(section)));
      if (!node.sections.length) {
        // Page vide : seul point d'entrée visible dans la page (en lecture,
        // une page vide affiche de toute façon un message à la place).
        const add = txt('button', 'st-empty-page', '+ Ajouter une première section');
        add.type = 'button';
        add.addEventListener('click', e => { e.stopPropagation(); addSectionAfter(null); });
        wrap.appendChild(add);
      }
      contentPage.appendChild(wrap);
      const footer = SiteChrome.footerIcon(site);
      if (footer) contentPage.appendChild(footer);
      page.appendChild(contentPage);
      applySelection();
    }

    function renderSection(section) {
      return ContentView.renderSection(section, ps, { editing: true, onElement });
    }
    function onElement(elm, kind, obj, ci) {
      if (kind === 'section') {
        elOf.set(obj, elm);
        studio.track(elm, idOf(obj), 'Section');
      } else if (kind === 'col') {
        colEls.push({ section: obj, ci, el: elm });
      } else if (kind === 'block') {
        elOf.set(obj, elm);
        studio.track(elm, idOf(obj), blockLabel(obj));
      }
    }
    function rerenderSection(section) {
      const old = elOf.get(section);
      if (!old || !old.isConnected) { renderPage(); return; }
      if (textEdit && sectionOf(textEdit.block) === section) detachText();
      colEls = colEls.filter(c => c.section !== section);
      old.replaceWith(renderSection(section));
      applySelection();
    }

    // ── Sélection ──

    function select(obj) {
      if (obj === sel) return;
      detachText();
      closeMenu();
      sel = obj;
      applySelection();
      renderPanel();
    }
    function applySelection() {
      studio.setSelection(sel ? [idOf(sel)] : []);
      studio.setSelTitle(selectionTitle());
      if (isBlock(sel) && sel.type === 'TEXTE') {
        const elm = elOf.get(sel);
        if (textEdit && textEdit.el !== elm) detachText();
        if (!textEdit && elm) attachText(sel, elm);
      }
    }
    function selectionTitle() {
      if (sel === 'pageTitle') return 'Titre de la page';
      if (isSection(sel)) return sel.titre ? sel.titre : 'Section ' + (node.sections.indexOf(sel) + 1) + ' (sans titre)';
      if (isBlock(sel)) return blockLabel(sel);
      return node.label || node.keyword;
    }

    // Le texte sélectionné devient éditable sur place. L'instantané pris ici
    // n'est enregistré qu'à la première frappe (sélectionner n'est pas
    // modifier).
    function attachText(block, elm) {
      const before = snapshot();
      let recorded = false;
      const detach = RichText.attach(elm, block, () => {
        if (!recorded) { studio.recordSnapshot(before, null); recorded = true; }
      });
      textEdit = { block, el: elm, detach };
    }
    function detachText() {
      if (!textEdit) return;
      textEdit.detach();
      textEdit = null;
    }

    function onPick(id, e) {
      if (dragging) return;
      const obj = id ? objs.get(id) || (id === 'pageTitle' ? 'pageTitle' : null) : null;
      select(obj);
      if (e && isBlock(obj) && obj.type === 'TEXTE' && document.activeElement !== elOf.get(obj)) elOf.get(obj).focus();
    }
    // Un appui sur un texte non sélectionné le rend éditable avant que le
    // navigateur place le curseur : un seul clic suffit pour écrire.
    studio.page.addEventListener('mousedown', e => {
      const t = e.target.closest('[data-st-id]');
      const obj = t && objs.get(t.dataset.stId);
      if (isBlock(obj) && obj.type === 'TEXTE' && obj !== sel) select(obj);
    });

    function onKey(e) {
      if (e.key === 'Escape') { closeMenu(); select(null); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && (isBlock(sel) || isSection(sel))) {
        e.preventDefault();
        removeSelected();
      }
    }

    // ── Opérations sur la structure ──

    function sectionOf(block) {
      return node.sections.find(s => (s.colonnes || []).some(c => c.indexOf(block) !== -1)) || null;
    }
    function locate(block) {
      for (const s of node.sections) {
        for (let ci = 0; ci < s.colonnes.length; ci++) {
          const bi = s.colonnes[ci].indexOf(block);
          if (bi !== -1) return { section: s, col: s.colonnes[ci], ci, bi };
        }
      }
      return null;
    }

    function move(dir) {
      if (isSection(sel)) {
        const i = node.sections.indexOf(sel), j = i + dir;
        if (j < 0 || j >= node.sections.length) return;
        change(null, () => { node.sections.splice(j, 0, node.sections.splice(i, 1)[0]); });
      } else if (isBlock(sel)) {
        const loc = locate(sel);
        const j = loc.bi + dir;
        if (j < 0 || j >= loc.col.length) return;
        change(null, () => { loc.col.splice(j, 0, loc.col.splice(loc.bi, 1)[0]); }, { section: loc.section });
      }
    }
    function removeSelected() {
      detachText();
      if (isSection(sel)) {
        const s = sel;
        sel = null;
        change(null, () => { node.sections.splice(node.sections.indexOf(s), 1); }, { panel: true });
      } else if (isBlock(sel)) {
        const loc = locate(sel);
        sel = null;
        change(null, () => { loc.col.splice(loc.bi, 1); }, { section: loc.section, panel: true });
      }
    }
    function addSectionAfter(section) {
      const fresh = { titre: null, colonnes: [[]] };
      const i = section ? node.sections.indexOf(section) + 1 : node.sections.length;
      change(null, () => { node.sections.splice(i, 0, fresh); });
      select(fresh);
    }
    function setColumns(section, n) {
      change('cols', () => {
        let cols = section.colonnes;
        if (n < cols.length) {
          const extra = cols.slice(n).reduce((a, c) => a.concat(c), []);
          cols = cols.slice(0, n);
          cols[n - 1] = cols[n - 1].concat(extra);
        }
        while (cols.length < n) cols.push([]);
        section.colonnes = cols;
      }, { section, panel: true });
    }

    // Nouveau bloc dans une colonne, après `after` (ou à la fin). Un document
    // passe d'abord par l'explorateur : rien n'est ajouté si on l'annule.
    function insertBlock(type, section, ci, after) {
      closeMenu();
      const put = block => {
        change(null, () => {
          const col = section.colonnes[ci];
          col.splice(after ? col.indexOf(after) + 1 : col.length, 0, block);
        }, { section });
        select(block);
        if (block.type === 'TEXTE' && elOf.get(block)) elOf.get(block).focus();
      };
      if (type === 'TEXTE') put({ type: 'TEXTE', html: '', align: 'left' });
      else if (type === 'HTML') put({ type: 'HTML', html: '' });
      else FileBrowser.open(path => put({ type: 'DOCUMENTS', fichier: path, width: 100 }), { type: 'media', initialDir: nearestDir() });
    }

    // Dossier de départ de l'explorateur : celui du document sélectionné,
    // sinon celui d'un document déjà présent sur la page.
    function nearestDir(block) {
      const dirOf = f => (f && f.includes('/')) ? f.replace(/\/[^/]+$/, '') : null;
      if (block && dirOf(block.fichier)) return dirOf(block.fichier);
      for (const s of node.sections) for (const c of s.colonnes) for (const b of c) {
        if (b.type === 'DOCUMENTS' && dirOf(b.fichier)) return dirOf(b.fichier);
      }
      return '';
    }

    // ── Outils flottants (calque de l'éditeur) ──

    const layer = studio.layer;
    function toolBtn(title, path, onClick, extraClass) {
      const b = el('button', 'st-tool' + (extraClass ? ' ' + extraClass : ''));
      b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
      if (path) b.innerHTML = PropsPanel.svgIcon(path);
      b.addEventListener('mousedown', e => e.preventDefault()); // garde la sélection du texte
      b.addEventListener('click', e => { e.stopPropagation(); onClick(e); });
      return b;
    }

    // Barre d'un bloc : mise en forme (texte seulement), déplacer, monter,
    // descendre, supprimer.
    const blockBar = el('div', 'st-toolbar');
    blockBar.setAttribute('role', 'toolbar');
    const fmt = el('div', 'st-toolbar__group');
    // Instantané pris avant la mise en forme, enregistré une fois appliquée.
    const recordAfter = () => { const before = snapshot(); return () => studio.recordSnapshot(before, null); };
    [['Gras', 'G', 'bold'], ['Italique', 'I', 'italic'], ['Souligné', 'S', 'underline']].forEach(([title, letter, cmd]) => {
      const b = toolBtn(title, null, () => { if (textEdit) RichText.format(textEdit.el, textEdit.block, cmd, recordAfter()); }, 'st-tool--' + cmd);
      b.textContent = letter;
      fmt.appendChild(b);
    });
    fmt.appendChild(toolBtn('Insérer un lien', ICONS.link, () => { if (textEdit) RichText.insertLink(textEdit.el, textEdit.block, recordAfter()); }));
    fmt.appendChild(el('span', 'st-toolbar__sep'));
    const alignBtns = {};
    PropsPanel.ALIGN_OPTIONS.forEach(([v, title, path]) => {
      alignBtns[v] = toolBtn(title, path, () => {
        const block = sel;
        change('align', () => { block.align = v; }, { section: sectionOf(block), panel: true });
      });
      fmt.appendChild(alignBtns[v]);
    });
    fmt.appendChild(el('span', 'st-toolbar__sep'));
    blockBar.appendChild(fmt);
    const grip = el('span', 'st-tool st-tool--grip');
    grip.title = 'Glisser pour déplacer';
    grip.innerHTML = GRIP_SVG;
    grip.addEventListener('mousedown', startDrag);
    blockBar.appendChild(grip);
    blockBar.appendChild(toolBtn('Monter', ICONS.up, () => move(-1)));
    blockBar.appendChild(toolBtn('Descendre', ICONS.down, () => move(1)));
    blockBar.appendChild(toolBtn('Supprimer', ICONS.trash, removeSelected, 'st-tool--danger'));
    layer.appendChild(blockBar);

    const secBar = el('div', 'st-toolbar');
    secBar.setAttribute('role', 'toolbar');
    secBar.appendChild(toolBtn('Monter la section', ICONS.up, () => move(-1)));
    secBar.appendChild(toolBtn('Descendre la section', ICONS.down, () => move(1)));
    secBar.appendChild(toolBtn('Supprimer la section', ICONS.trash, removeSelected, 'st-tool--danger'));
    layer.appendChild(secBar);

    const plusBtn = toolBtn('Ajouter un élément en dessous', ICONS.plus, () => {
      const loc = locate(plusBtn.target);
      if (loc) openMenu(plusBtn, loc.section, loc.ci, plusBtn.target);
    }, 'st-plus');
    layer.appendChild(plusBtn);

    const secPlus = txt('button', 'st-pill', '+ Nouvelle section');
    secPlus.type = 'button';
    secPlus.addEventListener('click', e => { e.stopPropagation(); addSectionAfter(secPlus.section); });
    layer.appendChild(secPlus);

    const resizeHandle = el('span', 'st-handle');
    resizeHandle.title = 'Tirer pour redimensionner';
    resizeHandle.addEventListener('mousedown', startResize);
    layer.appendChild(resizeHandle);

    const dropLine = el('div', 'st-dropline');
    layer.appendChild(dropLine);

    const emptyCols = [];       // boutons « + » posés sur les colonnes vides
    function emptyColBtn(i) {
      if (!emptyCols[i]) {
        const b = txt('button', 'st-emptycol', '+ Ajouter');
        b.type = 'button';
        b.addEventListener('click', e => { e.stopPropagation(); openMenu(b, b.section, b.ci, null); });
        layer.appendChild(b);
        emptyCols[i] = b;
      }
      return emptyCols[i];
    }

    // Menu « ajouter » : texte, document (image, vidéo, son) ou HTML.
    const menu = el('div', 'st-menu');
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    [['Texte', 'TEXTE'], ['Image, vidéo, son', 'DOCUMENTS'], ['HTML', 'HTML']].forEach(([label, type]) => {
      const b = txt('button', 'st-menu__item', label);
      b.type = 'button'; b.setAttribute('role', 'menuitem');
      b.addEventListener('click', e => { e.stopPropagation(); insertBlock(type, menu.section, menu.ci, menu.after); });
      menu.appendChild(b);
    });
    layer.appendChild(menu);
    function openMenu(anchor, section, ci, after) {
      Object.assign(menu, { section, ci, after, anchor });
      menu.hidden = false;
    }
    function closeMenu() { menu.hidden = true; menu.anchor = null; }
    function onDocMousedown(e) {
      if (!menu.hidden && !menu.contains(e.target) && !(menu.anchor && menu.anchor.contains(e.target))) closeMenu();
    }
    document.addEventListener('mousedown', onDocMousedown);

    // Pose `elm` contre le rectangle `r` (coordonnées de la fenêtre). Les
    // barres d'outils d'un élément plus haut que l'écran restent visibles,
    // juste sous le header collant, tant que l'élément est à l'écran.
    let minTop = 8;
    function place(elm, r, where) {
      if (!r) { elm.hidden = true; return; }
      elm.hidden = false;
      const w = elm.offsetWidth, h = elm.offsetHeight;
      const barY = () => Math.max(r.top - h - 8, Math.min(minTop, r.bottom - h));
      let x, y;
      if (where === 'top-right') { x = r.right - w; y = barY(); }
      else if (where === 'top-left') { x = r.left; y = barY(); }
      else if (where === 'bottom-center') { x = r.left + r.width / 2 - w / 2; y = r.bottom - h / 2; }
      else if (where === 'bottom-right') { x = r.right - w / 2; y = r.bottom - h / 2; }
      else if (where === 'below') { x = r.left + r.width / 2 - w / 2; y = r.bottom + 6; }
      else if (where === 'inside-top') {
        // Sous le libellé si la colonne est assez haute, sinon centré dessus :
        // le menu ne déborde jamais de la colonne vers la section suivante.
        x = r.left + r.width / 2 - w / 2;
        y = Math.max(r.top, minTop) + 44;
        if (y + h > r.bottom - 4) y = Math.max(r.top + (r.height - h) / 2, minTop);
      }
      elm.style.left = Math.max(0, x + window.scrollX) + 'px';
      elm.style.top = Math.max(0, y + window.scrollY) + 'px';
    }
    const rectOf = obj => {
      const elm = obj && elOf.get(obj);
      return elm && elm.isConnected ? elm.getBoundingClientRect() : null;
    };

    function onFrame() {
      // Cible des « + » : le bloc / la section survolés. Quand le pointeur
      // quitte la page pour un outil (survol nul), la cible est conservée,
      // pour que le « + » ne disparaisse pas au moment de cliquer dessus.
      const hId = studio.getHover();
      const h = hId ? objs.get(hId) : undefined;
      if (hId) {
        plusTarget = isBlock(h) ? h : null;
        secTarget = isSection(h) ? h : null;
      }
      const selBlock = isBlock(sel) ? sel : null;
      const selSection = isSection(sel) ? sel : null;
      const isText = selBlock && selBlock.type === 'TEXTE';
      const busy = !!dragging;
      const topbar = studio.page.querySelector('.m2-page-topbar');
      minTop = (topbar ? topbar.getBoundingClientRect().bottom : 0) + 8;

      fmt.hidden = !isText;
      if (isText) Object.keys(alignBtns).forEach(v => alignBtns[v].classList.toggle('st-tool--on', (selBlock.align || 'left') === v));
      place(blockBar, !busy && selBlock && rectOf(selBlock), 'top-right');
      place(secBar, !busy && selSection && rectOf(selSection), 'top-right');

      // Menu ouvert depuis ce « + » : il reste sur le bloc visé.
      const plusFor = !menu.hidden && menu.anchor === plusBtn ? menu.after : (plusTarget || selBlock);
      plusBtn.target = plusFor;
      place(plusBtn, !busy && plusFor && rectOf(plusFor), 'bottom-center');

      // Dans l'espace entre deux sections, sous celle visée.
      const secFor = selSection || secTarget;
      secPlus.section = secFor;
      place(secPlus, !busy && secFor && rectOf(secFor), 'below');

      let media = null;
      if (selBlock && selBlock.type === 'DOCUMENTS' && !isAudioPath(selBlock.fichier)) {
        const wrap = elOf.get(selBlock);
        media = wrap && wrap.querySelector('img, video');
      }
      place(resizeHandle, !busy && media ? media.getBoundingClientRect() : null, 'bottom-right');

      // « + Ajouter » sur les colonnes vides de la section concernée.
      const focusSection = selSection || (selBlock && sectionOf(selBlock)) || secTarget;
      let n = 0;
      colEls.forEach(c => {
        if (c.section !== focusSection || c.section.colonnes[c.ci].length || !c.el.isConnected) return;
        const b = emptyColBtn(n++);
        b.section = c.section; b.ci = c.ci;
        const r = c.el.getBoundingClientRect();
        b.hidden = false;
        b.style.left = (r.left + window.scrollX) + 'px';
        b.style.top = (r.top + window.scrollY) + 'px';
        b.style.width = r.width + 'px';
        b.style.height = r.height + 'px';
      });
      for (let i = n; i < emptyCols.length; i++) emptyCols[i].hidden = true;

      // Sous le « + » ; pour une colonne vide (zone haute), sous son libellé.
      if (!menu.hidden && menu.anchor) {
        const inCol = menu.anchor.classList.contains('st-emptycol');
        place(menu, menu.anchor.hidden ? null : menu.anchor.getBoundingClientRect(), inCol ? 'inside-top' : 'below');
      }
    }

    // ── Glisser-déposer d'un bloc (poignée de la barre flottante) ──

    function dropTarget(x, y) {
      for (const c of colEls) {
        if (!c.el.isConnected) continue;
        const r = c.el.getBoundingClientRect();
        if (x < r.left || x > r.right || y < r.top - 12 || y > r.bottom + 12) continue;
        const blocks = c.section.colonnes[c.ci];
        let index = blocks.length, lineY = null;
        for (let i = 0; i < blocks.length; i++) {
          const br = rectOf(blocks[i]);
          if (br && y < br.top + br.height / 2) { index = i; lineY = br.top - 7; break; }
        }
        if (lineY === null) {
          const last = blocks.length ? rectOf(blocks[blocks.length - 1]) : null;
          lineY = last ? last.bottom + 7 : r.top + 10;
        }
        return { section: c.section, ci: c.ci, index, line: { left: r.left, width: r.width, top: lineY } };
      }
      return null;
    }
    function startDrag(e) {
      e.preventDefault();
      e.stopPropagation();
      const block = sel;
      detachText();
      const ghost = txt('div', 'st-ghost', blockLabel(block));
      layer.appendChild(ghost);
      dragging = { block };
      let target = null;
      const onMove = ev => {
        ghost.style.left = (ev.clientX + window.scrollX + 12) + 'px';
        ghost.style.top = (ev.clientY + window.scrollY + 12) + 'px';
        target = dropTarget(ev.clientX, ev.clientY);
        dropLine.hidden = !target;
        if (target) {
          dropLine.style.left = (target.line.left + window.scrollX) + 'px';
          dropLine.style.top = (target.line.top + window.scrollY) + 'px';
          dropLine.style.width = target.line.width + 'px';
        }
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        ghost.remove();
        dropLine.hidden = true;
        dragging = null;
        if (!target) { applySelection(); return; }
        const from = locate(block);
        const to = target.section.colonnes[target.ci];
        let index = target.index;
        if (from.col === to && from.bi < index) index--;
        if (from.col === to && from.bi === index) { applySelection(); return; }
        const sameSection = from.section === target.section;
        change(null, () => {
          from.col.splice(from.bi, 1);
          to.splice(index, 0, block);
        }, sameSection ? { section: target.section } : {});
      };
      dropLine.hidden = true;
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }

    // ── Redimensionner une image ou une vidéo (poignée du coin) ──

    function startResize(e) {
      e.preventDefault();
      e.stopPropagation();
      const block = sel;
      const wrap = elOf.get(block);
      const media = wrap.querySelector('img, video');
      const wrapW = wrap.getBoundingClientRect().width || 1;
      const startW = media.getBoundingClientRect().width;
      const sx = e.clientX;
      studio.record(null);
      // Image centrée : tirer le coin de d px l'élargit de 2d. Tirer la poignée
      // ajuste l'image à la colonne, pour pouvoir l'agrandir au-delà de sa
      // taille naturelle (jusqu'à toute la largeur).
      const onMove = ev => {
        block.fit = true;
        const w = startW + (ev.clientX - sx) * 2;
        block.width = Math.max(10, Math.min(100, Math.round(w / wrapW * 100)));
        ContentView.applyMediaWidth(media, block.width, block.fit);
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        renderPanel();
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }

    // ── Panneau : propriétés de la sélection uniquement ──

    function renderPanel() {
      PropsPanel.render(studio.panel, panelItems());
    }

    function panelItems() {
      if (sel === 'pageTitle') {
        return [
          { group: 'Texte' },
          { type: 'text', label: 'Titre', get: () => node.label || '', set: v => {
            studio.record('label');
            node.label = v;
            titleEl.textContent = v || node.keyword;
            studio.setSelTitle(selectionTitle());
          } },
        ];
      }
      if (isSection(sel)) return sectionItems(sel);
      if (isBlock(sel) && sel.type === 'TEXTE') return textItems(sel);
      if (isBlock(sel) && sel.type === 'DOCUMENTS') return documentItems(sel);
      if (isBlock(sel) && sel.type === 'HTML') return htmlItems(sel);
      return [
        { hint: 'Cliquez sur un élément de la page pour le modifier.' },
        { actions: [{ label: '+ Ajouter une section', onClick: () => addSectionAfter(null) }] },
      ];
    }

    function sectionItems(section) {
      const box = () => section.style || {};
      const setBox = patch => {
        const s = Object.assign({}, ContentView.DEFAULT_SECTION_BOX_STYLE, section.style || {}, patch);
        section.style = (s.bg || s.borderWidth > 0) ? s : null;
      };
      // Sans fond (null), la ligne Couleur part d'un blanc à 0 % d'opacité :
      // choisir une couleur la rend aussitôt visible (opacité 100 %), et
      // ramener l'opacité à 0 retire le fond (section.style.bg = null).
      const setBg = v => {
        if (!box().bg && /00$/i.test(v) && v.slice(0, 7).toLowerCase() !== '#ffffff') v = v.slice(0, 7) + 'ff';
        setBox({ bg: /^#[0-9a-f]{6}00$/i.test(v) ? null : v });
      };
      return [
        { group: 'Section' },
        { type: 'text', label: 'Titre', placeholder: 'Sans titre', get: () => section.titre || '',
          set: v => change('titre', () => { section.titre = v || null; }, { section }) },
        { type: 'seg', label: 'Colonnes', options: COLUMNS, get: () => section.colonnes.length, set: v => setColumns(section, +v) },
        { group: 'Remplissage' },
        // Opacité à 0 : pas de fond (section.style.bg = null, comme avant).
        ...PropsPanel.fillRows(() => box().bg || '#ffffff00', v => change('box.bg', () => setBg(v), { section })),
        { group: 'Bordure' },
        { type: 'range', label: 'Épaisseur', min: 0, max: 10, unit: ' px', get: () => box().borderWidth || 0,
          set: v => change('box.bw', () => setBox({ borderWidth: v }), { section }) },
        { type: 'color', label: 'Couleur', get: () => box().borderColor || ContentView.DEFAULT_SECTION_BOX_STYLE.borderColor,
          set: v => change('box.bc', () => setBox({ borderColor: v }), { section }) },
        { type: 'range', label: 'Arrondi', min: 0, max: 40, unit: ' px', get: () => box().borderRadius || 0,
          set: v => change('box.br', () => setBox({ borderRadius: v }), { section }) },
        { group: 'Ajouter dans la section' },
        { actions: [
          { label: '+ Texte', onClick: () => insertBlock('TEXTE', section, 0, null) },
          { label: '+ Image, vidéo, son', onClick: () => insertBlock('DOCUMENTS', section, 0, null) },
          { label: '+ HTML', onClick: () => insertBlock('HTML', section, 0, null) },
        ] },
      ];
    }

    // Le même widget Texte que partout ailleurs ; police, taille et couleur
    // propres à ce bloc (block.style), sinon celles du style des pages.
    function textItems(block) {
      const g = ps.blocTexte;
      const defaults = { font: g.font, fontFile: g.fontFile, size: g.size || 17, color: g.textColor };
      const adapter = {
        get: k => k === 'align' ? (block.align || 'left')
          : ((block.style || {})[k] != null ? block.style[k] : (defaults[k] != null ? defaults[k] : null)),
        // Panneau reconstruit seulement pour la police et l'alignement : pas
        // pendant qu'on fait glisser le curseur de taille.
        set: patch => change('text.' + Object.keys(patch).join(), () => {
          const rest = Object.assign({}, patch);
          if ('align' in rest) { block.align = rest.align; delete rest.align; }
          if (Object.keys(rest).length) {
            block.style = StyleItems.assign(Object.assign({}, block.style), rest);
            if (!Object.keys(block.style).length) delete block.style;
          }
        }, { section: sectionOf(block), panel: 'font' in patch || 'align' in patch }),
      };
      return [
        { group: 'Texte' },
        ...PropsPanel.textRows(adapter, { align: true, sizeMin: 10, sizeMax: 60 }),
        { group: 'Taille' },
        { type: 'range', label: 'Largeur', min: 20, max: 100, unit: ' %', nullLabel: 'Auto',
          get: () => block.width || null, set: v => change('text.width', () => { block.width = v; }, { section: sectionOf(block) }) },
      ];
    }

    function documentItems(block) {
      return [
        { group: 'Document' },
        { type: 'image', label: 'Fichier', root: 'documents', fileType: 'media', empty: 'Aucun document',
          initialDir: () => nearestDir(block),
          get: () => block.fichier, set: p => change('fichier', () => { block.fichier = p; }, { section: sectionOf(block), panel: true }) },
        { type: 'toggle', label: 'Taille', on: 'Ajustée à la colonne', off: 'Naturelle',
          get: () => block.fit, set: v => change('doc.fit', () => { block.fit = v; }, { section: sectionOf(block) }) },
        { type: 'range', label: 'Largeur', min: 10, max: 100, unit: ' %',
          get: () => block.width || 100, set: v => change('doc.width', () => { block.width = v; }, { section: sectionOf(block) }) },
      ];
    }

    function htmlItems(block) {
      return [
        { group: 'Code HTML' },
        { type: 'textarea', label: 'HTML', get: () => block.html || '',
          set: v => change('html', () => { block.html = v; }, { section: sectionOf(block) }) },
      ];
    }

    renderPage();
    renderPanel();
  }

  return { open };
})();
