'use strict';

// ── Rendu du canevas de la page d'accueil ───────────────────────────────────
// Une seule fonction de rendu, utilisée à l'identique en lecture (app.js) et
// en édition (tree-editor.js), pour garantir un rendu visuel strictement
// identique entre les deux modes. Seul le comportement (navigation vs
// glisser-déposer + popup d'édition) diffère, via `opts`.

const HomeView = (function () {

  const HANDLES = ['nw', 'ne', 'se', 'sw'];
  const MIN_WIDTH = 30;
  const MAX_WIDTH = 500;

  const DEFAULT_HEADER_STYLE = { bg: '#1e293b', titleColor: '#ffffff', titleSize: 18, titleFont: '', titleFontFile: null, titleAlign: 'left', image: null, mode: 'cover' };
  const DEFAULT_HEADER_BACKGROUND = { image: null, mode: 'cover' };
  const DEFAULT_BACKGROUND = { color: '#fafbfc', image: null, mode: 'cover' };
  const ALIGN_TO_JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' };

  // Polices personnalisées (dossier style/) : une règle @font-face par fichier,
  // injectée une seule fois dans <head>, partagée entre lecture et édition.
  const _injectedFontFaces = new Set();
  function _fontFamilyForFile(path) {
    return 'm2font-' + path.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }
  function ensureFontFace(path) {
    const family = _fontFamilyForFile(path);
    if (!_injectedFontFaces.has(family)) {
      _injectedFontFaces.add(family);
      const styleTag = document.createElement('style');
      styleTag.textContent = '@font-face { font-family: "' + family + '"; src: url("style/' + path + '"); font-display: swap; }';
      document.head.appendChild(styleTag);
    }
    return family;
  }

  /** Applique le style de header (fond couleur/image, titre) à un `.m2-header`
   *  déjà construit (avec un `.m2-header__left` contenant `.m2-header__title`).
   *  Utilisé à l'identique en lecture (app.js) et en édition (tree-editor.js).
   *  `imageStyle` ({image, mode}) est distinct de `style` pour permettre une
   *  image de fond différente sur la page d'accueil et sur les autres pages
   *  (même header, même couleur/police partagées, image propre à chaque
   *  contexte) ; par défaut (non fourni), `style` lui-même sert d'imageStyle. */
  function applyHeaderStyle(headerEl, style, imageStyle) {
    style = Object.assign({}, DEFAULT_HEADER_STYLE, style || {});
    imageStyle = imageStyle || style;
    headerEl.style.backgroundColor = style.bg;
    if (imageStyle.image) {
      headerEl.style.backgroundImage = 'url(style/' + imageStyle.image + ')';
      if (imageStyle.mode === 'repeat') {
        headerEl.style.backgroundRepeat = 'repeat';
        headerEl.style.backgroundSize = 'auto';
      } else {
        headerEl.style.backgroundRepeat = 'no-repeat';
        headerEl.style.backgroundSize = imageStyle.mode === 'contain' ? 'contain' : 'cover';
      }
    } else {
      headerEl.style.backgroundImage = '';
      headerEl.style.backgroundRepeat = '';
      headerEl.style.backgroundSize = '';
      headerEl.style.backgroundPosition = '';
    }
    const left = headerEl.querySelector('.m2-header__left');
    if (left) left.style.justifyContent = ALIGN_TO_JUSTIFY[style.titleAlign] || 'flex-start';
    const title = headerEl.querySelector('.m2-header__title');
    if (title) {
      title.style.color = style.titleColor;
      title.style.fontSize = style.titleSize + 'px';
      title.style.fontFamily = style.titleFontFile ? '"' + ensureFontFace(style.titleFontFile) + '"' : (style.titleFont || '');
    }
  }

  /** Applique le style de fond (couleur + image, choisie dans le dossier
   *  style/) à un conteneur `.m2-home`. */
  function applyBackgroundStyle(targetEl, bg) {
    bg = Object.assign({}, DEFAULT_BACKGROUND, bg || {});
    targetEl.style.backgroundColor = bg.color;
    if (bg.image) {
      targetEl.style.backgroundImage = 'url(style/' + bg.image + ')';
      if (bg.mode === 'repeat') {
        targetEl.style.backgroundRepeat = 'repeat';
        targetEl.style.backgroundSize = 'auto';
      } else {
        targetEl.style.backgroundRepeat = 'no-repeat';
        targetEl.style.backgroundSize = bg.mode === 'contain' ? 'contain' : 'cover';
      }
      targetEl.style.backgroundPosition = 'center';
    } else {
      targetEl.style.backgroundImage = '';
      targetEl.style.backgroundRepeat = '';
      targetEl.style.backgroundSize = '';
      targetEl.style.backgroundPosition = '';
    }
  }

  function render(images, opts) {
    opts = opts || {};
    const canvas = el('div', 'm2-home__canvas');
    images.forEach(img => {
      canvas.appendChild(buildThumb(img, opts));
    });
    return canvas;
  }

  function buildThumb(img, opts) {
    const isSelected = !!(opts.selectedSet && opts.selectedSet.has(img));
    const thumb = el('div', 'm2-thumb'
      + (img.lien ? ' m2-thumb--link' : '')
      + (opts.editable ? ' m2-thumb--editable' : '')
      + (isSelected ? ' m2-thumb--multiselected' : ''));
    thumb.style.left = (img.x + CANVAS_ORIGIN_X) + 'px';
    thumb.style.top = (img.y + CANVAS_ORIGIN_Y) + 'px';

    const imgWrap = el('div', 'm2-thumb__imgwrap');
    const im = document.createElement('img');
    im.src = 'documents/' + img.image;
    _applyWidth(im, img);
    imgWrap.appendChild(im);
    thumb.appendChild(imgWrap);

    if (img.texte) thumb.appendChild(txt('span', 'm2-thumb__label', img.texte));

    if (opts.editable) {
      _makeDraggable(thumb, img, opts);
      _addResizeHandles(imgWrap, im, img, thumb);
    } else if (img.lien) {
      thumb.addEventListener('click', () => {
        if (opts.onNavigate) opts.onNavigate(img.lien);
        else location.hash = '#/' + img.lien;
      });
    }

    return thumb;
  }

  function _applyWidth(im, img) {
    if (img.width) {
      // Lève aussi le plafond max-height (140px, hérité du style par défaut) :
      // sans ça, une image large finit par être écrasée en hauteur une fois
      // ce plafond atteint, ce qui casse le ratio et fausse le calcul de
      // l'ancre de redimensionnement (qui suppose une hauteur non bridée).
      im.style.maxWidth = 'none';
      im.style.maxHeight = 'none';
      im.style.width = img.width + 'px';
    }
  }

  function _makeDraggable(thumb, img, opts) {
    let dragging = false, moved = false, startX, startY;
    thumb.addEventListener('mousedown', e => {
      // Ctrl/Cmd+clic : bascule la sélection multiple, ne démarre pas de glissé.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (opts.onToggleSelect) opts.onToggleSelect(img, thumb);
        return;
      }
      e.preventDefault();
      dragging = true; moved = false;
      startX = e.clientX; startY = e.clientY;

      // Si cette image fait partie d'une sélection multiple active, on
      // déplace tout le groupe ensemble ; sinon, comportement normal (elle
      // seule).
      const group = (opts.getSelectionGroup ? opts.getSelectionGroup(img, thumb) : [{ img, thumb }])
        .filter(g => g.thumb)
        .map(g => ({ img: g.img, thumb: g.thumb, x: g.img.x, y: g.img.y }));

      const onMove = ev => {
        if (!dragging) return;
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
        // Ne jamais laisser passer sous la limite visible du canevas (qui ne
        // défile pas dans les valeurs négatives), sinon l'image deviendrait
        // impossible à rattraper.
        group.forEach(g => {
          g.img.x = Math.max(-CANVAS_ORIGIN_X, g.x + dx);
          g.img.y = Math.max(-CANVAS_ORIGIN_Y, g.y + dy);
          g.thumb.style.left = (g.img.x + CANVAS_ORIGIN_X) + 'px';
          g.thumb.style.top = (g.img.y + CANVAS_ORIGIN_Y) + 'px';
        });
        if (opts.onDrag) opts.onDrag(img, thumb);
      };
      const onUp = () => {
        dragging = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        if (!moved && opts.onClick) opts.onClick(img, thumb);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  // Coin opposé à chaque poignée (le point qui doit rester fixe pendant le
  // redimensionnement) et le signe (±1) à appliquer à chaque axe pour que le
  // centre de l'image se déplace dans la bonne direction.
  const ANCHORS = {
    nw: { ox: 1, oy: 1, sx: -1, sy: -1 }, // ancre = coin bas-droit (se)
    ne: { ox: 0, oy: 1, sx: 1, sy: -1 },  // ancre = coin bas-gauche (sw)
    se: { ox: 0, oy: 0, sx: 1, sy: 1 },   // ancre = coin haut-gauche (nw)
    sw: { ox: 1, oy: 0, sx: -1, sy: 1 },  // ancre = coin haut-droit (ne)
  };

  /**
   * Poignées de redimensionnement (coins uniquement). Le ratio d'origine est
   * toujours conservé ; le coin opposé à celui qu'on tire reste fixe (ex :
   * tirer le coin bas-droit ne bouge que ce coin, le coin haut-gauche ne
   * bouge pas).
   */
  function _addResizeHandles(imgWrap, im, img, thumb) {
    HANDLES.forEach(dir => {
      const handle = el('div', 'm2-thumb__handle m2-thumb__handle--' + dir);
      handle.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
        const a = ANCHORS[dir];
        const rect = im.getBoundingClientRect();
        const anchorX = rect.left + a.ox * rect.width;
        const anchorY = rect.top + a.oy * rect.height;
        const startDist = Math.hypot(e.clientX - anchorX, e.clientY - anchorY) || 1;
        const startWidth = rect.width;
        const startCenterX = rect.left + rect.width / 2;
        const startCenterY = rect.top + rect.height / 2;
        const startImgX = img.x, startImgY = img.y;
        imgWrap.classList.add('m2-thumb__imgwrap--resizing');

        const onMove = ev => {
          const dist = Math.hypot(ev.clientX - anchorX, ev.clientY - anchorY);
          let newWidth = Math.round(startWidth * (dist / startDist));
          newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
          const newHeight = newWidth * (rect.height / rect.width);

          // Nouveau centre de l'image tel qu'il serait si le coin ancré
          // restait immobile, puis report de ce déplacement sur x/y du thumb
          // (le thumb entier est déplacé du même delta, label compris).
          const newCenterX = anchorX + a.sx * (newWidth / 2);
          const newCenterY = anchorY + a.sy * (newHeight / 2);
          img.x = Math.max(-CANVAS_ORIGIN_X, startImgX + (newCenterX - startCenterX));
          img.y = Math.max(-CANVAS_ORIGIN_Y, startImgY + (newCenterY - startCenterY));
          img.width = newWidth;

          _applyWidth(im, img);
          thumb.style.left = (img.x + CANVAS_ORIGIN_X) + 'px';
          thumb.style.top = (img.y + CANVAS_ORIGIN_Y) + 'px';
        };
        const onUp = () => {
          imgWrap.classList.remove('m2-thumb__imgwrap--resizing');
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
      imgWrap.appendChild(handle);
    });
  }

  /** Reflète en direct un changement d'image/texte/taille sur une vignette déjà construite. */
  function updateThumb(thumb, img) {
    const imgEl = thumb.querySelector('img');
    imgEl.src = 'documents/' + img.image;
    _applyWidth(imgEl, img);
    let label = thumb.querySelector('.m2-thumb__label');
    if (img.texte) {
      if (!label) { label = txt('span', 'm2-thumb__label', ''); thumb.appendChild(label); }
      label.textContent = img.texte;
    } else if (label) {
      label.parentNode.removeChild(label);
    }
  }

  return {
    render, buildThumb, updateThumb,
    applyHeaderStyle, applyBackgroundStyle,
    DEFAULT_HEADER_STYLE, DEFAULT_BACKGROUND, DEFAULT_HEADER_BACKGROUND,
  };
})();
