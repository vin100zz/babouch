'use strict';

// ── Génération des tutoriels vidéo ─────────────────────────────────────────
//   npm run tutos                 → toutes les vidéos, dans videos/
//   npm run tutos -- accueil      → seulement scenarios/accueil.js
//   npm run tutos:check           → rejoue les scénarios sans filmer ni attendre
//   … -- --voir                   → fenêtre Chrome visible (mise au point)
// Prérequis : Apache sert la racine (TUTOS_URL, par défaut
// http://127.0.0.1/edsa-messites/babouch/) et Google Chrome est installé.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { Tuto } = require('./lib/tuto');
const { Enregistreur } = require('./lib/enregistreur');
const siteDemo = require('./lib/site-demo');
const selecteurs = require('./lib/selecteurs');

const ECRAN = { width: 1280, height: 800 };
const ECHELLE = 1.5;   // vidéo en 1920 × 1200
const DOSSIER_SCENARIOS = path.join(__dirname, 'scenarios');
const DOSSIER_VIDEOS = path.join(__dirname, 'videos');
const MANIFESTE = path.join(DOSSIER_VIDEOS, 'manifest.json');

const args = process.argv.slice(2);
const verifier = args.includes('--check');
const voir = args.includes('--voir');
const demandes = args.filter(a => !a.startsWith('--'));

function versionMoteur() {
  const gabarit = fs.readFileSync(path.join(__dirname, '..', 'src', 'site-template.php'), 'utf8');
  const m = gabarit.match(/\$version\s*=\s*(\d+)/);
  return m ? +m[1] : null;
}

function scenarios() {
  const tous = fs.readdirSync(DOSSIER_SCENARIOS).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3));
  const inconnus = demandes.filter(n => !tous.includes(n));
  if (inconnus.length) throw new Error('Scénario inconnu : ' + inconnus.join(', ') + ' (disponibles : ' + tous.join(', ') + ')');
  return (demandes.length ? demandes : tous).map(nom => ({ nom, ...require(path.join(DOSSIER_SCENARIOS, nom)) }));
}

async function tourner(navigateur, sc, version) {
  const url = siteDemo.reinitialiser();
  const contexte = await navigateur.newContext({
    viewport: ECRAN, deviceScaleFactor: verifier ? 1 : ECHELLE, locale: 'fr-FR',
  });
  const page = await contexte.newPage();
  page.setDefaultTimeout(10000);
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => console.warn('  ! erreur JS dans la page : ' + e.message));
  await page.addInitScript({ path: path.join(__dirname, 'lib', 'calque.js') });
  await page.goto(url + '#/' + sc.depart, { waitUntil: 'networkidle' });
  await page.locator('.m2-header').first().waitFor();

  const t = new Tuto(page, { rapide: verifier });
  const S = selecteurs(page);
  let enregistreur = null;
  try {
    if (!verifier) {
      enregistreur = new Enregistreur(page, path.join(DOSSIER_VIDEOS, '.images-' + sc.nom));
      await enregistreur.demarrer();
    }
    await t.jouer(sc, S);
    if (enregistreur) {
      await enregistreur.arreter();
      const mp4 = path.join(DOSSIER_VIDEOS, sc.nom + '.mp4');
      const duree = await enregistreur.encoder(mp4, { titre: sc.titre, commentaire: 'Éditeur _moule2 v' + version });
      return duree;
    }
  } finally {
    await contexte.close();
  }
  return null;
}

(async () => {
  const liste = scenarios();
  const version = versionMoteur();
  const navigateur = await chromium.launch({ channel: 'chrome', headless: !voir });
  const manifeste = fs.existsSync(MANIFESTE) ? JSON.parse(fs.readFileSync(MANIFESTE, 'utf8')) : {};
  let echecs = 0;
  try {
    for (const sc of liste) {
      process.stdout.write((verifier ? 'Vérification ' : 'Tournage ') + sc.nom + '… ');
      const debut = Date.now();
      try {
        const duree = await tourner(navigateur, sc, version);
        if (duree != null) {
          manifeste[sc.nom] = { titre: sc.titre, versionMoteur: version, date: new Date().toISOString().slice(0, 10), duree: Math.round(duree) };
          console.log('ok, ' + Math.round(duree) + ' s → videos/' + sc.nom + '.mp4');
        } else {
          console.log('ok (' + ((Date.now() - debut) / 1000).toFixed(1) + ' s)');
        }
      } catch (e) {
        echecs++;
        console.log('ÉCHEC');
        console.error('  ' + e.message.split('\n')[0]);
      }
    }
  } finally {
    await navigateur.close();
    siteDemo.supprimer();
  }
  if (!verifier) fs.writeFileSync(MANIFESTE, JSON.stringify(manifeste, null, 2) + '\n');
  if (echecs) {
    console.error(echecs + ' scénario(s) en échec : corriger lib/selecteurs.js ou le scénario.');
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(1); });
