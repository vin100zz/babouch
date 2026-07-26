'use strict';

// ── Édition de l'architecture globale du site ───────────────────────────────
// Deux onglets : page d'accueil (images positionnées) et arborescence
// (nœuds keyword/label). Remplace le contenu de `container` pendant l'édition
// et appelle onDone() (sauvegardé ou annulé) pour rendre la main à app.js.

const TreeEditor = (function () {

  let _site = null;      // copie de travail (clone) du JSON complet du site
  let _container = null;
  let _onDone = null;
  let _activeTab = 'home';

  function open(container, siteData, onDone, initialTab) {
    _container = container;
    _site = clone(siteData);
    if (!_site.home) _site.home = { images: [] };
    if (!Array.isArray(_site.home.images)) _site.home.images = [];
    if (!_site.home.headerStyle) _site.home.headerStyle = clone(HomeView.DEFAULT_HEADER_STYLE);
    if (!_site.home.background) _site.home.background = clone(HomeView.DEFAULT_BACKGROUND);
    if (!_site.pagesStyle) _site.pagesStyle = {};
    if (!_site.pagesStyle.background) _site.pagesStyle.background = clone(HomeView.DEFAULT_BACKGROUND);
    if (!_site.pagesStyle.section) _site.pagesStyle.section = clone(ContentView.DEFAULT_SECTION_STYLE);
    if (!_site.pagesStyle.blocTexte) _site.pagesStyle.blocTexte = clone(ContentView.DEFAULT_BLOC_TEXTE_STYLE);
    if (!_site.pagesStyle.image) _site.pagesStyle.image = clone(ContentView.DEFAULT_IMAGE_STYLE);
    if (!Array.isArray(_site.chapitres)) _site.chapitres = [];
    _onDone = onDone;
    _activeTab = initialTab === 'tree' ? 'tree' : 'home';
    _render();
  }

  function _render() {
    _container.innerHTML = '';
    _removeBar();
    _removeAlignBar();
    document.body.appendChild(_buildBar());
    _container.appendChild(_buildTabsBar());

    if (_activeTab === 'home') {
      // Header + canevas partagent un même fond (comme en lecture, voir
      // app.js::renderHome) : le fond continue derrière le header, visible à
      // travers lui dès qu'il a de la transparence.
      const page = el('div', 'm2-home-page');
      HomeView.applyBackgroundStyle(page, _site.home.background);
      page.appendChild(_buildHeader());
      const panel = el('div', 'ed-panel');
      panel.appendChild(_buildHomeEditor(page));
      page.appendChild(panel);
      _container.appendChild(page);
    } else if (_activeTab === 'pages') {
      // Même principe : header + petit aperçu de fond en haut (cliquables),
      // puis en dessous, dans un panneau neutre, les styles des éléments de
      // contenu (section, bloc TEXTE, image).
      const page = el('div', 'm2-home-page ed-pages-preview');
      HomeView.applyBackgroundStyle(page, _site.pagesStyle.background);
      page.addEventListener('click', e => {
        if (e.target === page) _openBackgroundPopup(page, _site.pagesStyle.background, 'Style du fond des pages');
      });
      page.appendChild(_buildHeader());
      _container.appendChild(page);
      const panel = el('div', 'ed-panel');
      panel.appendChild(_buildPagesStyleEditor());
      _container.appendChild(panel);
    } else {
      _container.appendChild(_buildHeader());
      const panel = el('div', 'ed-panel');
      panel.appendChild(_buildTreeEditor());
      _container.appendChild(panel);
    }
  }

  function _buildTabsBar() {
    const bar = el('div', 'm2-tabsbar');
    const tabHome = txt('button', 'm2-tab' + (_activeTab === 'home' ? ' m2-tab--active' : ''), 'Page d\'accueil');
    tabHome.type = 'button';
    const tabTree = txt('button', 'm2-tab' + (_activeTab === 'tree' ? ' m2-tab--active' : ''), 'Arborescence');
    tabTree.type = 'button';
    const tabPages = txt('button', 'm2-tab' + (_activeTab === 'pages' ? ' m2-tab--active' : ''), 'Style des pages');
    tabPages.type = 'button';
    tabHome.addEventListener('click', () => { _activeTab = 'home'; _render(); });
    tabTree.addEventListener('click', () => { _activeTab = 'tree'; _render(); });
    tabPages.addEventListener('click', () => { _activeTab = 'pages'; _render(); });
    bar.appendChild(tabHome); bar.appendChild(tabTree); bar.appendChild(tabPages);
    return bar;
  }

  function _buildHeader() {
    const editable = _activeTab === 'home' || _activeTab === 'pages';
    const header = el('div', 'm2-header' + (editable ? ' m2-header--editable' : ''));
    const left = el('div', 'm2-header__left');
    left.appendChild(txt('span', 'm2-header__title', _site.titre_site || SITE_NAME));
    header.appendChild(left);
    HomeView.applyHeaderStyle(header, _site.home.headerStyle);
    if (editable) {
      header.title = 'Cliquer pour modifier le style du header';
      header.addEventListener('click', () => _openHeaderStylePopup(header));
    }
    return header;
  }

  function _buildBar() {
    const bar = el('div', 'ed-bar');
    bar.id = 'ed-fixed-bar';
    const s = el('button', 'ed-btn ed-btn--save');
    s.type = 'button'; s.textContent = 'Enregistrer'; s.addEventListener('click', _save);
    const c = el('button', 'ed-btn ed-btn--cancel');
    c.type = 'button'; c.textContent = 'Annuler';
    c.addEventListener('click', () => { _removeBar(); _removeAlignBar(); _onDone(null); });
    bar.appendChild(s); bar.appendChild(c);
    return bar;
  }
  function _removeBar() {
    const b = document.getElementById('ed-fixed-bar');
    if (b) b.parentNode.removeChild(b);
  }
  function _removeAlignBar() {
    const b = document.getElementById('m2-align-bar');
    if (b) b.parentNode.removeChild(b);
  }

  async function _save() {
    const btn = document.getElementById('ed-fixed-bar').querySelector('.ed-btn--save');
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    try {
      const saved = await Api.saveSite(_site);
      _removeBar();
      _removeAlignBar();
      _onDone(saved.data);
    } catch (e) {
      alert('Erreur lors de la sauvegarde :\n' + e.message);
      btn.disabled = false; btn.textContent = 'Enregistrer';
    }
  }

  // ── Liste des pages de niveau 1 (pour le sélecteur de lien) ─────────────
  // La racine de l'arbre est le niveau 0 : seuls ses enfants directs
  // (niveau 1) sont proposés comme cible de lien depuis la page d'accueil.

  function _flatten(chapitres) {
    return (chapitres || []).map(node => ({
      path: node.keyword,
      label: node.label || node.keyword || '(sans nom)',
    }));
  }

  // ── Onglet Page d'accueil ────────────────────────────────────────────────
  // Rendu du canevas strictement identique à la lecture (HomeView.render) :
  // seul le comportement change (glisser-déposer + popup au lieu de la
  // navigation). Pas de barre latérale : un bouton flottant pour ajouter une
  // image, une popup pour éditer celle sur laquelle on clique.

  function _buildHomeEditor(pageEl) {
    const images = _site.home.images;
    const flatNodes = _flatten(_site.chapitres);
    const wrap = el('div', 'm2-home m2-home--editable');
    // Le fond est appliqué sur `pageEl` (voir _render), pas ici, pour qu'il
    // continue derrière le header. Clic sur le fond (en dehors de toute
    // vignette) : ouvre l'édition du style de fond. Le canevas est un enfant
    // de `wrap` mais ne couvre pas toujours toute la zone visible (marges,
    // zone vide sous les images) ; écouter sur `wrap` et vérifier la cible
    // couvre les deux cas.
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.classList.contains('m2-home__canvas')) {
        _openBackgroundPopup(pageEl, _site.home.background);
      }
    });

    // Sélection multiple (Ctrl+clic) : Set d'images + Map image→vignette DOM
    // (pour le glissé groupé et l'alignement). Persistent tant que l'onglet
    // Page d'accueil reste monté ; réinitialisé à chaque refresh() sur les
    // images qui existent encore.
    const selection = new Set();
    const thumbMap = new Map();
    let alignBar = null;

    function refresh() {
      for (const img of [...selection]) {
        if (images.indexOf(img) === -1) selection.delete(img);
      }
      wrap.innerHTML = '';
      thumbMap.clear();

      const canvas = el('div', 'm2-home__canvas');
      canvas.addEventListener('mousedown', e => {
        if (e.target === canvas && selection.size > 0) { selection.clear(); refresh(); }
      });

      if (images.length === 0) {
        canvas.appendChild(txt('div', 'm2-home__empty', 'Aucune image sur la page d\'accueil. Clique sur "Ajouter une image" pour en ajouter une.'));
      } else {
        images.forEach(img => {
          const thumb = HomeView.buildThumb(img, {
            editable: true,
            selectedSet: selection,
            onClick: (im, th) => {
              // Un clic simple sélectionne aussi l'image (comme Ctrl+clic,
              // mais en remplaçant plutôt qu'en ajoutant à la sélection), en
              // plus d'ouvrir sa popup d'édition.
              // Ne pas rafraîchir tout le canevas ici : la popup garde une
              // référence directe à `th` pour ses mises à jour en direct, un
              // refresh() la détacherait du DOM. On met juste à jour
              // l'affichage de la sélection à la main.
              selection.clear();
              selection.add(im);
              thumbMap.forEach(t => t.classList.remove('m2-thumb--multiselected'));
              th.classList.add('m2-thumb--multiselected');
              _removeAlignBar();
              _openImagePopup(im, th, flatNodes, () => {
                images.splice(images.indexOf(im), 1);
                refresh();
              });
            },
            onToggleSelect: (im) => {
              if (selection.has(im)) selection.delete(im); else selection.add(im);
              refresh();
            },
            getSelectionGroup: (im) => {
              if (selection.size > 1 && selection.has(im)) {
                return [...selection].map(i => ({ img: i, thumb: thumbMap.get(i) }));
              }
              return [{ img: im, thumb: thumbMap.get(im) }];
            },
          });
          thumbMap.set(img, thumb);
          canvas.appendChild(thumb);
        });
      }
      wrap.appendChild(canvas);

      const addBtn = txt('button', 'm2-home-add-btn', '+ Ajouter une image');
      addBtn.type = 'button'; addBtn.title = 'Ajouter une image';
      addBtn.addEventListener('click', () => {
        FileBrowser.open(path => {
          images.push({ id: uid('img_'), image: path, x: 100, y: 100, texte: '', lien: null });
          refresh();
        });
      });
      wrap.appendChild(addBtn);

      if (alignBar) { alignBar.remove(); alignBar = null; }
      if (selection.size > 1) {
        alignBar = _buildAlignBar(selection, thumbMap, refresh);
        document.body.appendChild(alignBar);
      }
    }

    refresh();
    return wrap;
  }

  function _buildAlignBar(selection, thumbMap, refresh) {
    const bar = el('div', 'm2-align-bar');
    bar.id = 'm2-align-bar';
    bar.appendChild(txt('span', 'm2-align-count', selection.size + ' images sélectionnées'));
    bar.appendChild(txt('span', 'm2-align-label', 'Aligner :'));

    function alignBtn(label, title, mode) {
      const btn = txt('button', 'm2-align-btn', label);
      btn.type = 'button'; btn.title = title;
      btn.addEventListener('click', () => { _alignSelection(selection, thumbMap, mode); refresh(); });
      return btn;
    }

    const hGroup = el('div', 'm2-align-group');
    hGroup.appendChild(alignBtn('Gauche', 'Aligner à gauche', 'left'));
    hGroup.appendChild(alignBtn('Centre', 'Centrer horizontalement', 'hcenter'));
    hGroup.appendChild(alignBtn('Droite', 'Aligner à droite', 'right'));
    bar.appendChild(hGroup);

    const vGroup = el('div', 'm2-align-group');
    vGroup.appendChild(alignBtn('Haut', 'Aligner en haut', 'top'));
    vGroup.appendChild(alignBtn('Milieu', 'Centrer verticalement', 'vcenter'));
    vGroup.appendChild(alignBtn('Bas', 'Aligner en bas', 'bottom'));
    bar.appendChild(vGroup);

    return bar;
  }

  /** Aligne les images sélectionnées sur un même bord/centre (horizontal ou vertical). */
  function _alignSelection(selection, thumbMap, mode) {
    const items = [...selection].map(img => {
      const thumb = thumbMap.get(img);
      const imEl = thumb ? thumb.querySelector('img') : null;
      return { img, w: (imEl && imEl.offsetWidth) || 140, h: (imEl && imEl.offsetHeight) || 140 };
    });
    if (items.length < 2) return;

    switch (mode) {
      case 'left': {
        const v = Math.min(...items.map(it => it.img.x - it.w / 2));
        items.forEach(it => { it.img.x = Math.max(-CANVAS_ORIGIN_X, v + it.w / 2); });
        break;
      }
      case 'right': {
        const v = Math.max(...items.map(it => it.img.x + it.w / 2));
        items.forEach(it => { it.img.x = Math.max(-CANVAS_ORIGIN_X, v - it.w / 2); });
        break;
      }
      case 'hcenter': {
        const v = items.reduce((s, it) => s + it.img.x, 0) / items.length;
        items.forEach(it => { it.img.x = Math.max(-CANVAS_ORIGIN_X, v); });
        break;
      }
      case 'top': {
        const v = Math.min(...items.map(it => it.img.y - it.h / 2));
        items.forEach(it => { it.img.y = Math.max(-CANVAS_ORIGIN_Y, v + it.h / 2); });
        break;
      }
      case 'bottom': {
        const v = Math.max(...items.map(it => it.img.y + it.h / 2));
        items.forEach(it => { it.img.y = Math.max(-CANVAS_ORIGIN_Y, v - it.h / 2); });
        break;
      }
      case 'vcenter': {
        const v = items.reduce((s, it) => s + it.img.y, 0) / items.length;
        items.forEach(it => { it.img.y = Math.max(-CANVAS_ORIGIN_Y, v); });
        break;
      }
    }
  }

  function _openImagePopup(img, thumb, flatNodes, onDelete) {
    // Instantané des champs modifiables ici, pour pouvoir les restaurer si
    // l'utilisateur ferme sans valider (croix ou clic hors de la popup).
    const original = { image: img.image, texte: img.texte, lien: img.lien, x: img.x, y: img.y };

    // Popup flottante, positionnée près de la vignette : pas d'overlay plein
    // écran, le reste du canevas reste visible et manipulable pendant l'édition.
    const popup = el('div', 'ed-popup ed-popup--floating');

    const closeX = el('button', 'ed-popup__close');
    closeX.type = 'button'; closeX.title = 'Fermer sans enregistrer'; closeX.textContent = '✕';
    closeX.addEventListener('click', () => _cancelAndClose());
    popup.appendChild(closeX);

    function _close() {
      document.body.removeChild(popup);
      document.removeEventListener('mousedown', _onOutsideClick, true);
    }
    function _cancelAndClose() {
      Object.assign(img, original);
      HomeView.updateThumb(thumb, img);
      thumb.style.left = (img.x + CANVAS_ORIGIN_X) + 'px';
      thumb.style.top = (img.y + CANVAS_ORIGIN_Y) + 'px';
      _close();
    }
    function _onOutsideClick(e) {
      if (popup.contains(e.target)) return;
      // L'explorateur de documents (ouvert depuis la popup, ex : changer
      // l'image) est un modal séparé au-dessus : ne pas fermer la popup
      // quand on interagit avec.
      if (e.target.closest && e.target.closest('.imgbr-overlay')) return;
      _cancelAndClose();
    }

    const preview = el('div', 'ed-img-block__img');
    const texteInp = document.createElement('input');
    texteInp.type = 'text'; texteInp.className = 'ed-popup__title-input'; texteInp.placeholder = 'Titre / texte affiché';
    texteInp.value = img.texte || '';
    texteInp.addEventListener('input', () => {
      img.texte = texteInp.value || null;
      HomeView.updateThumb(thumb, img);
    });
    popup.appendChild(texteInp);

    preview.style.cursor = 'pointer';
    preview.title = 'Cliquer pour changer l\'image';
    function refreshPreview() {
      preview.innerHTML = '';
      const im = document.createElement('img');
      im.src = 'documents/' + img.image;
      preview.appendChild(im);
    }
    refreshPreview();
    preview.addEventListener('click', () => {
      FileBrowser.open(path => {
        img.image = path;
        refreshPreview();
        HomeView.updateThumb(thumb, img);
      });
    });
    popup.appendChild(preview);

    const lienField = el('div', 'ed-field');
    lienField.appendChild(txt('label', 'ed-label', 'Lien vers'));
    const lienSel = document.createElement('select');
    lienSel.className = 'ed-input';
    const optNone = document.createElement('option');
    optNone.value = ''; optNone.textContent = '(aucun lien)';
    lienSel.appendChild(optNone);
    flatNodes.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n.path; opt.textContent = n.label;
      if (img.lien === n.path) opt.selected = true;
      lienSel.appendChild(opt);
    });
    lienSel.addEventListener('change', () => { img.lien = lienSel.value || null; });
    lienField.appendChild(lienSel);
    popup.appendChild(lienField);

    const posRow = el('div', '');
    posRow.style.cssText = 'display:flex;gap:10px;';
    const xField = el('div', 'ed-field'); xField.style.flex = '1';
    xField.appendChild(txt('label', 'ed-label', 'x'));
    const xInp = document.createElement('input');
    xInp.type = 'number'; xInp.className = 'ed-input'; xInp.value = img.x;
    xInp.addEventListener('input', () => {
      img.x = Math.max(-CANVAS_ORIGIN_X, +xInp.value || 0);
      thumb.style.left = (img.x + CANVAS_ORIGIN_X) + 'px';
    });
    xField.appendChild(xInp);
    const yField = el('div', 'ed-field'); yField.style.flex = '1';
    yField.appendChild(txt('label', 'ed-label', 'y'));
    const yInp = document.createElement('input');
    yInp.type = 'number'; yInp.className = 'ed-input'; yInp.value = img.y;
    yInp.addEventListener('input', () => {
      img.y = Math.max(-CANVAS_ORIGIN_Y, +yInp.value || 0);
      thumb.style.top = (img.y + CANVAS_ORIGIN_Y) + 'px';
    });
    yField.appendChild(yInp);
    posRow.appendChild(xField);
    posRow.appendChild(yField);
    popup.appendChild(posRow);

    const btnRow = el('div', 'ed-popup__btns');
    btnRow.style.justifyContent = 'space-between';
    const delBtn = el('button', 'ed-btn');
    delBtn.style.cssText = 'background:#dc2626;color:#fff;';
    delBtn.type = 'button'; delBtn.textContent = 'Supprimer cette image';
    delBtn.addEventListener('click', () => {
      if (confirm('Supprimer cette image de la page d\'accueil ?')) {
        _close();
        onDelete();
      }
    });
    const closeBtn = el('button', 'ed-btn ed-btn--save');
    closeBtn.type = 'button'; closeBtn.textContent = 'OK';
    closeBtn.addEventListener('click', () => _close());
    btnRow.appendChild(delBtn);
    btnRow.appendChild(closeBtn);
    popup.appendChild(btnRow);

    document.body.appendChild(popup);
    _positionFloatingPopup(popup, thumb);
    // Capture plutôt que bubbling : ferme même si un clic ailleurs appelle
    // stopPropagation() (ex : sur une autre vignette).
    document.addEventListener('mousedown', _onOutsideClick, true);
  }

  /** Place la popup près de la vignette, en la gardant dans la fenêtre visible. */
  function _positionFloatingPopup(popup, thumb) {
    const rect = thumb.getBoundingClientRect();
    const popRect = popup.getBoundingClientRect();
    const margin = 12;

    let left = rect.right + 14;
    if (left + popRect.width > window.innerWidth - margin) {
      left = rect.left - popRect.width - 14;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - popRect.width - margin));

    let top = rect.top;
    top = Math.max(margin, Math.min(top, window.innerHeight - popRect.height - margin));

    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  }

  const HEADER_FONT_CHOICES = [
    ['', 'Police par défaut'],
    ['Georgia, serif', 'Georgia'],
    ['"Times New Roman", serif', 'Times New Roman'],
    ['"Courier New", monospace', 'Courier New'],
    ['"Trebuchet MS", sans-serif', 'Trebuchet MS'],
    ['Verdana, sans-serif', 'Verdana'],
    ['"Segoe UI", sans-serif', 'Segoe UI'],
  ];

  function _normalizeHex8(hex) {
    if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) return hex + 'ff';
    if (typeof hex === 'string' && /^#[0-9a-fA-F]{8}$/.test(hex)) return hex;
    return '#000000ff';
  }
  function _pctToHex2(pct) {
    return Math.max(0, Math.min(255, Math.round(pct / 100 * 255))).toString(16).padStart(2, '0');
  }

  /** Champ couleur + curseur de transparence, combinés en une valeur
   *  #rrggbbaa. Le <input type=color> natif ne gère pas l'alpha : on le
   *  pilote séparément via un curseur et on recompose la chaîne à chaque
   *  changement. */
  function _buildColorAlphaField(labelText, getValue, onChange) {
    const wrap = el('div', 'ed-field');
    wrap.appendChild(txt('label', 'ed-label', labelText));
    const row = el('div', 'ed-color-alpha-row');

    const hex8 = _normalizeHex8(getValue());
    const colorInp = document.createElement('input');
    colorInp.type = 'color'; colorInp.className = 'ed-input ed-input--color';
    colorInp.value = hex8.slice(0, 7);

    const alphaInp = document.createElement('input');
    alphaInp.type = 'range'; alphaInp.min = '0'; alphaInp.max = '100'; alphaInp.className = 'ed-alpha-range';
    alphaInp.value = String(Math.round(parseInt(hex8.slice(7, 9), 16) / 255 * 100));

    const alphaVal = txt('span', 'ed-alpha-val', alphaInp.value + '%');

    function emit() {
      alphaVal.textContent = alphaInp.value + '%';
      onChange(colorInp.value + _pctToHex2(+alphaInp.value));
    }
    colorInp.addEventListener('input', emit);
    alphaInp.addEventListener('input', emit);

    row.appendChild(colorInp);
    row.appendChild(alphaInp);
    row.appendChild(alphaVal);
    wrap.appendChild(row);
    return wrap;
  }

  /** Popup (modale) d'édition du style du header : fond, couleur/taille/police/
   *  alignement du titre. Modifie `_site.home.headerStyle` en direct pour un
   *  aperçu immédiat sur `headerEl`, avec possibilité d'annuler. */
  function _openHeaderStylePopup(headerEl) {
    const style = _site.home.headerStyle;
    const original = clone(style);

    const overlay = el('div', 'ed-popup-overlay');
    const popup = el('div', 'ed-popup');
    popup.appendChild(txt('div', 'ed-popup__title', 'Style du header'));

    function field(labelText, inputEl) {
      const f = el('div', 'ed-field');
      f.appendChild(txt('label', 'ed-label', labelText));
      f.appendChild(inputEl);
      popup.appendChild(f);
    }

    popup.appendChild(_buildColorAlphaField('Couleur de fond', () => style.bg, v => {
      style.bg = v; HomeView.applyHeaderStyle(headerEl, style);
    }));
    popup.appendChild(_buildColorAlphaField('Couleur du titre', () => style.titleColor, v => {
      style.titleColor = v; HomeView.applyHeaderStyle(headerEl, style);
    }));

    const sizeInp = document.createElement('input');
    sizeInp.type = 'number'; sizeInp.className = 'ed-input'; sizeInp.min = '10'; sizeInp.max = '60';
    sizeInp.value = style.titleSize;
    sizeInp.addEventListener('input', () => { style.titleSize = (+sizeInp.value) || 18; HomeView.applyHeaderStyle(headerEl, style); });
    field('Taille du titre (px)', sizeInp);

    const fontSel = document.createElement('select');
    fontSel.className = 'ed-input';
    HEADER_FONT_CHOICES.forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value; opt.textContent = label;
      if (style.titleFont === value) opt.selected = true;
      fontSel.appendChild(opt);
    });
    fontSel.addEventListener('change', () => { style.titleFont = fontSel.value; HomeView.applyHeaderStyle(headerEl, style); });
    field('Police du titre', fontSel);

    const fontFileField = el('div', 'ed-field');
    fontFileField.appendChild(txt('label', 'ed-label', 'Ou police personnalisée (dossier style/)'));
    const fontFileRow = el('div', 'ed-font-file-row');
    const fontFileLabel = txt('span', 'ed-font-file-label', '');
    function refreshFontFileLabel() {
      fontFileLabel.textContent = style.titleFontFile || 'Aucune — police ci-dessus utilisée';
    }
    refreshFontFileLabel();
    const fontFileBtn = txt('button', 'ed-add-btn', 'Choisir…');
    fontFileBtn.type = 'button';
    fontFileBtn.addEventListener('click', () => {
      FileBrowser.open(path => {
        style.titleFontFile = path;
        refreshFontFileLabel();
        HomeView.applyHeaderStyle(headerEl, style);
      }, { root: 'style', rootLabel: 'style', type: 'font' });
    });
    const fontFileClearBtn = txt('button', 'ed-btn ed-btn--cancel', 'Retirer');
    fontFileClearBtn.type = 'button';
    fontFileClearBtn.addEventListener('click', () => {
      style.titleFontFile = null;
      refreshFontFileLabel();
      HomeView.applyHeaderStyle(headerEl, style);
    });
    fontFileRow.appendChild(fontFileBtn);
    fontFileRow.appendChild(fontFileClearBtn);
    fontFileRow.appendChild(fontFileLabel);
    fontFileField.appendChild(fontFileRow);
    popup.appendChild(fontFileField);

    const alignSel = document.createElement('select');
    alignSel.className = 'ed-input';
    [['left', 'Gauche'], ['center', 'Centre'], ['right', 'Droite']].forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value; opt.textContent = label;
      if (style.titleAlign === value) opt.selected = true;
      alignSel.appendChild(opt);
    });
    alignSel.addEventListener('change', () => { style.titleAlign = alignSel.value; HomeView.applyHeaderStyle(headerEl, style); });
    field('Alignement du titre', alignSel);

    const btnRow = el('div', 'ed-popup__btns');
    const okBtn = el('button', 'ed-btn ed-btn--save');
    okBtn.type = 'button'; okBtn.textContent = 'OK';
    okBtn.addEventListener('click', () => document.body.removeChild(overlay));
    const cancelBtn = el('button', 'ed-btn ed-btn--cancel');
    cancelBtn.type = 'button'; cancelBtn.textContent = 'Annuler';
    cancelBtn.addEventListener('click', () => {
      Object.assign(style, original);
      HomeView.applyHeaderStyle(headerEl, style);
      document.body.removeChild(overlay);
    });
    btnRow.appendChild(okBtn); btnRow.appendChild(cancelBtn);
    popup.appendChild(btnRow);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
  }

  /** Popup (modale) d'édition d'un fond (couleur, image optionnelle via
   *  l'explorateur de documents, mode d'affichage). `bg` est l'objet à muter
   *  directement (`_site.home.background` ou `_site.pagesStyle.background`),
   *  `wrapEl` l'élément sur lequel prévisualiser en direct. */
  function _openBackgroundPopup(wrapEl, bg, popupTitle) {
    const original = clone(bg);

    const overlay = el('div', 'ed-popup-overlay');
    const popup = el('div', 'ed-popup');
    popup.appendChild(txt('div', 'ed-popup__title', popupTitle || 'Style du fond de la page d\'accueil'));

    popup.appendChild(_buildColorAlphaField('Couleur de fond', () => bg.color, v => {
      bg.color = v; HomeView.applyBackgroundStyle(wrapEl, bg);
    }));

    const imgField = el('div', 'ed-field');
    imgField.appendChild(txt('label', 'ed-label', 'Image de fond (optionnelle, dossier style/)'));
    const preview = el('div', 'ed-img-block__img');
    preview.style.cursor = 'pointer';
    preview.title = 'Cliquer pour choisir une image';
    function refreshPreview() {
      preview.innerHTML = '';
      if (bg.image) {
        const im = document.createElement('img');
        im.src = 'style/' + bg.image;
        preview.appendChild(im);
      } else {
        preview.appendChild(txt('span', 'ed-img-placeholder', 'Aucune image — cliquer pour en choisir une'));
      }
    }
    refreshPreview();
    preview.addEventListener('click', () => {
      FileBrowser.open(path => {
        bg.image = path;
        refreshPreview();
        HomeView.applyBackgroundStyle(wrapEl, bg);
      }, { root: 'style', rootLabel: 'style', type: 'image' });
    });
    imgField.appendChild(preview);

    const clearBtn = txt('button', 'ed-btn ed-btn--cancel', 'Retirer l\'image');
    clearBtn.type = 'button'; clearBtn.style.marginTop = '4px';
    clearBtn.addEventListener('click', () => {
      bg.image = null;
      refreshPreview();
      HomeView.applyBackgroundStyle(wrapEl, bg);
    });
    imgField.appendChild(clearBtn);
    popup.appendChild(imgField);

    const modeSel = document.createElement('select');
    modeSel.className = 'ed-input';
    [
      ['cover', 'Couvrir (recadrée)'],
      ['contain', 'Contenir (entière, non recadrée)'],
      ['repeat', 'Répéter en mosaïque'],
    ].forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value; opt.textContent = label;
      if (bg.mode === value) opt.selected = true;
      modeSel.appendChild(opt);
    });
    modeSel.addEventListener('change', () => { bg.mode = modeSel.value; HomeView.applyBackgroundStyle(wrapEl, bg); });
    const modeField = el('div', 'ed-field');
    modeField.appendChild(txt('label', 'ed-label', 'Affichage de l\'image'));
    modeField.appendChild(modeSel);
    popup.appendChild(modeField);

    const btnRow = el('div', 'ed-popup__btns');
    const okBtn = el('button', 'ed-btn ed-btn--save');
    okBtn.type = 'button'; okBtn.textContent = 'OK';
    okBtn.addEventListener('click', () => document.body.removeChild(overlay));
    const cancelBtn = el('button', 'ed-btn ed-btn--cancel');
    cancelBtn.type = 'button'; cancelBtn.textContent = 'Annuler';
    cancelBtn.addEventListener('click', () => {
      Object.assign(bg, original);
      HomeView.applyBackgroundStyle(wrapEl, bg);
      document.body.removeChild(overlay);
    });
    btnRow.appendChild(okBtn); btnRow.appendChild(cancelBtn);
    popup.appendChild(btnRow);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
  }

  // ── Onglet Style des pages ───────────────────────────────────────────────
  // Header + fond des pages : mêmes popups que la page d'accueil, sur
  // `_site.pagesStyle.background` (voir _render). Sections/blocs TEXTE/images :
  // aperçus cliquables, un objet {bg, textColor} chacun pour les deux
  // premiers, {borderColor, borderWidth, borderRadius} pour les images.

  function _buildPagesStyleEditor() {
    const wrap = el('div', 'ed-style-grid');

    const secCard = el('div', 'ed-style-card');
    secCard.appendChild(txt('div', 'ed-style-card__label', 'Titre de section'));
    const secPreview = txt('div', 'm2-section__titre ed-style-card__preview', 'Titre de section');
    secPreview.title = 'Cliquer pour modifier';
    ContentView.applySectionStyle(secPreview, _site.pagesStyle.section);
    secPreview.addEventListener('click', () => {
      _openColorTextPopup('Style des titres de section', _site.pagesStyle.section, ContentView.applySectionStyle, secPreview);
    });
    secCard.appendChild(secPreview);
    wrap.appendChild(secCard);

    const txtCard = el('div', 'ed-style-card');
    txtCard.appendChild(txt('div', 'ed-style-card__label', 'Bloc TEXTE'));
    const txtPreview = txt('div', 'm2-bloc-texte ed-style-card__preview', 'Exemple de texte');
    txtPreview.title = 'Cliquer pour modifier';
    ContentView.applyBlocTexteStyle(txtPreview, _site.pagesStyle.blocTexte);
    txtPreview.addEventListener('click', () => {
      _openColorTextPopup('Style des blocs TEXTE', _site.pagesStyle.blocTexte, ContentView.applyBlocTexteStyle, txtPreview);
    });
    txtCard.appendChild(txtPreview);
    wrap.appendChild(txtCard);

    const imgCard = el('div', 'ed-style-card');
    imgCard.appendChild(txt('div', 'ed-style-card__label', 'Bordure des images'));
    const imgPreview = el('div', 'ed-style-card__preview ed-style-card__preview--image');
    imgPreview.title = 'Cliquer pour modifier';
    ContentView.applyImageStyle(imgPreview, _site.pagesStyle.image);
    imgPreview.addEventListener('click', () => _openImageStylePopup(imgPreview));
    imgCard.appendChild(imgPreview);
    wrap.appendChild(imgCard);

    return wrap;
  }

  /** Popup générique fond/texte (sections, blocs TEXTE) : deux champs
   *  couleur+alpha, appliqués en direct via `applyFn(previewEl, styleObj)`. */
  function _openColorTextPopup(title, styleObj, applyFn, previewEl) {
    const original = clone(styleObj);

    const overlay = el('div', 'ed-popup-overlay');
    const popup = el('div', 'ed-popup');
    popup.appendChild(txt('div', 'ed-popup__title', title));

    popup.appendChild(_buildColorAlphaField('Couleur de fond', () => styleObj.bg, v => {
      styleObj.bg = v; applyFn(previewEl, styleObj);
    }));
    popup.appendChild(_buildColorAlphaField('Couleur du texte', () => styleObj.textColor, v => {
      styleObj.textColor = v; applyFn(previewEl, styleObj);
    }));

    const btnRow = el('div', 'ed-popup__btns');
    const okBtn = el('button', 'ed-btn ed-btn--save');
    okBtn.type = 'button'; okBtn.textContent = 'OK';
    okBtn.addEventListener('click', () => document.body.removeChild(overlay));
    const cancelBtn = el('button', 'ed-btn ed-btn--cancel');
    cancelBtn.type = 'button'; cancelBtn.textContent = 'Annuler';
    cancelBtn.addEventListener('click', () => {
      Object.assign(styleObj, original);
      applyFn(previewEl, styleObj);
      document.body.removeChild(overlay);
    });
    btnRow.appendChild(okBtn); btnRow.appendChild(cancelBtn);
    popup.appendChild(btnRow);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
  }

  /** Popup de bordure des images : couleur+alpha, épaisseur, arrondi (px). */
  function _openImageStylePopup(previewEl) {
    const style = _site.pagesStyle.image;
    const original = clone(style);

    const overlay = el('div', 'ed-popup-overlay');
    const popup = el('div', 'ed-popup');
    popup.appendChild(txt('div', 'ed-popup__title', 'Bordure des images'));

    popup.appendChild(_buildColorAlphaField('Couleur de la bordure', () => style.borderColor, v => {
      style.borderColor = v; ContentView.applyImageStyle(previewEl, style);
    }));

    function numberField(labelText, value, min, max) {
      const f = el('div', 'ed-field');
      f.appendChild(txt('label', 'ed-label', labelText));
      const inp = document.createElement('input');
      inp.type = 'number'; inp.className = 'ed-input'; inp.min = String(min); inp.max = String(max);
      inp.value = value;
      f.appendChild(inp);
      popup.appendChild(f);
      return inp;
    }
    const widthInp = numberField('Épaisseur (px)', style.borderWidth, 0, 20);
    widthInp.addEventListener('input', () => {
      style.borderWidth = (+widthInp.value) || 0;
      ContentView.applyImageStyle(previewEl, style);
    });
    const radiusInp = numberField('Arrondi (px)', style.borderRadius, 0, 200);
    radiusInp.addEventListener('input', () => {
      style.borderRadius = (+radiusInp.value) || 0;
      ContentView.applyImageStyle(previewEl, style);
    });

    const btnRow = el('div', 'ed-popup__btns');
    const okBtn = el('button', 'ed-btn ed-btn--save');
    okBtn.type = 'button'; okBtn.textContent = 'OK';
    okBtn.addEventListener('click', () => document.body.removeChild(overlay));
    const cancelBtn = el('button', 'ed-btn ed-btn--cancel');
    cancelBtn.type = 'button'; cancelBtn.textContent = 'Annuler';
    cancelBtn.addEventListener('click', () => {
      Object.assign(style, original);
      ContentView.applyImageStyle(previewEl, style);
      document.body.removeChild(overlay);
    });
    btnRow.appendChild(okBtn); btnRow.appendChild(cancelBtn);
    popup.appendChild(btnRow);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
  }

  // ── Onglet Arborescence ──────────────────────────────────────────────────

  function _setCollapsedAll(chapitres, value) {
    (chapitres || []).forEach(node => {
      if (node.chapitres && node.chapitres.length) {
        node.collapsed = value;
        _setCollapsedAll(node.chapitres, value);
      }
    });
  }

  /** true si `target` est `root` lui-même ou se trouve dans son sous-arbre. */
  function _nodeContains(root, target) {
    if (root === target) return true;
    return (root.chapitres || []).some(c => _nodeContains(c, target));
  }

  function _buildTreeEditor() {
    const container = el('div', '');

    const titleField = el('div', 'ed-field ed-site-title-field');
    titleField.appendChild(txt('label', 'ed-label', 'Titre du site'));
    const titleInp = document.createElement('input');
    titleInp.type = 'text'; titleInp.className = 'ed-input';
    titleInp.placeholder = SITE_NAME;
    titleInp.value = _site.titre_site || '';
    titleInp.addEventListener('input', () => {
      _site.titre_site = titleInp.value;
      const titleSpan = _container.querySelector('.m2-header__title');
      if (titleSpan) titleSpan.textContent = _site.titre_site || SITE_NAME;
    });
    titleField.appendChild(titleInp);
    container.appendChild(titleField);

    const toolbar = el('div', 'ed-map-toolbar');
    const expandBtn = el('button', 'ed-add-btn');
    expandBtn.type = 'button'; expandBtn.textContent = 'Tout déplier';
    const collapseBtn = el('button', 'ed-add-btn');
    collapseBtn.type = 'button'; collapseBtn.textContent = 'Tout replier';
    const addRootBtn = el('button', 'ed-add-btn');
    addRootBtn.type = 'button'; addRootBtn.textContent = '+ Ajouter une page racine';
    toolbar.appendChild(expandBtn);
    toolbar.appendChild(collapseBtn);
    toolbar.appendChild(addRootBtn);
    container.appendChild(toolbar);

    const wrap = el('div', 'ed-map-list');
    container.appendChild(wrap);

    function refresh() {
      wrap.innerHTML = '';
      _site.chapitres.forEach((node, i) => _renderNode(wrap, node, _site.chapitres, 0, i, refresh, null));
    }
    expandBtn.addEventListener('click', () => { _setCollapsedAll(_site.chapitres, false); refresh(); });
    collapseBtn.addEventListener('click', () => { _setCollapsedAll(_site.chapitres, true); refresh(); });
    addRootBtn.addEventListener('click', () => { _site.chapitres.push({ keyword: 'nouveau', label: 'Nouveau', chapitres: [], sections: [] }); refresh(); });
    refresh();
    return container;
  }

  // Nœud en cours de glissement : {node, siblings, parentNode}. parentNode
  // est null pour un nœud racine. Le drop est autorisé n'importe où dans
  // l'arbre (sauf sur soi-même ou l'un de ses propres descendants).
  let _dragNode = null;

  function _renderNode(wrap, node, siblings, indent, index, refresh, parentNode) {
    if (node.collapsed === undefined) node.collapsed = true;
    const hasChildren = node.chapitres && node.chapitres.length > 0;
    const line = el('div', 'ed-map-line ' + (hasChildren ? 'ed-map-line--menu' : 'ed-map-line--leaf'));
    line.style.marginLeft = (indent * 24) + 'px';
    line.draggable = true;

    const handle = txt('span', 'ed-map-handle', '⠿');
    handle.title = 'Glisser pour réordonner';
    line.appendChild(handle);

    if (hasChildren) {
      const collapse = el('button', 'ed-map-collapse');
      collapse.type = 'button'; collapse.textContent = node.collapsed ? '+' : '−';
      collapse.addEventListener('click', () => { node.collapsed = !node.collapsed; refresh(); });
      line.appendChild(collapse);
    } else {
      line.appendChild(el('span', 'ed-map-spacer'));
    }

    const labelInp = document.createElement('input');
    labelInp.type = 'text'; labelInp.className = 'ed-map-label';
    labelInp.placeholder = 'Libellé'; labelInp.value = node.label || '';
    labelInp.addEventListener('input', () => { node.label = labelInp.value; });
    _preventDragWhileEditing(line, labelInp);
    line.appendChild(labelInp);

    const keywordInp = document.createElement('input');
    keywordInp.type = 'text'; keywordInp.className = 'ed-map-keyword';
    keywordInp.placeholder = 'keyword-url'; keywordInp.value = node.keyword || '';
    keywordInp.addEventListener('input', () => {
      node.keyword = keywordInp.value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    });
    keywordInp.addEventListener('blur', () => { keywordInp.value = node.keyword; });
    _preventDragWhileEditing(line, keywordInp);
    line.appendChild(keywordInp);

    if (!hasChildren) {
      line.appendChild(txt('span', 'ed-label', node.sections && node.sections.length ? node.sections.length + ' section(s)' : 'page vide'));
    }

    const acts = el('div', 'ed-map-actions');
    acts.appendChild(_ib2('+', 'Ajouter une page après', () => {
      siblings.splice(index + 1, 0, { keyword: 'nouveau', label: 'Nouveau', chapitres: [], sections: [] });
      refresh();
    }));
    if (!hasChildren) {
      acts.appendChild(_ib2('++', 'Ajouter une sous-page (transforme en menu)', () => {
        node.chapitres = [{ keyword: 'nouveau', label: 'Nouveau', chapitres: [], sections: [] }];
        delete node.sections;
        refresh();
      }));
    }
    acts.appendChild(_ib2('×', 'Supprimer', () => {
      if (confirm('Supprimer "' + (node.label || node.keyword) + '" et tout son contenu ?')) {
        siblings.splice(index, 1);
        refresh();
      }
    }, 'ed-icon-btn--del'));
    line.appendChild(acts);

    line.addEventListener('dragstart', e => {
      _dragNode = { node, siblings, parentNode };
      line.classList.add('ed-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    line.addEventListener('dragend', () => {
      line.classList.remove('ed-dragging');
      _dragNode = null;
    });

    function _dropZone(e) {
      const rect = line.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / line.offsetHeight;
      if (ratio < 0.25) return 'before';
      if (ratio > 0.75) return 'after';
      return 'into';
    }
    function _clearDropClasses() {
      line.classList.remove('ed-map-line--drop-before', 'ed-map-line--drop-after', 'ed-map-line--drop-into');
    }

    line.addEventListener('dragover', e => {
      if (!_dragNode || _dragNode.node === node || _nodeContains(_dragNode.node, node)) return;
      e.preventDefault();
      const zone = _dropZone(e);
      line.classList.toggle('ed-map-line--drop-before', zone === 'before');
      line.classList.toggle('ed-map-line--drop-after', zone === 'after');
      line.classList.toggle('ed-map-line--drop-into', zone === 'into');
    });
    line.addEventListener('dragleave', _clearDropClasses);
    line.addEventListener('drop', e => {
      e.preventDefault();
      _clearDropClasses();
      if (!_dragNode || _dragNode.node === node || _nodeContains(_dragNode.node, node)) return;

      const zone = _dropZone(e);
      if (zone === 'into' && !hasChildren && node.sections && node.sections.length &&
          !confirm('"' + (node.label || node.keyword) + '" contient déjà ' + node.sections.length +
                    ' section(s) de contenu, qui seront perdues en la transformant en sous-menu. Continuer ?')) {
        return;
      }

      const fromSiblings = _dragNode.siblings;
      const fromIdx = fromSiblings.indexOf(_dragNode.node);
      if (fromIdx === -1) return;
      fromSiblings.splice(fromIdx, 1);
      // Le parent d'origine, s'il n'a plus d'enfants, redevient une page feuille.
      if (_dragNode.parentNode && fromSiblings.length === 0) {
        _dragNode.parentNode.sections = _dragNode.parentNode.sections || [];
      }

      if (zone === 'into') {
        if (!node.chapitres) node.chapitres = [];
        node.chapitres.push(_dragNode.node);
        delete node.sections;
        node.collapsed = false;
      } else {
        let to = siblings.indexOf(node);
        if (zone === 'after') to += 1;
        siblings.splice(to, 0, _dragNode.node);
      }

      _dragNode = null;
      refresh();
    });

    wrap.appendChild(line);

    if (hasChildren && !node.collapsed) {
      node.chapitres.forEach((child, ci) => _renderNode(wrap, child, node.chapitres, indent + 1, ci, refresh, node));
    }
  }

  function _ib2(label, title, onClick, extraClass) {
    const btn = el('button', extraClass || '');
    btn.type = 'button'; btn.title = title; btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  /** Désactive le drag de la ligne pendant qu'on sélectionne du texte dans un champ. */
  function _preventDragWhileEditing(line, field) {
    field.addEventListener('mousedown', () => {
      line.draggable = false;
      const restore = () => { line.draggable = true; window.removeEventListener('mouseup', restore); };
      window.addEventListener('mouseup', restore);
    });
  }

  return { open };
})();
