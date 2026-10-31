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

/** true si le chemin désigne une vidéo (mêmes extensions que videoExtensions() côté serveur). */
function isVideoPath(path) {
  return /\.(mp4|m4v|webm|ogv|mov)$/i.test(path || '');
}

/** true si le chemin désigne un audio (mêmes extensions que audioExtensions() côté serveur). */
function isAudioPath(path) {
  return /\.(mp3|m4a|ogg|oga|wav)$/i.test(path || '');
}

// ── Couleurs #rrggbbaa (éditeurs de style) ───────────────────────────────────

function normalizeHex8(hex) {
  if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) return hex + 'ff';
  if (typeof hex === 'string' && /^#[0-9a-fA-F]{8}$/.test(hex)) return hex;
  return '#000000ff';
}
function pctToHex2(pct) {
  return Math.max(0, Math.min(255, Math.round(pct / 100 * 255))).toString(16).padStart(2, '0');
}

// Décalage appliqué à l'affichage (lecture + éditeur) des images de la page
// d'accueil : les coordonnées x/y stockées peuvent être négatives (sites
// migrés depuis _moule, dont le référentiel d'origine n'était pas borné à
// gauche/en haut) ; ce décalage ne change que le rendu CSS, jamais la donnée.
const CANVAS_ORIGIN_X = 200;
const CANVAS_ORIGIN_Y = 100;
