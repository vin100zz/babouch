'use strict';

// ── Cadre commun des éditeurs (accueil, style des pages, page de contenu) ──
// Barre d'édition fixe à gauche (Quitter / Enregistrer, annuler / rétablir,
// propriétés de la sélection) et, à droite, la page rendue exactement comme
// en lecture. Survol et sélection sont dessinés dans un calque superposé :
// aucun outil d'édition n'est inséré dans la page, son rendu reste identique.

const Studio = (function () {

  const UNDO_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>';
  const REDO_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></svg>';
  const CLOSE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  /** Vrai si la cible clavier est un champ de saisie (les raccourcis de
   *  l'éditeur ne doivent alors pas intercepter la frappe). */
  function isTyping(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  /**
   * opts :
   *   container               → élément où monter l'éditeur (#m2-root)
   *   title, subtitle         → en-tête de la barre d'édition
   *   snapshot() / restore(s) → état sérialisé, pour annuler / rétablir
   *   save()                  → Promise du site enregistré
   *   onPick(id, event)       → clic dans la page (id suivi le plus proche, ou null)
   *   onClose(site|null)      → fermeture (site enregistré, s'il l'a été)
   *   onFrame()               → à chaque image : position des outils flottants
   *   onKey(event)            → touches hors champ de saisie
   *   tools                   → boutons de la barre d'état [{label, onClick}]
   */
  function open(opts) {
    const container = opts.container;
    container.innerHTML = '';
    document.body.classList.add('m2-editing');

    // ── Barre d'édition ──
    const sidebar = el('aside', 'st-sidebar');
    sidebar.setAttribute('aria-label', "Barre d'édition");

    const top = el('div', 'st-top');
    const quitBtn = el('button', 'st-quit');
    quitBtn.type = 'button'; quitBtn.title = "Quitter l'édition";
    quitBtn.setAttribute('aria-label', "Quitter l'édition");
    quitBtn.innerHTML = CLOSE_SVG;
    const titles = el('div', 'st-top__titles');
    titles.appendChild(txt('div', 'st-top__sub', opts.subtitle || ''));
    titles.appendChild(txt('div', 'st-top__title', opts.title || ''));
    const saveBtn = txt('button', 'st-save', 'Enregistrer');
    saveBtn.type = 'button';
    top.appendChild(quitBtn); top.appendChild(titles); top.appendChild(saveBtn);
    sidebar.appendChild(top);

    const status = el('div', 'st-status');
    const dot = el('span', 'st-status__dot');
    const statusText = el('span', 'st-status__text');
    status.appendChild(dot); status.appendChild(statusText);
    (opts.tools || []).forEach(t => {
      const b = txt('button', 'pp-btn pp-btn--sm', t.label);
      b.type = 'button';
      b.addEventListener('click', t.onClick);
      status.appendChild(b);
    });
    const undoBtn = el('button', 'st-iconbtn');
    undoBtn.type = 'button'; undoBtn.title = 'Annuler (Ctrl+Z)'; undoBtn.setAttribute('aria-label', 'Annuler la dernière modification');
    undoBtn.innerHTML = UNDO_SVG;
    const redoBtn = el('button', 'st-iconbtn');
    redoBtn.type = 'button'; redoBtn.title = 'Rétablir (Ctrl+Y)'; redoBtn.setAttribute('aria-label', 'Rétablir');
    redoBtn.innerHTML = REDO_SVG;
    status.appendChild(undoBtn); status.appendChild(redoBtn);
    sidebar.appendChild(status);

    const selTitle = el('div', 'st-seltitle');
    sidebar.appendChild(selTitle);
    const panel = el('div', 'st-panel');
    sidebar.appendChild(panel);
    container.appendChild(sidebar);

    // ── Page + calque des outils ──
    const page = el('div', 'st-page');
    container.appendChild(page);
    const layer = el('div', 'st-layer');
    document.body.appendChild(layer);

    // ── Historique (annuler / rétablir) ──
    const undoStack = [], redoStack = [];
    let lastKey = null, lastAt = 0, dirty = false, savedSite = null, closed = false;

    function _push(snap, key) {
      undoStack.push(snap);
      if (undoStack.length > 200) undoStack.shift();
      redoStack.length = 0;
      lastKey = key || null; lastAt = Date.now();
      _setDirty();
    }
    /** À appeler AVANT une modification. Les appels successifs d'une même
     *  clé (curseur qu'on fait glisser, frappe dans un champ) ne prennent
     *  qu'un instantané : un seul « Annuler » défait tout le geste. */
    function record(key) {
      if (key && key === lastKey && Date.now() - lastAt < 1200) { lastAt = Date.now(); _setDirty(); return; }
      _push(opts.snapshot(), key);
    }
    function recordSnapshot(snap, key) { _push(snap, key); }
    function undo() {
      if (!undoStack.length) return;
      redoStack.push(opts.snapshot());
      opts.restore(undoStack.pop());
      lastKey = null;
      _setDirty();
    }
    function redo() {
      if (!redoStack.length) return;
      undoStack.push(opts.snapshot());
      opts.restore(redoStack.pop());
      lastKey = null;
      _setDirty();
    }
    function _setDirty() { dirty = true; _status(); }
    function _status(text, kind) {
      if (!text) { text = dirty ? 'Non enregistré' : (savedSite ? 'Enregistré' : 'Aucune modification'); kind = dirty ? 'dirty' : (savedSite ? 'ok' : ''); }
      statusText.textContent = text;
      dot.className = 'st-status__dot' + (kind ? ' st-status__dot--' + kind : '');
      saveBtn.disabled = !dirty;
      undoBtn.disabled = !undoStack.length;
      redoBtn.disabled = !redoStack.length;
    }

    async function save() {
      if (!dirty) return;
      saveBtn.disabled = true;
      _status('Enregistrement…', 'dirty');
      try {
        savedSite = await opts.save();
        dirty = false;
        _status();
      } catch (e) {
        _status("Erreur d'enregistrement", 'error');
        saveBtn.disabled = false;
        alert('Erreur lors de la sauvegarde :\n' + e.message);
      }
    }
    function quit() {
      if (dirty && !confirm('Quitter sans enregistrer ? Vos dernières modifications seront perdues.')) return;
      close();
      opts.onClose(savedSite);
    }
    saveBtn.addEventListener('click', save);
    quitBtn.addEventListener('click', quit);
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);

    // ── Éléments suivis : survol et sélection ──
    let tracked = new Map();   // id → { els: [], label }
    let selection = [];
    let hover = null;

    function track(elm, id, label) {
      if (!elm) return;
      elm.dataset.stId = id;
      let t = tracked.get(id);
      if (!t) { t = { els: [], label: label }; tracked.set(id, t); }
      if (t.els.indexOf(elm) === -1) t.els.push(elm);
      if (label) t.label = label;
    }
    function untrackAll() { tracked = new Map(); }

    page.addEventListener('mouseover', e => {
      const t = e.target.closest('[data-st-id]');
      hover = t && page.contains(t) ? t.dataset.stId : null;
    });
    page.addEventListener('mouseleave', () => { hover = null; });
    page.addEventListener('click', e => {
      // Aucun lien de la page ne doit naviguer pendant l'édition.
      if (e.target.closest('a')) e.preventDefault();
      const t = e.target.closest('[data-st-id]');
      if (opts.onPick) opts.onPick(t && page.contains(t) ? t.dataset.stId : null, e);
    });
    page.addEventListener('submit', e => e.preventDefault());

    // Cadres de survol / sélection, recalculés à chaque image : ils suivent
    // ainsi tout changement de mise en page (image chargée, texte tapé…).
    const boxes = [];
    function _box(i) {
      if (!boxes[i]) {
        const b = el('div', 'st-box');
        b.appendChild(el('span', 'st-box__tag'));
        layer.appendChild(b);
        boxes[i] = b;
      }
      return boxes[i];
    }
    function _drawBoxes() {
      let n = 0;
      const sx = window.scrollX, sy = window.scrollY;
      const draw = (elm, kind, label) => {
        if (!elm.isConnected) return;
        const r = elm.getBoundingClientRect();
        if (!r.width && !r.height) return;
        const b = _box(n++);
        b.className = 'st-box st-box--' + kind;
        b.style.left = (r.left + sx) + 'px';
        b.style.top = (r.top + sy) + 'px';
        b.style.width = r.width + 'px';
        b.style.height = r.height + 'px';
        const tag = b.firstChild;
        tag.textContent = label || '';
        tag.hidden = !label;
        tag.classList.toggle('st-box__tag--inside', r.top + sy < 26);
      };
      selection.forEach(id => {
        const t = tracked.get(id);
        if (t) t.els.forEach((e, i) => draw(e, 'sel', i === 0 ? t.label : ''));
      });
      if (hover && selection.indexOf(hover) === -1) {
        const t = tracked.get(hover);
        if (t) t.els.forEach((e, i) => draw(e, 'hover', i === 0 ? t.label : ''));
      }
      for (let i = n; i < boxes.length; i++) boxes[i].className = 'st-box st-box--off';
    }
    let raf = 0;
    function _frame() {
      if (closed) return;
      _drawBoxes();
      if (opts.onFrame) opts.onFrame();
      raf = requestAnimationFrame(_frame);
    }
    raf = requestAnimationFrame(_frame);

    // ── Clavier ──
    function onKeydown(e) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
      // Échap sort aussi d'un champ (texte en cours d'écriture compris).
      if (e.key === 'Escape') {
        if (isTyping(e.target) && e.target.blur) e.target.blur();
        if (opts.onKey) opts.onKey(e);
        return;
      }
      if (isTyping(e.target)) return;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (opts.onKey) opts.onKey(e);
    }
    function onBeforeUnload(e) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('beforeunload', onBeforeUnload);

    function close() {
      closed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeydown);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (layer.parentNode) layer.parentNode.removeChild(layer);
      document.body.classList.remove('m2-editing');
      container.innerHTML = '';
    }

    _status();

    return {
      page, panel, layer,
      track, untrackAll,
      setSelection(ids) { selection = ids.slice(); },
      getHover() { return hover; },
      setSelTitle(text) { selTitle.textContent = text || ''; },
      record, recordSnapshot, undo, redo, save, quit, close,
      isTyping,
    };
  }

  return { open, isTyping };
})();
