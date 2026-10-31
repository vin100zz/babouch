'use strict';

// ── Tableau de propriétés de la barre d'édition ────────────────────────────
// Présentation « à la PowerPoint » : groupes repliables (bandeau titre), puis
// lignes clé / valeur. Chaque ligne lit et écrit sa valeur via get()/set() :
// le panneau ne connaît pas le modèle de données, l'éditeur appelant si.

const PropsPanel = (function () {

  // Groupes repliés par l'utilisateur, mémorisés d'une sélection à l'autre.
  const _collapsed = {};

  const FONT_CHOICES = [
    ['', 'Police par défaut'],
    ['Georgia, serif', 'Georgia'],
    ['"Times New Roman", serif', 'Times New Roman'],
    ['"Courier New", monospace', 'Courier New'],
    ['"Trebuchet MS", sans-serif', 'Trebuchet MS'],
    ['Verdana, sans-serif', 'Verdana'],
    ['"Segoe UI", sans-serif', 'Segoe UI'],
  ];
  const ALIGN_OPTIONS = [
    ['left', 'Aligner à gauche', 'M4 6h16M4 10h10M4 14h16M4 18h10'],
    ['center', 'Centrer', 'M4 6h16M7 10h10M4 14h16M7 18h10'],
    ['right', 'Aligner à droite', 'M4 6h16M10 10h10M4 14h16M10 18h10'],
  ];
  const ARROWS = {
    v: 'M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4',
    h: 'M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4',
    up: 'M4 4h16M12 20V8M7 13l5-5 5 5',
    down: 'M4 20h16M12 4v12M7 11l5 5 5-5',
  };

  function svgIcon(path, size) {
    size = size || 16;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + path + '"/></svg>';
  }

  function button(label, onClick, kind) {
    const b = txt('button', 'pp-btn' + (kind ? ' pp-btn--' + kind : ''), label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  /**
   * Remplit `container` à partir d'une liste d'items :
   *   { group: 'Texte' }                      → ouvre un groupe repliable
   *   { hint: '…' }                           → phrase d'aide
   *   { actions: [{label, onClick, kind}] }   → rangée de boutons
   *   { type: 'color' | 'range' | …, label, get, set, … } → ligne clé / valeur
   * Un item faux (null/false) est ignoré, pour écrire simplement des lignes
   * conditionnelles.
   */
  function render(container, items) {
    container.innerHTML = '';
    let body = container;
    items.forEach(it => {
      if (!it) return;
      if (it.group) {
        const g = _group(it.group);
        container.appendChild(g.head);
        container.appendChild(g.body);
        body = g.body;
      } else if (it.hint) {
        body.appendChild(txt('div', 'pp-hint', it.hint));
      } else if (it.actions) {
        const row = el('div', 'pp-actions');
        it.actions.forEach(a => { if (a) row.appendChild(button(a.label, a.onClick, a.kind)); });
        body.appendChild(row);
      } else {
        body.appendChild(_row(it));
      }
    });
  }

  function _group(label) {
    const head = el('button', 'pp-group');
    head.type = 'button';
    head.innerHTML = svgIcon('M9 6l6 6-6 6', 14);
    head.appendChild(document.createTextNode(label));
    const body = el('div', 'pp-group__body');
    function sync() {
      const closed = !!_collapsed[label];
      body.hidden = closed;
      head.classList.toggle('pp-group--closed', closed);
      head.setAttribute('aria-expanded', closed ? 'false' : 'true');
    }
    head.addEventListener('click', () => { _collapsed[label] = !_collapsed[label]; sync(); });
    sync();
    return { head, body };
  }

  let _uid = 0;
  function _row(it) {
    const row = el('div', 'pp-row');
    const id = 'pp-' + (++_uid);
    const label = txt('label', 'pp-row__label', it.label || '');
    label.htmlFor = id;
    row.appendChild(label);
    const val = el('div', 'pp-row__value');
    row.appendChild(val);
    const build = ROWS[it.type];
    if (build) build(val, it, id);
    return row;
  }

  function _input(type, id, cls) {
    const inp = document.createElement('input');
    inp.type = type; inp.className = cls || 'pp-input';
    if (id) inp.id = id;
    return inp;
  }

  const ROWS = {
    // Texte d'une ligne, mais affiché sur plusieurs : la barre est étroite et
    // un titre long serait coupé dans un <input>. Le champ grandit avec son
    // contenu ; Entrée et les retours à la ligne collés sont neutralisés.
    text(val, it, id) {
      const ta = document.createElement('textarea');
      ta.id = id; ta.className = 'pp-input pp-text'; ta.rows = 1;
      ta.value = it.get() || '';
      if (it.placeholder) ta.placeholder = it.placeholder;
      const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
      ta.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
      ta.addEventListener('input', () => {
        if (/[\r\n]/.test(ta.value)) ta.value = ta.value.replace(/\s*[\r\n]+\s*/g, ' ');
        fit();
        it.set(ta.value);
      });
      val.appendChild(ta);
      requestAnimationFrame(fit);
    },

    textarea(val, it, id) {
      const ta = document.createElement('textarea');
      ta.id = id; ta.className = 'pp-input pp-textarea'; ta.spellcheck = false;
      ta.value = it.get() || '';
      ta.addEventListener('input', () => it.set(ta.value));
      val.appendChild(ta);
    },

    // Couleur RVB seule : l'opacité (canal alpha des valeurs #rrggbbaa) est
    // conservée, et se règle sur sa propre ligne (type 'opacity').
    color(val, it, id) {
      const cur = normalizeHex8(it.get());
      const colorInp = _input('color', id, 'pp-color');
      colorInp.value = cur.slice(0, 7);
      const hexInp = _input('text', null, 'pp-input pp-hex');
      hexInp.maxLength = 7; hexInp.spellcheck = false; hexInp.autocomplete = 'off';
      hexInp.value = cur.slice(0, 7);
      hexInp.setAttribute('aria-label', (it.label || 'Couleur') + ' (code hexadécimal)');
      const emit = rgb => it.set(rgb + normalizeHex8(it.get()).slice(7, 9));
      colorInp.addEventListener('input', () => { hexInp.value = colorInp.value; emit(colorInp.value); });
      hexInp.addEventListener('input', () => {
        let v = hexInp.value.trim();
        if (!v.startsWith('#')) v = '#' + v;
        if (/^#[0-9a-fA-F]{6}$/.test(v)) { colorInp.value = v.toLowerCase(); emit(v.toLowerCase()); }
      });
      hexInp.addEventListener('blur', () => { hexInp.value = colorInp.value; });
      val.appendChild(colorInp);
      val.appendChild(hexInp);
    },

    opacity(val, it, id) {
      ROWS.range(val, {
        min: 0, max: 100, step: 1, unit: ' %',
        get: () => Math.round(parseInt(normalizeHex8(it.get()).slice(7, 9), 16) / 255 * 100),
        set: v => it.set(normalizeHex8(it.get()).slice(0, 7) + pctToHex2(v)),
      }, id);
    },

    // get() renvoie null quand plusieurs éléments sélectionnés n'ont pas la
    // même valeur (« Mixte »), ou qu'aucune valeur n'est réglée (nullLabel,
    // ex. « Auto ») : le curseur est alors au milieu.
    range(val, it, id) {
      const inp = _input('range', id, 'pp-range');
      inp.min = String(it.min); inp.max = String(it.max); inp.step = String(it.step || 1);
      const v = it.get();
      inp.value = String(v == null ? (it.min + it.max) / 2 : v);
      const out = txt('span', 'pp-range__val', v == null ? (it.nullLabel || 'Mixte') : v + (it.unit || ''));
      inp.addEventListener('input', () => {
        out.textContent = inp.value + (it.unit || '');
        it.set(+inp.value);
      });
      val.appendChild(inp);
      val.appendChild(out);
    },

    select(val, it, id) {
      const sel = document.createElement('select');
      sel.id = id; sel.className = 'pp-input';
      const cur = it.get() == null ? '' : String(it.get());
      it.options.forEach(([v, l]) => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = l;
        if (String(v) === cur) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => it.set(sel.value));
      val.appendChild(sel);
    },

    seg(val, it) {
      const group = el('div', 'pp-seg');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', it.label || '');
      const cur = it.get();
      it.options.forEach(([v, l]) => {
        const b = txt('button', 'pp-seg__btn' + (String(v) === String(cur) ? ' pp-seg__btn--on' : ''), l);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(v) === String(cur) ? 'true' : 'false');
        b.addEventListener('click', () => it.set(v));
        group.appendChild(b);
      });
      val.appendChild(group);
    },

    // Boutons-icônes : soit un choix exclusif (options + get/set, ex.
    // alignement du texte), soit de simples actions (buttons, ex. aligner
    // plusieurs blocs entre eux).
    icons(val, it) {
      const wrap = el('div', 'pp-icons');
      const cur = it.get ? it.get() : null;
      (it.options || []).forEach(([v, title, path]) => {
        const on = String(v) === String(cur);
        wrap.appendChild(_iconBtn(title, path, () => it.set(v), on));
      });
      (it.buttons || []).forEach(([title, path, onClick]) => wrap.appendChild(_iconBtn(title, path, onClick, false)));
      val.appendChild(wrap);
    },

    toggle(val, it, id) {
      const cb = _input('checkbox', id, 'pp-check');
      cb.checked = !!it.get();
      const state = txt('span', 'pp-toggle__state', cb.checked ? (it.on || 'Oui') : (it.off || 'Non'));
      cb.addEventListener('change', () => it.set(cb.checked));
      val.appendChild(cb);
      val.appendChild(state);
    },

    // Fichier (image, police, document) choisi dans l'explorateur ; `root` :
    // 'style' ou 'documents'.
    image(val, it) {
      const path = it.get();
      const root = it.root || 'style';
      const thumb = el('span', 'pp-thumb');
      if (path && (it.fileType || 'image') === 'image' && !isVideoPath(path) && !isAudioPath(path)) {
        const im = document.createElement('img');
        im.src = root + '/' + path; im.alt = '';
        thumb.appendChild(im);
      } else if (path) {
        thumb.classList.add('pp-thumb--file');
        thumb.textContent = isAudioPath(path) ? '♪' : (isVideoPath(path) ? '▶' : '');
      }
      val.appendChild(thumb);
      val.appendChild(txt('span', 'pp-file__name', path ? path.split('/').pop() : (it.empty || 'Aucune image')));
      val.appendChild(button('Changer', () => {
        const initialDir = it.initialDir ? it.initialDir() : (path && path.includes('/') ? path.replace(/\/[^/]+$/, '') : '');
        FileBrowser.open(p => it.set(p), { root, rootLabel: root, type: it.fileType || 'image', initialDir });
      }));
      if (path && it.removable) {
        const rm = el('button', 'pp-iconbtn');
        rm.type = 'button'; rm.title = 'Retirer'; rm.setAttribute('aria-label', 'Retirer');
        rm.innerHTML = svgIcon('M6 6l12 12M18 6L6 18', 13);
        rm.addEventListener('click', () => it.set(null));
        val.appendChild(rm);
      }
    },

    // Deux nombres (px) sur une ligne, chacun précédé d'une flèche qui dit
    // sur quel côté il agit : marges intérieure (↕ ↔) et extérieure (↑ ↓).
    pair(val, it) {
      [it.a, it.b].forEach(p => {
        const box = el('span', 'pp-pair');
        box.title = p.title;
        box.innerHTML = svgIcon(ARROWS[p.icon], 14);
        const inp = _input('number', null, 'pp-input pp-num');
        inp.min = '0'; inp.max = '300';
        inp.value = p.get();
        inp.setAttribute('aria-label', p.title);
        inp.addEventListener('input', () => p.set(Math.max(0, +inp.value || 0)));
        box.appendChild(inp);
        val.appendChild(box);
      });
    },

    xy(val, it) {
      [['X', 'Position horizontale', it.getX, it.setX], ['Y', 'Position verticale', it.getY, it.setY]].forEach(([l, title, get, set]) => {
        val.appendChild(txt('span', 'pp-xy__label', l));
        const inp = _input('number', null, 'pp-input pp-num');
        inp.value = get();
        inp.setAttribute('aria-label', title);
        inp.addEventListener('input', () => set(+inp.value || 0));
        val.appendChild(inp);
      });
    },

    // Police : familles standard, police personnalisée en cours, ou choix
    // d'un autre fichier du dossier style/.
    font(val, it, id) {
      const cur = it.get();
      const sel = document.createElement('select');
      sel.id = id; sel.className = 'pp-input';
      const options = FONT_CHOICES.slice();
      if (cur.fontFile) options.push(['file:' + cur.fontFile, cur.fontFile.split('/').pop() + ' (votre police)']);
      else if (cur.font && !FONT_CHOICES.some(([v]) => v === cur.font)) options.push([cur.font, cur.font]);
      options.push(['__pick', 'Autre police (dossier style/)…']);
      const selected = cur.fontFile ? 'file:' + cur.fontFile : (cur.font || '');
      options.forEach(([v, l]) => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = l;
        if (v === selected) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        const v = sel.value;
        if (v === '__pick') {
          sel.value = selected;
          FileBrowser.open(path => it.set(null, path), { root: 'style', rootLabel: 'style', type: 'font' });
        } else if (v.startsWith('file:')) {
          it.set(null, v.slice(5));
        } else {
          it.set(v || null, null);
        }
      });
      val.appendChild(sel);
    },
  };

  function _iconBtn(title, path, onClick, on) {
    const b = el('button', 'pp-iconbtn' + (on ? ' pp-iconbtn--on' : ''));
    b.type = 'button'; b.title = title;
    b.setAttribute('aria-label', title);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.innerHTML = svgIcon(path);
    b.addEventListener('click', onClick);
    return b;
  }

  /**
   * Le même widget pour tous les textes du site (titre du site, textes des
   * blocs de l'accueil, titres de page et de section, blocs TEXTE) :
   * Police / Taille / Couleur (/ Alignement).
   * `t.get(key)` / `t.set(patch)`, avec key ∈ font, fontFile, size, color, align.
   */
  function textRows(t, opts) {
    opts = opts || {};
    return [
      { type: 'font', label: 'Police', get: () => ({ font: t.get('font'), fontFile: t.get('fontFile') }), set: (font, fontFile) => t.set({ font, fontFile }) },
      { type: 'range', label: 'Taille', min: opts.sizeMin || 10, max: opts.sizeMax || 100, unit: ' px', get: () => t.get('size'), set: v => t.set({ size: v }) },
      { type: 'color', label: 'Couleur', get: () => t.get('color'), set: v => t.set({ color: v }) },
      opts.align && { type: 'icons', label: 'Alignement', options: ALIGN_OPTIONS, get: () => t.get('align') || 'left', set: v => t.set({ align: v }) },
    ];
  }

  /** Lignes Couleur + Opacité d'un remplissage (#rrggbbaa). */
  function fillRows(get, set) {
    return [
      { type: 'color', label: 'Couleur', get, set },
      { type: 'opacity', label: 'Opacité', get, set },
    ];
  }

  /** Marges intérieure (haut/bas, gauche/droite) et extérieure (au-dessus,
   *  au-dessous) d'un titre ; `get(key)`/`set(key, v)` sur padY, padX, mTop, mBottom. */
  function spacingRows(get, set, opts) {
    opts = opts || {};
    return [
      { type: 'pair', label: 'Intérieure',
        a: { icon: 'v', title: 'Marge intérieure en haut et en bas (px)', get: () => get('padY'), set: v => set('padY', v) },
        b: { icon: 'h', title: 'Marge intérieure à gauche et à droite (px)', get: () => get('padX'), set: v => set('padX', v) } },
      !opts.innerOnly && { type: 'pair', label: 'Extérieure',
        a: { icon: 'up', title: 'Espace au-dessus (px)', get: () => get('mTop'), set: v => set('mTop', v) },
        b: { icon: 'down', title: 'Espace au-dessous (px)', get: () => get('mBottom'), set: v => set('mBottom', v) } },
    ];
  }

  return { render, textRows, fillRows, spacingRows, button, svgIcon, ALIGN_OPTIONS };
})();
