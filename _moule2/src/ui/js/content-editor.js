'use strict';

// ── Contenu d'une page feuille : sections > colonnes > blocs ───────────────
// Rendu d'un tableau `sections`, porté du modèle documents/contenu de
// famille2 (voir famille2/src/ui/js/components.js) en renommant :
//   documents → sections, contenu → colonnes, IMAGE → DOCUMENTS,
//   block.fichier (texte) → block.html
// Le même rendu sert à la lecture (app.js) et à l'édition (page-editor.js,
// style-editor.js) : l'éditeur ne fait que poser ses outils par-dessus.

const ContentView = (function () {

  const DEFAULT_SECTION_STYLE = { bg: '#d0e4ff', textColor: '#1e293b', borderColor: '#b8d4f8', borderWidth: 1, borderRadius: 0 };
  const DEFAULT_BLOC_TEXTE_STYLE = { bg: '#e3f8ff', textColor: '#1e293b', borderColor: '#b8e6f5', borderWidth: 1, borderRadius: 6 };
  const DEFAULT_PAGE_TITLE_STYLE = { bg: '#ffffff00', textColor: '#1e293b', borderColor: '#e2e8f0', borderWidth: 0, borderRadius: 0 };
  const DEFAULT_IMAGE_STYLE = { borderColor: '#333333', borderWidth: 1, borderRadius: 0 };
  const DEFAULT_FOOTER_ICON = { image: null, width: 40 };
  // Boîte propre à chaque section (fond + bordure de l'ensemble titre/colonnes),
  // distincte de DEFAULT_SECTION_STYLE qui ne stylise que le bandeau du titre.
  // Sans fond (null) et sans bordure (largeur 0 = désactivée) : une section
  // sans réglage s'affiche comme avant.
  const DEFAULT_SECTION_BOX_STYLE = { bg: null, borderColor: '#94a3b8ff', borderWidth: 0, borderRadius: 0 };

  /** Fonctions d'application de style partagées entre le rendu réel (`render`)
   *  et l'éditeur, sur le même principe que HomeView.applyHeaderStyle. */
  function _applyBoxBorder(el, style) {
    el.style.borderStyle = 'solid';
    el.style.borderColor = style.borderColor;
    el.style.borderWidth = style.borderWidth + 'px';
    el.style.borderRadius = style.borderRadius + 'px';
  }

  /** Police/taille/alignement/marges facultatifs d'un texte (voir
   *  SiteRepository::cleanTextExtras). Une propriété absente remet le style en
   *  ligne à '' : le rendu retombe alors sur app.css, comme avant leur ajout.
   *  `withAlign`/`withSpacing` : seulement pour les titres (l'alignement d'un
   *  bloc TEXTE est porté par le bloc lui-même). */
  function applyTextExtras(el, style, withAlign, withSpacing) {
    style = style || {};
    el.style.fontFamily = HomeView.cssFontFamily(style.font, style.fontFile);
    el.style.fontSize = style.size ? style.size + 'px' : '';
    if (withAlign) el.style.textAlign = style.align || '';
    if (withSpacing) {
      el.style.paddingTop = el.style.paddingBottom = style.padY != null ? style.padY + 'px' : '';
      el.style.paddingLeft = el.style.paddingRight = style.padX != null ? style.padX + 'px' : '';
      el.style.marginTop = style.mTop != null ? style.mTop + 'px' : '';
      el.style.marginBottom = style.mBottom != null ? style.mBottom + 'px' : '';
    }
  }

  function applySectionStyle(el, style) {
    style = Object.assign({}, DEFAULT_SECTION_STYLE, style || {});
    el.style.background = style.bg;
    el.style.color = style.textColor;
    _applyBoxBorder(el, style);
    applyTextExtras(el, style, true, true);
  }
  /** Fond + bordure de la boîte d'une section (`section.style`, voir
   *  DEFAULT_SECTION_BOX_STYLE). Les propriétés non réglées sont remises à ''
   *  pour retomber sur le CSS de l'élément. */
  function applySectionBoxStyle(el, style) {
    style = Object.assign({}, DEFAULT_SECTION_BOX_STYLE, style || {});
    const hasBorder = style.borderWidth > 0;
    const custom = !!style.bg || hasBorder;
    el.style.background = style.bg || '';
    if (hasBorder) {
      el.style.borderStyle = 'solid';
      el.style.borderColor = style.borderColor;
      el.style.borderWidth = style.borderWidth + 'px';
    } else {
      el.style.border = '';
    }
    el.style.borderRadius = custom ? style.borderRadius + 'px' : '';
    // Le bandeau du titre (fond opaque) déborderait des coins arrondis.
    el.style.overflow = custom && style.borderRadius > 0 ? 'hidden' : '';
  }
  /** Style commun des blocs TEXTE (pagesStyle.blocTexte), puis réglages propres
   *  au bloc (block.style : police/taille/couleur), prioritaires. */
  function applyBlocTexteStyle(el, style, blockStyle) {
    style = Object.assign({}, DEFAULT_BLOC_TEXTE_STYLE, style || {});
    blockStyle = blockStyle || {};
    el.style.background = style.bg;
    el.style.color = blockStyle.color || style.textColor;
    _applyBoxBorder(el, style);
    applyTextExtras(el, {
      font: blockStyle.fontFile || blockStyle.font ? blockStyle.font : style.font,
      fontFile: blockStyle.fontFile || blockStyle.font ? blockStyle.fontFile : style.fontFile,
      size: blockStyle.size || style.size,
    }, false, false);
  }
  function applyPageTitleStyle(el, style) {
    style = Object.assign({}, DEFAULT_PAGE_TITLE_STYLE, style || {});
    el.style.background = style.bg;
    el.style.color = style.textColor;
    _applyBoxBorder(el, style);
    applyTextExtras(el, style, true, true);
  }
  function applyImageStyle(imgEl, style) {
    style = Object.assign({}, DEFAULT_IMAGE_STYLE, style || {});
    _applyBoxBorder(imgEl, style);
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
  /** <video> d'un bloc DOCUMENTS. `#t=0.1` force l'affichage d'une image fixe
   *  avant la lecture (sinon certains navigateurs, iOS surtout, montrent un
   *  rectangle noir). */
  function _videoEl(src) {
    const v = document.createElement('video');
    v.src = src + '#t=0.1';
    v.preload = 'metadata';
    v.playsInline = true;
    v.controls = true;
    return v;
  }
  /** <audio> d'un bloc DOCUMENTS, toujours avec contrôles (sans eux l'élément
   *  est invisible). Pas de bordure de style image : le lecteur natif a déjà
   *  son propre habillage. */
  function _audioEl(src) {
    const a = document.createElement('audio');
    a.src = src;
    a.preload = 'metadata';
    a.controls = true;
    return a;
  }
  function openLightbox(src) {
    const lb = _lightboxEls();
    lb.querySelector('.lightbox__img').src = src;
    lb.classList.add('lightbox--open');
  }

  // `opts` (facultatif, pour l'éditeur) :
  //   editing     → pas de lightbox au clic sur une image ;
  //   resolveSrc  → URL d'un fichier (défaut : documents/<chemin>) ;
  //   onElement(el, kind, obj, colIdx) → appelé pour chaque élément rendu,
  //     kind ∈ 'section' | 'sectionTitle' | 'col' | 'block'.

  function render(sections, pagesStyle, opts) {
    const frag = document.createDocumentFragment();
    (sections || []).forEach(section => frag.appendChild(renderSection(section, pagesStyle, opts)));
    return frag;
  }

  function renderSection(section, pagesStyle, opts) {
    pagesStyle = pagesStyle || {};
    opts = opts || {};
    const card = el('div', 'm2-section');
    applySectionBoxStyle(card, section.style);
    const hasTitre = section.titre && String(section.titre).trim();
    if (hasTitre) {
      const titreEl = txt('div', 'm2-section__titre', section.titre);
      applySectionStyle(titreEl, pagesStyle.section);
      card.appendChild(titreEl);
      if (opts.onElement) opts.onElement(titreEl, 'sectionTitle', section);
    }

    const cols = el('div', 'm2-section__cols');
    (section.colonnes || []).forEach((colBlocks, ci) => {
      const col = el('div', 'm2-section__col');
      (colBlocks || []).forEach(block => {
        const blockEl = renderBlock(block, pagesStyle, opts);
        if (blockEl) col.appendChild(blockEl);
      });
      cols.appendChild(col);
      if (opts.onElement) opts.onElement(col, 'col', section, ci);
    });
    card.appendChild(cols);
    if (opts.onElement) opts.onElement(card, 'section', section);
    return card;
  }

  // Largeur d'un média (`width` en % de la colonne). Par défaut, une image garde
  // sa taille naturelle, plafonnée en hauteur, et `width` ne fait que la réduire.
  // Ajustée (`fit`), elle prend exactement `width` % de la colonne, quitte à être
  // agrandie, sans plafond de hauteur : 100 % = toute la largeur de la colonne.
  function applyMediaWidth(media, width, fit) {
    const reduced = width && width !== 100 ? width + '%' : '';
    if (media.tagName === 'AUDIO') { media.style.maxWidth = reduced; return; }
    media.style.width = fit ? (width || 100) + '%' : '';
    media.style.maxWidth = fit ? '' : reduced;
    media.style.maxHeight = fit ? 'none' : '';
  }

  function renderBlock(block, pagesStyle, opts) {
    pagesStyle = pagesStyle || {};
    opts = opts || {};
    const src = path => opts.resolveSrc ? opts.resolveSrc(path) : 'documents/' + path;
    let wrap = null;
    if (block.type === 'DOCUMENTS') {
      wrap = el('div', 'm2-bloc-image');
      let media;
      if (isVideoPath(block.fichier)) {
        media = _videoEl(src(block.fichier));
      } else if (isAudioPath(block.fichier)) {
        media = _audioEl(src(block.fichier));
      } else {
        media = document.createElement('img');
        media.src = src(block.fichier);
        media.alt = ''; media.loading = 'lazy';
        if (!opts.editing) media.addEventListener('click', () => openLightbox(media.src));
      }
      applyMediaWidth(media, block.width, block.fit);
      if (media.tagName !== 'AUDIO') applyImageStyle(media, pagesStyle.image);
      wrap.appendChild(media);
    } else if (block.type === 'TEXTE') {
      wrap = el('div', 'm2-bloc-texte');
      wrap.innerHTML = block.html || '';
      applyBlocTexteStyle(wrap, pagesStyle.blocTexte, block.style);
      if (block.align && block.align !== 'left') wrap.style.textAlign = block.align;
      if (block.width) wrap.style.width = block.width + '%';
    } else if (block.type === 'HTML') {
      wrap = el('div', 'm2-bloc-html');
      wrap.innerHTML = block.html || '';
    }
    if (wrap && opts.onElement) opts.onElement(wrap, 'block', block);
    return wrap;
  }

  return {
    render, renderSection, renderBlock, openLightbox, applyMediaWidth,
    applySectionStyle, applySectionBoxStyle, applyBlocTexteStyle, applyPageTitleStyle, applyImageStyle, applyTextExtras,
    DEFAULT_SECTION_STYLE, DEFAULT_SECTION_BOX_STYLE, DEFAULT_BLOC_TEXTE_STYLE, DEFAULT_PAGE_TITLE_STYLE, DEFAULT_IMAGE_STYLE, DEFAULT_FOOTER_ICON,
  };
})();
