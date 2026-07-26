'use strict';

// ── Contenu d'une page feuille : sections > colonnes > blocs ───────────────
// Lecture (renderSections) et édition (buildSectionsEditor) d'un tableau
// `sections`, porté du modèle documents/contenu de famille2 (voir
// famille2/src/ui/js/{components,editor}.js) en renommant :
//   documents → sections, contenu → colonnes, IMAGE → DOCUMENTS,
//   block.fichier (texte) → block.html

const ContentView = (function () {

  const DEFAULT_SECTION_STYLE = { bg: '#d0e4ff', textColor: '#1e293b' };
  const DEFAULT_BLOC_TEXTE_STYLE = { bg: '#e3f8ff', textColor: '#1e293b' };
  const DEFAULT_IMAGE_STYLE = { borderColor: '#333333', borderWidth: 1, borderRadius: 0 };

  /** Fonctions d'application de style partagées entre le rendu réel (`render`)
   *  et les aperçus cliquables de l'onglet « Style des pages » (tree-editor.js),
   *  sur le même principe que HomeView.applyHeaderStyle/applyBackgroundStyle. */
  function applySectionStyle(el, style) {
    style = Object.assign({}, DEFAULT_SECTION_STYLE, style || {});
    el.style.background = style.bg;
    el.style.color = style.textColor;
  }
  function applyBlocTexteStyle(el, style) {
    style = Object.assign({}, DEFAULT_BLOC_TEXTE_STYLE, style || {});
    el.style.background = style.bg;
    el.style.color = style.textColor;
  }
  function applyImageStyle(imgEl, style) {
    style = Object.assign({}, DEFAULT_IMAGE_STYLE, style || {});
    imgEl.style.borderStyle = 'solid';
    imgEl.style.borderColor = style.borderColor;
    imgEl.style.borderWidth = style.borderWidth + 'px';
    imgEl.style.borderRadius = style.borderRadius + 'px';
  }

  function _lightboxEls() {
    let lb = document.getElementById('m2-lightbox');
    if (!lb) {
      lb = el('div', 'lightbox');
      lb.id = 'm2-lightbox';
      const img = document.createElement('img');
      img.className = 'lightbox__img'; img.id = 'm2-lightbox-img';
      const close = el('button', 'lightbox__close');
      close.type = 'button'; close.textContent = '✕';
      close.addEventListener('click', () => lb.classList.remove('lightbox--open'));
      lb.addEventListener('click', e => { if (e.target === lb) lb.classList.remove('lightbox--open'); });
      lb.appendChild(img);
      lb.appendChild(close);
      document.body.appendChild(lb);
    }
    return lb;
  }
  function openLightbox(src) {
    const lb = _lightboxEls();
    lb.querySelector('.lightbox__img').src = src;
    lb.classList.add('lightbox--open');
  }

  function render(sections, pagesStyle) {
    pagesStyle = pagesStyle || {};
    const frag = document.createDocumentFragment();
    (sections || []).forEach(section => {
      const card = el('div', 'm2-section');
      const hasTitre = section.titre && String(section.titre).trim();
      if (hasTitre) {
        const titreEl = txt('div', 'm2-section__titre', section.titre);
        applySectionStyle(titreEl, pagesStyle.section);
        card.appendChild(titreEl);
      }

      const cols = el('div', 'm2-section__cols');
      (section.colonnes || []).forEach(colBlocks => {
        const col = el('div', 'm2-section__col');
        (colBlocks || []).forEach(block => {
          if (block.type === 'DOCUMENTS') {
            const wrap = el('div', 'm2-bloc-image');
            const img = document.createElement('img');
            img.src = 'documents/' + block.fichier;
            img.alt = ''; img.loading = 'lazy';
            if (block.width && block.width !== 100) img.style.maxWidth = block.width + '%';
            applyImageStyle(img, pagesStyle.image);
            img.addEventListener('click', () => openLightbox(img.src));
            wrap.appendChild(img);
            col.appendChild(wrap);
          } else if (block.type === 'TEXTE') {
            const wrap = el('div', 'm2-bloc-texte');
            wrap.innerHTML = block.html || '';
            applyBlocTexteStyle(wrap, pagesStyle.blocTexte);
            if (block.align && block.align !== 'left') wrap.style.textAlign = block.align;
            if (block.width) wrap.style.width = block.width + '%';
            col.appendChild(wrap);
          } else if (block.type === 'HTML') {
            const wrap = el('div', 'm2-bloc-html');
            wrap.innerHTML = block.html || '';
            col.appendChild(wrap);
          }
        });
        cols.appendChild(col);
      });
      card.appendChild(cols);
      frag.appendChild(card);
    });
    return frag;
  }

  // ── Édition ────────────────────────────────────────────────────────────

  function _ib(label, title, extraClass, onClick) {
    const btn = el('button', 'ed-icon-btn' + (extraClass ? ' ' + extraClass : ''));
    btn.type = 'button'; btn.title = title; btn.textContent = label;
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
  }

  let _dragPayload = null;
  let _lastUsedDir = '';

  function _findNearestDir(sections, section, colIdx) {
    const getDir = f => (f && f.includes('/')) ? f.replace(/\/[^/]+$/, '') : null;
    for (const b of section.colonnes[colIdx]) {
      const d = (b.type === 'DOCUMENTS') ? getDir(b.fichier) : null;
      if (d !== null) return d;
    }
    for (let ci = 0; ci < section.colonnes.length; ci++) {
      if (ci === colIdx) continue;
      for (const b of section.colonnes[ci]) {
        const d = (b.type === 'DOCUMENTS') ? getDir(b.fichier) : null;
        if (d !== null) return d;
      }
    }
    for (const other of sections) {
      if (other === section) continue;
      for (const col of (other.colonnes || [])) {
        for (const b of col) {
          const d = (b.type === 'DOCUMENTS') ? getDir(b.fichier) : null;
          if (d !== null) return d;
        }
      }
    }
    return null;
  }

  function buildEditor(sections) {
    const wrap = el('div', 'ed-section-list');
    const refresh = () => {
      wrap.innerHTML = '';
      sections.forEach((section, i) => wrap.appendChild(_buildSectionCard(sections, section, i, refresh)));
      const addBtn = el('button', 'ed-add-btn');
      addBtn.type = 'button'; addBtn.textContent = '+ Ajouter une section';
      addBtn.addEventListener('click', () => { sections.push({ titre: null, colonnes: [[]] }); refresh(); });
      wrap.appendChild(addBtn);
    };
    refresh();
    return wrap;
  }

  function _buildSectionCard(sections, section, idx, refreshAll) {
    if (!section.colonnes || !section.colonnes.length) section.colonnes = [[]];
    const card = el('div', 'ed-section-card');

    const bar = el('div', 'ed-section-card__bar');
    const titreInp = document.createElement('input');
    titreInp.type = 'text'; titreInp.className = 'ed-section-titre-input';
    titreInp.placeholder = 'Titre de la section (optionnel)';
    titreInp.value = section.titre || '';
    titreInp.addEventListener('input', () => { section.titre = titreInp.value; });
    bar.appendChild(titreInp);

    const acts = el('div', 'ed-section-card__actions');
    if (idx > 0) acts.appendChild(_ib('▲', 'Monter', '', () => { sections.splice(idx - 1, 0, sections.splice(idx, 1)[0]); refreshAll(); }));
    if (idx < sections.length - 1) acts.appendChild(_ib('▼', 'Descendre', '', () => { sections.splice(idx + 1, 0, sections.splice(idx, 1)[0]); refreshAll(); }));
    let addColBtn, delColBtn;
    const colsWrap = el('div', 'ed-doc-cols');
    const renderCols = () => {
      colsWrap.innerHTML = '';
      section.colonnes.forEach((_, ci) => colsWrap.appendChild(_buildColEditor(sections, section, ci, renderCols)));
      addColBtn.disabled = section.colonnes.length >= 4;
      delColBtn.disabled = section.colonnes.length <= 1;
    };
    addColBtn = _ib('+☰', '+ Colonne', '', () => { if (section.colonnes.length < 4) { section.colonnes.push([]); renderCols(); } });
    delColBtn = _ib('-☰', '- Colonne', '', () => {
      if (section.colonnes.length > 1) {
        const removed = section.colonnes.pop();
        removed.forEach(b => section.colonnes[section.colonnes.length - 1].push(b));
        renderCols();
      }
    });
    acts.appendChild(addColBtn);
    acts.appendChild(delColBtn);
    acts.appendChild(_ib('×', 'Supprimer la section', 'ed-icon-btn--del', () => {
      if (confirm('Supprimer cette section ?')) { sections.splice(idx, 1); refreshAll(); }
    }));
    bar.appendChild(acts);
    card.appendChild(bar);
    card.appendChild(colsWrap);
    renderCols();
    return card;
  }

  function _buildColEditor(sections, section, colIdx, renderCols) {
    const colBlocks = section.colonnes[colIdx];
    const col = el('div', 'ed-doc-col');
    const blockList = el('div', 'ed-block-list');
    col.appendChild(blockList);

    const refreshBlocks = () => {
      blockList.innerHTML = '';
      colBlocks.forEach((block, bi) => {
        const bwrap = _buildBlockEditor(sections, section, block, bi, colBlocks, renderCols, colIdx);
        bwrap.setAttribute('draggable', 'true');
        bwrap.addEventListener('dragstart', e => {
          _dragPayload = { section, fromCol: colIdx, fromIdx: bi };
          bwrap.classList.add('ed-dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        bwrap.addEventListener('dragend', () => bwrap.classList.remove('ed-dragging'));
        blockList.appendChild(bwrap);
      });
      const addRow = el('div', 'ed-add-block-row');
      [['+ Document', 'DOCUMENTS'], ['+ Texte', 'TEXTE'], ['+ HTML', 'HTML']].forEach(([lbl, type]) => {
        const btn = el('button', 'ed-add-btn'); btn.type = 'button'; btn.textContent = lbl;
        btn.addEventListener('click', () => {
          let newBlock;
          if (type === 'TEXTE') newBlock = { type, html: '', align: 'left' };
          else if (type === 'HTML') newBlock = { type, html: '' };
          else newBlock = { type, fichier: '', width: 100 };
          colBlocks.push(newBlock);
          refreshBlocks();
        });
        addRow.appendChild(btn);
      });
      blockList.appendChild(addRow);
    };

    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('ed-drop-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('ed-drop-over'));
    col.addEventListener('drop', e => {
      e.preventDefault(); col.classList.remove('ed-drop-over');
      if (!_dragPayload || _dragPayload.section !== section) return;
      const src = _dragPayload.section.colonnes[_dragPayload.fromCol];
      const [moved] = src.splice(_dragPayload.fromIdx, 1);
      colBlocks.push(moved);
      _dragPayload = null;
      renderCols();
    });

    refreshBlocks();
    return col;
  }

  function _buildBlockEditor(sections, section, block, blockIdx, colBlocks, renderCols, colIdx) {
    const wrap = el('div', 'ed-block-editor');
    if (block.type === 'DOCUMENTS') _buildDocBlockEditor(wrap, sections, section, block, blockIdx, colBlocks, renderCols, colIdx);
    else if (block.type === 'HTML') _buildHtmlBlockEditor(wrap, block, blockIdx, colBlocks, renderCols);
    else _buildTextBlockEditor(wrap, block, blockIdx, colBlocks, renderCols);
    return wrap;
  }

  function _buildHtmlBlockEditor(wrap, block, blockIdx, colBlocks, renderCols) {
    wrap.classList.add('ed-html-block');

    const bar = el('div', 'ed-html-block__bar');
    bar.appendChild(txt('span', 'ed-html-block__label', '</> HTML brut'));
    const acts = el('div', 'ed-block-editor__acts');
    if (blockIdx > 0) acts.appendChild(_ib('▲', 'Monter', '', () => { colBlocks.splice(blockIdx - 1, 0, colBlocks.splice(blockIdx, 1)[0]); renderCols(); }));
    if (blockIdx < colBlocks.length - 1) acts.appendChild(_ib('▼', 'Descendre', '', () => { colBlocks.splice(blockIdx + 1, 0, colBlocks.splice(blockIdx, 1)[0]); renderCols(); }));
    acts.appendChild(_ib('×', 'Supprimer', 'ed-icon-btn--del', () => { colBlocks.splice(blockIdx, 1); renderCols(); }));
    bar.appendChild(acts);
    wrap.appendChild(bar);

    const textarea = document.createElement('textarea');
    textarea.className = 'ed-html-block__textarea';
    textarea.placeholder = '<table>...</table>';
    textarea.value = block.html || '';
    textarea.spellcheck = false;
    textarea.addEventListener('input', () => { block.html = textarea.value; });
    textarea.addEventListener('mousedown', () => {
      const bwrap = textarea.closest('[draggable]');
      if (bwrap) {
        bwrap.setAttribute('draggable', 'false');
        const restore = () => { bwrap.setAttribute('draggable', 'true'); window.removeEventListener('mouseup', restore); };
        window.addEventListener('mouseup', restore);
      }
    });
    wrap.appendChild(textarea);
  }

  function _buildDocBlockEditor(wrap, sections, section, block, blockIdx, colBlocks, renderCols, colIdx) {
    wrap.classList.add('ed-img-block');

    const imgWrap = el('div', 'ed-img-block__img');
    imgWrap.title = 'Cliquer pour choisir un document';

    function _refreshPreview(path) {
      imgWrap.innerHTML = '';
      if (path) {
        const img = document.createElement('img');
        img.src = 'documents/' + path; img.alt = '';
        if (block.width && block.width !== 100) img.style.maxWidth = block.width + '%';
        imgWrap.appendChild(img);
      } else {
        imgWrap.appendChild(txt('span', 'ed-img-placeholder', '📷 Cliquer pour choisir un document'));
      }
    }
    _refreshPreview(block.fichier);

    function _openBrowser() {
      const cur = block.fichier || '';
      let initialDir;
      if (cur.includes('/')) {
        initialDir = cur.replace(/\/[^/]+$/, '');
      } else {
        initialDir = _findNearestDir(sections, section, colIdx) || _lastUsedDir;
      }
      FileBrowser.open(path => {
        block.fichier = path;
        _refreshPreview(path);
        pathInp.value = path;
        errEl.textContent = '';
        if (path.includes('/')) _lastUsedDir = path.replace(/\/[^/]+$/, '');
      }, initialDir);
    }
    imgWrap.addEventListener('click', _openBrowser);
    wrap.appendChild(imgWrap);

    const pathRow = el('div', 'ed-img-path-row');
    const pathInp = document.createElement('input');
    pathInp.type = 'text'; pathInp.className = 'ed-input ed-input--sm';
    pathInp.placeholder = 'ex : demo/photo.jpg'; pathInp.value = block.fichier || '';

    const browseBtn = el('button', 'ed-icon-btn');
    browseBtn.type = 'button'; browseBtn.title = 'Parcourir…'; browseBtn.textContent = '📁';
    browseBtn.addEventListener('click', _openBrowser);

    const errEl = txt('div', 'ed-img-path-error', '');

    function _validate(path) {
      if (!path) return null;
      if (/\.\./.test(path)) return 'Le chemin ne doit pas contenir ".."';
      if (/^[/\\]/.test(path)) return 'Chemin absolu interdit';
      if (/^[a-zA-Z]:[/\\]/.test(path)) return 'Chemin absolu interdit';
      if (/^https?:\/\//i.test(path)) return 'URL externe interdite';
      return null;
    }
    pathInp.addEventListener('input', () => {
      const val = pathInp.value.trim();
      const err = _validate(val);
      errEl.textContent = err || '';
      if (!err) { block.fichier = val; _refreshPreview(val); }
    });

    pathRow.appendChild(pathInp);
    pathRow.appendChild(browseBtn);
    wrap.appendChild(pathRow);
    wrap.appendChild(errEl);

    const sizeRow = el('div', 'ed-img-size-row');
    const sizeLabel = txt('span', '', 'Largeur : ');
    const sizeVal = txt('span', 'ed-img-size-val', (block.width || 100) + ' %');
    const sizeInp = document.createElement('input');
    sizeInp.type = 'range'; sizeInp.min = 10; sizeInp.max = 100; sizeInp.step = 5;
    sizeInp.value = block.width || 100;
    sizeInp.className = 'ed-img-size-range';
    sizeInp.addEventListener('mousedown', () => {
      const bwrap = wrap.closest('[draggable]');
      if (bwrap) {
        bwrap.setAttribute('draggable', 'false');
        const restore = () => { bwrap.setAttribute('draggable', 'true'); window.removeEventListener('mouseup', restore); };
        window.addEventListener('mouseup', restore);
      }
    });
    sizeInp.addEventListener('input', () => {
      block.width = +sizeInp.value;
      sizeVal.textContent = block.width + ' %';
      const img = imgWrap.querySelector('img');
      if (img) img.style.maxWidth = block.width + '%';
    });
    sizeRow.appendChild(sizeLabel);
    sizeRow.appendChild(sizeInp);
    sizeRow.appendChild(sizeVal);
    wrap.appendChild(sizeRow);

    const overlay = el('div', 'ed-img-block__overlay');
    if (blockIdx > 0) overlay.appendChild(_ib('▲', 'Monter', '', () => { colBlocks.splice(blockIdx - 1, 0, colBlocks.splice(blockIdx, 1)[0]); renderCols(); }));
    if (blockIdx < colBlocks.length - 1) overlay.appendChild(_ib('▼', 'Descendre', '', () => { colBlocks.splice(blockIdx + 1, 0, colBlocks.splice(blockIdx, 1)[0]); renderCols(); }));
    overlay.appendChild(_ib('×', 'Supprimer', 'ed-icon-btn--del', () => { colBlocks.splice(blockIdx, 1); renderCols(); }));
    wrap.appendChild(overlay);
  }

  function _buildTextBlockEditor(wrap, block, blockIdx, colBlocks, renderCols) {
    const { bar, content } = RichText.buildEditor(block, (toolbar) => {
      if (blockIdx > 0) {
        const up = el('button', 'ed-txt-btn'); up.type = 'button'; up.title = 'Monter'; up.textContent = '▲';
        up.addEventListener('click', () => { colBlocks.splice(blockIdx - 1, 0, colBlocks.splice(blockIdx, 1)[0]); renderCols(); });
        toolbar.appendChild(up);
      }
      if (blockIdx < colBlocks.length - 1) {
        const dn = el('button', 'ed-txt-btn'); dn.type = 'button'; dn.title = 'Descendre'; dn.textContent = '▼';
        dn.addEventListener('click', () => { colBlocks.splice(blockIdx + 1, 0, colBlocks.splice(blockIdx, 1)[0]); renderCols(); });
        toolbar.appendChild(dn);
      }
      const del = el('button', 'ed-txt-btn ed-icon-btn--del'); del.type = 'button'; del.title = 'Supprimer'; del.textContent = '×';
      del.addEventListener('click', () => { colBlocks.splice(blockIdx, 1); renderCols(); });
      toolbar.appendChild(del);
    });
    content.addEventListener('mousedown', () => {
      const bwrap = content.closest('[draggable]');
      if (bwrap) {
        bwrap.setAttribute('draggable', 'false');
        const restore = () => { bwrap.setAttribute('draggable', 'true'); window.removeEventListener('mouseup', restore); };
        window.addEventListener('mouseup', restore);
      }
    });
    wrap.appendChild(bar);
    wrap.appendChild(content);
    if (block.width) content.style.width = block.width + '%';
  }

  return {
    render, buildEditor, openLightbox,
    applySectionStyle, applyBlocTexteStyle, applyImageStyle,
    DEFAULT_SECTION_STYLE, DEFAULT_BLOC_TEXTE_STYLE, DEFAULT_IMAGE_STYLE,
  };
})();
