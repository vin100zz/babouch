'use strict';

// ── Site de démonstration filmé ────────────────────────────────────────────
// tutos/site-demo/ (extrait figé de 5a_fmp2) est recopié avant chaque vidéo
// dans <racine>/_tuto_demo/, servi par Apache comme n'importe quel site
// _moule2. Les enregistrements faits pendant le tournage n'atteignent donc
// jamais un vrai site, et chaque prise repart du même contenu.

const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..', '..', '..');   // parent de _moule2
const NOM = '_tuto_demo';
const SOURCE = path.join(__dirname, '..', 'site-demo');
const CIBLE = path.join(RACINE, NOM);

const URL_RACINE = (process.env.TUTOS_URL || 'http://127.0.0.1/edsa-messites/babouch/').replace(/\/?$/, '/');

function reinitialiser() {
  supprimer();
  fs.cpSync(SOURCE, CIBLE, { recursive: true });
  fs.writeFileSync(path.join(CIBLE, 'index.php'),
    "<?php require __DIR__ . '/../_moule2/src/site-template.php';\n");
  return URL_RACINE + NOM + '/';
}

function supprimer() {
  if (path.basename(CIBLE) === NOM) fs.rmSync(CIBLE, { recursive: true, force: true });
}

module.exports = { reinitialiser, supprimer };
