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

// Décalage appliqué à l'affichage (lecture + éditeur) des images de la page
// d'accueil : les coordonnées x/y stockées peuvent être négatives (sites
// migrés depuis _moule, dont le référentiel d'origine n'était pas borné à
// gauche/en haut) ; ce décalage ne change que le rendu CSS, jamais la donnée.
const CANVAS_ORIGIN_X = 200;
const CANVAS_ORIGIN_Y = 100;
