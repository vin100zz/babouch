'use strict';

// ── Édition de la page d'accueil, directement sur la page ──────────────────
// Clic = sélection (Ctrl+clic, ou rectangle tracé sur le fond : plusieurs
// blocs) ; glisser = déplacer ; coins = redimensionner ; flèches = décaler.
// La barre de gauche affiche les propriétés de la sélection : fond, en-tête,
// titre du site, un bloc, ou plusieurs blocs (alignement, répartition).

const HomeEditor = (function () {

  const ALIGN_BUTTONS = [
    ['Aligner à gauche', 'M4 3v18M8 7h11M8 15h6', 'left'],
    ['Centrer horizontalement', 'M12 3v18M6 7h12M8 15h8', 'hcenter'],
    ['Aligner à droite', 'M20 3v18M5 7h11M10 15h6', 'right'],
    ['Aligner en haut', 'M3 4h18M7 8v11M15 8v6', 'top'],
    ['Centrer verticalement', 'M3 12h18M7 6v12M15 8v8', 'vcenter'],
    ['Aligner en bas', 'M3 20h18M7 5v11M15 10v6', 'bottom'],
  ];
  const LABEL_DEFAULTS = { size: 16, color: '#1e293b' }; // .m2-thumb__label (app.css)

  function open(container, siteData, onDone) {
    const site = StyleItems.normalize(clone(siteData));
    const images = () => site.home.images;
    let sel = [];                 // 'bg' | 'header' | 'title' | id d'image
    let thumbMap = new Map();     // id d'image → vignette
    let pageEl = null, headerEl = null, canvas = null;
    let suppressPick = false;
    let marquee = null;

    const studio = Studio.open({
      container,
      site,
      title: "Modifier la page d'accueil",
      subtitle: site.titre_site || SITE_NAME,
      snapshot: () => JSON.stringify({ titre_site: site.titre_site, home: site.home }),
      restore(s) {
        const d = JSON.parse(s);
        site.titre_site = d.titre_site;
        site.home = d.home;
        sel = sel.filter(id => !isImageId(id) || images().some(i => i.id === id));
        renderPage();
        syncSelection();
      },
      save: async () => (await Api.saveSite(site)).data,
      onPick,
      onKey,
      onClose(saved) {
        window.removeEventListener('resize', fit);
        onDone(saved);
      },
      tools: [{ label: '+ Bloc', onClick: addBlock }],
    });

    // Les blocs de l'accueil sont placés en pixels sur un canevas de 1400 px :
    // la page est réduite (zoom) pour s'afficher, à côté de la barre
    // d'édition, avec exactement la même mise en page qu'en plein écran.
    let scale = 1;
    function fit() {
      scale = Math.min(1, studio.page.clientWidth / window.innerWidth);
      if (pageEl) pageEl.style.zoom = String(scale);
    }
    window.addEventListener('resize', fit);

    function isImageId(id) { return id !== 'bg' && id !== 'header' && id !== 'title'; }
    function selectedImages() { return images().filter(i => sel.indexOf(i.id) !== -1); }

    // Modifie la copie de travail : instantané pour « Annuler », puis mise à
    // jour en direct de la page ; opts.panel reconstruit aussi le panneau
    // (quand la modification fait apparaître ou disparaître des lignes).
    function change(key, fn, opts) {
      studio.record(key);
      fn();
      refresh();
      if (opts && opts.panel) renderPanel();
    }

    // ── Page ──

    function renderPage() {
      studio.untrackAll();
      const page = studio.page;
      page.innerHTML = '';
      thumbMap = new Map();

      pageEl = el('div', 'm2-home-page');
      HomeView.applyBackgroundStyle(pageEl, site.home.background);
      headerEl = SiteChrome.header(site, 'home');
      pageEl.appendChild(headerEl);

      const wrap = el('div', 'm2-home');
      canvas = el('div', 'm2-home__canvas');
      if (images().length === 0) {
        canvas.appendChild(txt('div', 'm2-home__empty', 'Aucune image sur la page d\'accueil. Cliquez sur « + Bloc » pour en ajouter une.'));
      }
      images().forEach(img => canvas.appendChild(buildThumb(img)));
      wrap.appendChild(canvas);
      wrap.addEventListener('mousedown', startMarquee);
      pageEl.appendChild(wrap);
      page.appendChild(pageEl);
      fit();

      studio.track(pageEl, 'bg', "Fond de la page d'accueil");
      studio.track(headerEl, 'header', 'En-tête');
      studio.track(headerEl.querySelector('.m2-header__title'), 'title', 'Titre du site');
    }

    function buildThumb(img) {
      const thumb = HomeView.buildThumb(img, {
        editable: true,
        onClick: im => select([im.id]),
        onToggleSelect: im => {
          const ids = sel.filter(isImageId);
          select(ids.indexOf(im.id) !== -1 ? ids.filter(id => id !== im.id) : ids.concat([im.id]));
        },
        getSelectionGroup: im => (sel.indexOf(im.id) !== -1 ? selectedImages() : [im]).map(i => ({ img: i, thumb: thumbMap.get(i.id) })),
        onBeforeChange: () => studio.record(null),
        onChange: () => renderPanel(),
        scale: () => scale,
      });
      // PowerPoint : appuyer sur un bloc non sélectionné le sélectionne aussitôt
      // (le glisser qui suit le déplace, lui seul).
      thumb.addEventListener('mousedown', e => {
        if (!(e.ctrlKey || e.metaKey) && sel.indexOf(img.id) === -1) select([img.id]);
      });
      thumbMap.set(img.id, thumb);
      studio.track(thumb, img.id, img.texte || 'Image');
      return thumb;
    }

    // Changements de style : appliqués aux éléments existants, sans
    // reconstruire la page (les glisser en cours restent fluides).
    function refresh() {
      HomeView.applyBackgroundStyle(pageEl, site.home.background);
      HomeView.applyHeaderStyle(headerEl, site.home.headerStyle, site.home.headerStyle);
      headerEl.querySelector('.m2-header__title').textContent = site.titre_site || SITE_NAME;
      images().forEach(img => {
        const thumb = thumbMap.get(img.id);
        if (!thumb) return;
        HomeView.updateThumb(thumb, img);
        studio.track(thumb, img.id, img.texte || 'Image');
      });
      studio.setSelTitle(selectionTitle());
    }

    // ── Sélection ──

    function select(ids) {
      sel = ids;
      syncSelection();
    }
    function syncSelection() {
      thumbMap.forEach((thumb, id) => thumb.classList.toggle('m2-thumb--selected', sel.indexOf(id) !== -1));
      studio.setSelection(sel);
      studio.setSelTitle(selectionTitle());
      renderPanel();
    }
    function selectionTitle() {
      const imgs = selectedImages();
      if (imgs.length > 1) return imgs.length + ' blocs';
      if (imgs.length === 1) return imgs[0].texte || 'Image';
      if (sel[0] === 'bg') return "Fond de la page d'accueil";
      if (sel[0] === 'header') return 'En-tête';
      if (sel[0] === 'title') return 'Titre du site';
      return "Page d'accueil";
    }

    function onPick(id) {
      if (suppressPick) { suppressPick = false; return; }
      // Les blocs gèrent eux-mêmes leur sélection (clic, Ctrl+clic, glisser).
      if (id && isImageId(id)) return;
      select(id ? [id] : []);
    }

    // Rectangle de sélection tracé sur le fond (hors blocs).
    function startMarquee(e) {
      if (e.button !== 0 || e.target.closest('.m2-thumb')) return;
      const sx = e.clientX, sy = e.clientY;
      let moved = false;
      const onMove = ev => {
        if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return;
        if (!moved) { moved = true; marquee = el('div', 'st-marquee'); studio.layer.appendChild(marquee); }
        ev.preventDefault();
        const l = Math.min(sx, ev.clientX), t = Math.min(sy, ev.clientY);
        const w = Math.abs(ev.clientX - sx), h = Math.abs(ev.clientY - sy);
        marquee.style.left = (l + window.scrollX) + 'px';
        marquee.style.top = (t + window.scrollY) + 'px';
        marquee.style.width = w + 'px';
        marquee.style.height = h + 'px';
        marquee.rect = { l, t, r: l + w, b: t + h };
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        if (!moved) return;
        const m = marquee.rect || { l: 0, t: 0, r: 0, b: 0 };
        marquee.remove(); marquee = null;
        const ids = images().filter(img => {
          const thumb = thumbMap.get(img.id);
          const r = thumb.querySelector('.m2-thumb__imgwrap').getBoundingClientRect();
          return r.left < m.r && r.right > m.l && r.top < m.b && r.bottom > m.t;
        }).map(img => img.id);
        suppressPick = true;
        select(ids);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }

    function onKey(e) {
      const imgs = selectedImages();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        select(images().map(i => i.id));
      } else if (e.key === 'Escape') {
        select([]);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && imgs.length) {
        e.preventDefault();
        removeImages(imgs);
      } else if (imgs.length && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : (e.key === 'ArrowRight' ? step : 0);
        const dy = e.key === 'ArrowUp' ? -step : (e.key === 'ArrowDown' ? step : 0);
        change('nudge', () => imgs.forEach(img => {
          img.x = Math.max(-CANVAS_ORIGIN_X, img.x + dx);
          img.y = Math.max(-CANVAS_ORIGIN_Y, img.y + dy);
        }), { panel: true });
      }
    }

    // ── Actions sur les blocs ──

    function addBlock() {
      FileBrowser.open(path => {
        studio.record(null);
        const img = { id: uid('img_'), image: path, x: 400, y: 200, texte: '', lien: null };
        images().push(img);
        renderPage();
        select([img.id]);
      }, { root: 'style', rootLabel: 'style', type: 'image' });
    }
    function duplicate(img) {
      studio.record(null);
      const copy = Object.assign(clone(img), { id: uid('img_'), x: img.x + 20, y: img.y + 20 });
      images().push(copy);
      renderPage();
      select([copy.id]);
    }
    function bringToFront(imgs) {
      studio.record(null);
      site.home.images = images().filter(i => imgs.indexOf(i) === -1).concat(imgs);
      renderPage();
      syncSelection();
    }
    function removeImages(imgs) {
      studio.record(null);
      site.home.images = images().filter(i => imgs.indexOf(i) === -1);
      renderPage();
      select([]);
    }

    function _size(img) {
      const im = thumbMap.get(img.id).querySelector('img');
      return { w: (im && im.offsetWidth) || 140, h: (im && im.offsetHeight) || 140 };
    }
    /** Aligne les blocs sélectionnés sur un même bord ou centre (x/y sont le
     *  centre de la vignette). */
    function align(mode) {
      const items = selectedImages().map(img => Object.assign({ img }, _size(img)));
      if (items.length < 2) return;
      change(null, () => {
        const xs = items.map(it => it.img.x), ys = items.map(it => it.img.y);
        let v;
        switch (mode) {
          case 'left':    v = Math.min(...items.map(it => it.img.x - it.w / 2)); items.forEach(it => { it.img.x = Math.round(v + it.w / 2); }); break;
          case 'right':   v = Math.max(...items.map(it => it.img.x + it.w / 2)); items.forEach(it => { it.img.x = Math.round(v - it.w / 2); }); break;
          case 'hcenter': v = xs.reduce((s, x) => s + x, 0) / xs.length; items.forEach(it => { it.img.x = Math.round(v); }); break;
          case 'top':     v = Math.min(...items.map(it => it.img.y - it.h / 2)); items.forEach(it => { it.img.y = Math.round(v + it.h / 2); }); break;
          case 'bottom':  v = Math.max(...items.map(it => it.img.y + it.h / 2)); items.forEach(it => { it.img.y = Math.round(v - it.h / 2); }); break;
          case 'vcenter': v = ys.reduce((s, y) => s + y, 0) / ys.length; items.forEach(it => { it.img.y = Math.round(v); }); break;
        }
        items.forEach(it => {
          it.img.x = Math.max(-CANVAS_ORIGIN_X, it.img.x);
          it.img.y = Math.max(-CANVAS_ORIGIN_Y, it.img.y);
        });
      }, { panel: true });
    }
    /** Répartit les blocs sélectionnés à intervalles réguliers (centres). */
    function distribute(axis) {
      const imgs = selectedImages();
      if (imgs.length < 3) return;
      const k = axis === 'h' ? 'x' : 'y';
      const sorted = imgs.slice().sort((a, b) => a[k] - b[k]);
      const first = sorted[0][k], step = (sorted[sorted.length - 1][k] - first) / (sorted.length - 1);
      change(null, () => sorted.forEach((img, i) => { img[k] = Math.round(first + step * i); }), { panel: true });
    }

    // ── Panneau de propriétés ──

    function renderPanel() {
      PropsPanel.render(studio.panel, panelItems());
    }

    function panelItems() {
      const imgs = selectedImages();
      if (imgs.length > 1) return multiItems(imgs);
      if (imgs.length === 1) return blockItems(imgs[0]);
      switch (sel[0]) {
        case 'bg': return StyleItems.background(site.home.background, change);
        case 'header': return StyleItems.header(site, 'home', change);
        case 'title': return StyleItems.siteTitle(site, 'home', change);
        default: return [{ hint: 'Cliquez sur un élément de la page pour le modifier.' }];
      }
    }

    function labelText(imgs) {
      return PropsPanel.textRows(StyleItems.textAdapter(imgs, (img, create) => {
        if (create && !img.texteStyle) img.texteStyle = {};
        return img.texteStyle;
      }, LABEL_DEFAULTS, change, 'label'), { sizeMin: 8, sizeMax: 80 });
    }

    function linkOptions() {
      return [['', 'Aucun lien']].concat(site.chapitres.map(n => [n.keyword, n.label || n.keyword]));
    }

    function blockItems(img) {
      return [
        { group: 'Contenu' },
        { type: 'image', label: 'Image', root: 'style',
          get: () => img.image, set: p => change('image', () => { img.image = p; }, { panel: true }) },
        { type: 'text', label: 'Texte', placeholder: 'Aucun texte',
          get: () => img.texte || '', set: v => change('texte.' + img.id, () => { img.texte = v || null; }) },
        { type: 'select', label: 'Lien vers', options: linkOptions(),
          get: () => img.lien || '', set: v => change('lien', () => { img.lien = v || null; }) },
        { group: 'Texte' },
        ...labelText([img]),
        // Décalage du texte par rapport à sa place par défaut, sous l'image.
        { type: 'xy', label: 'Position',
          getX: () => img.texteX || 0, setX: v => change('texteX.' + img.id, () => { img.texteX = v || null; }),
          getY: () => img.texteY || 0, setY: v => change('texteY.' + img.id, () => { img.texteY = v || null; }) },
        { group: 'Taille et position' },
        { type: 'range', label: 'Largeur', min: 30, max: 1000, unit: ' px',
          get: () => img.width || _size(img).w, set: v => change('width.' + img.id, () => { img.width = v; }) },
        { type: 'xy', label: 'Position',
          getX: () => img.x, setX: v => change('x.' + img.id, () => { img.x = v; }),
          getY: () => img.y, setY: v => change('y.' + img.id, () => { img.y = v; }) },
        { actions: [
          { label: 'Dupliquer', onClick: () => duplicate(img) },
          { label: 'Premier plan', onClick: () => bringToFront([img]) },
          { label: 'Supprimer', kind: 'danger', onClick: () => removeImages([img]) },
        ] },
      ];
    }

    function common(values) { return values.every(v => v === values[0]) ? values[0] : null; }

    function multiItems(imgs) {
      const widths = imgs.map(i => i.width || _size(i).w);
      return [
        { group: 'Disposition' },
        { type: 'icons', label: 'Aligner', buttons: ALIGN_BUTTONS.map(([title, path, mode]) => [title, path, () => align(mode)]) },
        { type: 'icons', label: 'Répartir', buttons: [
          ['Répartir horizontalement', 'M4 4v16M20 4v16M10 8v8M14 8v8', () => distribute('h')],
          ['Répartir verticalement', 'M4 4h16M4 20h16M8 10h8M8 14h8', () => distribute('v')],
        ] },
        { group: 'Texte' },
        ...labelText(imgs),
        // Valeur commune, ou case vide si les blocs diffèrent.
        { type: 'xy', label: 'Position',
          getX: () => common(imgs.map(i => i.texteX || 0)),
          setX: v => change('texteX.multi', () => imgs.forEach(i => { i.texteX = v || null; })),
          getY: () => common(imgs.map(i => i.texteY || 0)),
          setY: v => change('texteY.multi', () => imgs.forEach(i => { i.texteY = v || null; })) },
        { group: 'Taille' },
        { type: 'range', label: 'Largeur', min: 30, max: 1000, unit: ' px',
          get: () => common(widths),
          set: v => change('width.multi', () => imgs.forEach(i => { i.width = v; })) },
        { actions: [
          { label: 'Premier plan', onClick: () => bringToFront(imgs) },
          { label: 'Supprimer les ' + imgs.length + ' blocs', kind: 'danger', onClick: () => removeImages(imgs) },
        ] },
      ];
    }

    renderPage();
    syncSelection();
  }

  return { open };
})();
