'use strict';

// ── Utilitaires DOM ──────────────────────────────────────────────────────────

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function txt(tag, className, content) {
  const e = el(tag, className);
  if (content != null) e.textContent = content;
  return e;
}

function clone(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

function uid(prefix) {
  return (prefix || 'id_') + Math.random().toString(36).slice(2, 10);
}

// ── Champs de formulaire partagés (éditeurs de style) ────────────────────────

function normalizeHex8(hex) {
  if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) return hex + 'ff';
  if (typeof hex === 'string' && /^#[0-9a-fA-F]{8}$/.test(hex)) return hex;
  return '#000000ff';
}
function pctToHex2(pct) {
  return Math.max(0, Math.min(255, Math.round(pct / 100 * 255))).toString(16).padStart(2, '0');
}

/** Champ couleur + curseur de transparence, combinés en une valeur
 *  #rrggbbaa. Le <input type=color> natif ne gère pas l'alpha : on le
 *  pilote séparément via un curseur et on recompose la chaîne à chaque
 *  changement. */
function buildColorAlphaField(labelText, getValue, onChange) {
  const wrap = el('div', 'ed-field');
  wrap.appendChild(txt('label', 'ed-label', labelText));
  const row = el('div', 'ed-color-alpha-row');

  const hex8 = normalizeHex8(getValue());
  const colorInp = document.createElement('input');
  colorInp.type = 'color'; colorInp.className = 'ed-input ed-input--color';
  colorInp.value = hex8.slice(0, 7);

  // Code hexa visible et modifiable directement, en plus du sélecteur natif
  // (qui ne l'affiche pas de façon lisible/éditable en ligne).
  const hexInp = document.createElement('input');
  hexInp.type = 'text'; hexInp.className = 'ed-input ed-input--hex';
  hexInp.maxLength = 7; hexInp.spellcheck = false; hexInp.autocomplete = 'off';
  hexInp.value = colorInp.value;

  const alphaInp = document.createElement('input');
  alphaInp.type = 'range'; alphaInp.min = '0'; alphaInp.max = '100'; alphaInp.className = 'ed-alpha-range';
  alphaInp.value = String(Math.round(parseInt(hex8.slice(7, 9), 16) / 255 * 100));

  const alphaVal = txt('span', 'ed-alpha-val', alphaInp.value + '%');

  function emit() {
    alphaVal.textContent = alphaInp.value + '%';
    onChange(colorInp.value + pctToHex2(+alphaInp.value));
  }
  colorInp.addEventListener('input', () => { hexInp.value = colorInp.value; emit(); });
  hexInp.addEventListener('input', () => {
    let v = hexInp.value.trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { colorInp.value = v; emit(); }
  });
  hexInp.addEventListener('blur', () => { hexInp.value = colorInp.value; });
  alphaInp.addEventListener('input', emit);

  row.appendChild(colorInp);
  row.appendChild(hexInp);
  row.appendChild(alphaInp);
  row.appendChild(alphaVal);
  wrap.appendChild(row);
  return wrap;
}

/** Champ nombre générique, ajouté directement au popup fourni. */
function buildNumberField(popup, labelText, value, min, max, onChange) {
  const f = el('div', 'ed-field');
  f.appendChild(txt('label', 'ed-label', labelText));
  const inp = document.createElement('input');
  inp.type = 'number'; inp.className = 'ed-input'; inp.min = String(min); inp.max = String(max);
  inp.value = value;
  inp.addEventListener('input', () => onChange((+inp.value) || 0));
  f.appendChild(inp);
  popup.appendChild(f);
}

// Décalage appliqué à l'affichage (lecture + éditeur) des images de la page
// d'accueil : les coordonnées x/y stockées peuvent être négatives (sites
// migrés depuis _moule, dont le référentiel d'origine n'était pas borné à
// gauche/en haut) ; ce décalage ne change que le rendu CSS, jamais la donnée.
const CANVAS_ORIGIN_X = 200;
const CANVAS_ORIGIN_Y = 100;
