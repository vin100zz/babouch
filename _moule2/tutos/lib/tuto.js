'use strict';

// ── Gestes des scénarios : t.cliquer, t.saisir, t.glisser… ──────────────────
// Chaque geste est fait avec la vraie souris / le vrai clavier de Playwright
// (l'éditeur réagit exactement comme pour un utilisateur), à vitesse humaine.
// En mode « rapide » (npm run tutos:check), les mêmes gestes sont joués sans
// animation ni attente : seul compte le fait qu'ils aboutissent.

// Rythme. Chaque étape commence par son explication, seule au centre de
// l'écran, le temps de la lire ; puis elle reste en sous-titre pendant les
// gestes qui l'illustrent. Les micro-pauses des gestes (avant un clic, après
// une frappe…) laissent voir chaque action sans jamais s'additionner en
// longues immobilités.
const LECTURE_CAR_PAR_S = 15;
const LECTURE_MIN_MS = 2200;
const FONDU_MS = 400;             // apparition / disparition de la carte
const AVANT_GESTES_MS = 350;
const APRES_GESTES_MS = 700;      // le temps de voir le résultat
const TITRE_MS = 2400;

const attendre = ms => new Promise(r => setTimeout(r, ms));
const adoucir = p => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

class Tuto {
  constructor(page, { rapide = false } = {}) {
    this.page = page;
    this.rapide = rapide;
    this.x = 640; this.y = 400;
  }

  /** Pause, ignorée en mode rapide. Avec TUTOS_DEBUG, signale les longues
   *  immobilités (image figée dans la vidéo). */
  async pause(ms) {
    if (this.rapide) return;
    if (process.env.TUTOS_DEBUG && ms >= 1000) console.log('\n  pause de ' + ms + ' ms (étape ' + this.etape + ')');
    await attendre(ms);
  }

  // ── Déroulé ──

  async jouer(scenario, S) {
    const n = scenario.etapes.length;
    await this.page.mouse.move(this.x, this.y);
    await this._calque('progression', 0, n);
    if (scenario.titre) {
      await this._calque('titre', formater(scenario.titre));
      await this.pause(TITRE_MS);
      await this._calque('masquerTitre');
    }
    for (let i = 0; i < n; i++) {
      const etape = scenario.etapes[i];
      this.etape = i + 1;
      const lecture = Math.round(Math.max(LECTURE_MIN_MS, etape.dire.length / LECTURE_CAR_PAR_S * 1000));
      await this._calque('masquerLegende');
      await this._calque('carte', formater(etape.dire));
      await this.pause(FONDU_MS + lecture);
      await this._calque('masquerCarte');
      await this.pause(FONDU_MS);
      await this._calque('legende', formater(etape.dire), etape.legende || null);
      await this.pause(AVANT_GESTES_MS);
      try {
        await etape.faire(this, S);
      } catch (e) {
        e.message = 'Étape ' + (i + 1) + ' (« ' + etape.dire + ' ») : ' + e.message;
        throw e;
      }
      await this._calque('progression', i + 1, n);
      await this.pause(APRES_GESTES_MS);
      await this._calque('eteindre');
      await this._calque('masquerTouche');
    }
    await this._calque('masquerLegende');
    await this.pause(900);
  }

  // ── Souris ──

  /** Amène le curseur au centre de l'élément (ou au point {x, y}). */
  async viser(cible, decalage = {}) {
    let x, y;
    if (cible && typeof cible.boundingBox === 'function') {
      await cible.waitFor({ state: 'visible' });
      const b = await this._defiler(cible, decalage);
      x = b.x + (decalage.x != null ? decalage.x : b.width / 2);
      y = b.y + (decalage.y != null ? decalage.y : b.height / 2);
    } else {
      ({ x, y } = cible);
    }
    await this._deplacer(x, y);
    return { x, y };
  }

  /** Fait défiler la page, en douceur, jusqu'au point visé de l'élément
   *  s'il est hors de l'écran ; renvoie la boîte de l'élément. */
  async _defiler(cible, decalage = {}) {
    const b = await cible.boundingBox();
    const y = b.y + (decalage.y != null ? decalage.y : b.height / 2);
    const h = this.page.viewportSize().height;
    if (y >= 20 && y <= h - 20 && b.y + Math.min(b.height, 60) <= h) return b;
    if (this.rapide) await cible.scrollIntoViewIfNeeded();
    else {
      await cible.evaluate(e => e.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await this.pause(800);
    }
    return cible.boundingBox();
  }

  /** Point d'un mot dans le texte de l'élément : son milieu, ou juste après
   *  sa dernière lettre (`'fin'`, pour y poser le curseur de saisie). */
  async mot(cible, mot, ou = 'milieu') {
    await cible.waitFor({ state: 'visible' });
    await this._defiler(cible);
    const p = await cible.evaluate((el, [mot, ou]) => {
      const it = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = it.nextNode(); n; n = it.nextNode()) {
        const i = n.data.indexOf(mot);
        if (i < 0) continue;
        const r = document.createRange();
        r.setStart(n, i); r.setEnd(n, i + mot.length);
        const rects = r.getClientRects(), q = rects[rects.length - 1];
        return ou === 'fin' ? { x: q.right - 1, y: q.top + q.height / 2 } : { x: q.left + q.width / 2, y: q.top + q.height / 2 };
      }
      return null;
    }, [mot, ou]);
    if (!p) throw new Error('mot « ' + mot + ' » introuvable');
    return p;
  }

  async _deplacer(x, y) {
    const dist = Math.hypot(x - this.x, y - this.y);
    if (this.rapide || dist < 1) {
      await this.page.mouse.move(x, y);
    } else {
      // Position calculée d'après l'horloge, pas d'après un nombre de pas :
      // le geste dure toujours `duree`, même si Chrome répond lentement
      // (il y a alors moins de positions intermédiaires, pas un geste plus long).
      const duree = Math.min(900, Math.max(400, 260 + dist * 0.6));
      const x0 = this.x, y0 = this.y, t0 = Date.now();
      for (;;) {
        const p = Math.min(1, (Date.now() - t0) / duree);
        const e = adoucir(p);
        await this.page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
        if (p >= 1) break;
        await attendre(12);
      }
    }
    this.x = x; this.y = y;
  }

  /** Clic ; `{ ctrl: true }` : Ctrl + clic, affiché dans une pastille. */
  async cliquer(cible, decalage, { ctrl = false } = {}) {
    await this.viser(cible, decalage);
    if (ctrl) {
      await this._calque('touche', '<kbd>Ctrl</kbd> + clic');
      await this.page.keyboard.down('Control');
    }
    await this.pause(200);
    await this.page.mouse.down();
    await this.pause(90);
    await this.page.mouse.up();
    if (ctrl) await this.page.keyboard.up('Control');
    await this.pause(350);
  }

  /** Double-clic (sélectionne un mot : voir `t.mot`). */
  async doubleCliquer(cible, decalage) {
    const { x, y } = await this.viser(cible, decalage);
    await this.pause(200);
    await this.page.mouse.dblclick(x, y);
    await this.pause(450);
  }

  /** Glisse `cible` jusqu'au point `decalageDest` de `destination` (son
   *  centre par défaut). */
  async deposer(cible, destination, decalageDest = {}, decalage) {
    const { x, y } = await this.viser(cible, decalage);
    const b = await destination.boundingBox();
    const fx = b.x + (decalageDest.x != null ? decalageDest.x : b.width / 2);
    const fy = b.y + (decalageDest.y != null ? decalageDest.y : b.height / 2);
    await this.glisser({ x, y }, { dx: fx - x, dy: fy - y });
  }

  /** Glisse l'élément de (dx, dy) pixels, en le saisissant par son centre. */
  async glisser(cible, { dx = 0, dy = 0 }, decalage) {
    const { x, y } = await this.viser(cible, decalage);
    await this.pause(250);
    await this.page.mouse.down();
    await this.pause(150);
    await this._deplacer(x + dx, y + dy);
    await this.pause(150);
    await this.page.mouse.up();
    await this.pause(300);
  }

  /** Trace un cadre de sélection autour des éléments, en partant du coin
   *  bas-droit (laissé vide sur la page) vers le haut-gauche. */
  async encadrer(...cibles) {
    const boites = await Promise.all(cibles.map(c => c.boundingBox()));
    const vw = this.page.viewportSize().width;
    const droite = Math.min(vw - 8, Math.max(...boites.map(b => b.x + b.width)) + 15);
    const bas = Math.max(...boites.map(b => b.y + b.height)) + 20;
    const gauche = Math.min(...boites.map(b => b.x)) + 40;
    const haut = Math.min(...boites.map(b => b.y)) - 12;
    await this.glisser({ x: droite, y: bas }, { dx: gauche - droite, dy: haut - bas });
  }

  /** Règle un curseur <input type=range> sur `valeur` en tirant sa poignée. */
  async regler(range, valeur) {
    await range.waitFor({ state: 'visible' });
    const { min, max, val } = await range.evaluate(r => ({ min: +r.min, max: +r.max, val: +r.value }));
    const b = await range.boundingBox();
    const pouce = 8; // demi-largeur de la poignée : la piste utile est réduite d'autant
    const px = v => b.x + pouce + (b.width - 2 * pouce) * (v - min) / (max - min);
    await this._deplacer(px(val), b.y + b.height / 2);
    await this.pause(250);
    await this.page.mouse.down();
    await this._deplacer(px(valeur), b.y + b.height / 2);
    await this.page.mouse.up();
    await this.pause(300);
  }

  /** Choisit l'option de libellé `texte` dans un <select>, en montrant une
   *  liste simulée (la liste native n'apparaît pas dans la vidéo). */
  async choisir(select, texte) {
    const { x, y } = await this.viser(select);
    const { options, i } = await select.evaluate((s, t) => {
      const all = [...s.options].map(o => ({ texte: o.textContent, police: o.style.fontFamily }));
      return { options: all, i: all.findIndex(o => o.texte === t) };
    }, texte);
    if (i < 0) throw new Error('option « ' + texte + ' » introuvable');
    if (!this.rapide) {
      await this.pause(250);
      await this._calque('onde', x, y);
      const debut = Math.max(0, Math.min(i - 3, options.length - 7));
      const visibles = options.slice(debut, debut + 7);
      const cible = await this._calque('liste', await select.boundingBox(), visibles, i - debut);
      await this.pause(600);
      await this._deplacer(cible.x, cible.y);
      await this._calque('choisirDansListe', i - debut);
      await this.pause(300);
      await this._calque('onde', cible.x, cible.y);
    }
    await select.selectOption({ label: texte });
    await this._calque('masquerListe');
    await this.pause(350);
  }

  /** Ouvre le sélecteur de couleur et clique sur une pastille de la palette. */
  async couleur(bouton, pastille) {
    await this.cliquer(bouton);
    await this.cliquer(pastille);
  }

  // ── Clavier ──

  /** Clique dans le champ, remplace son contenu et tape `texte` lettre à lettre. */
  async saisir(champ, texte) {
    await this.cliquer(champ);
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.type(texte, { delay: this.rapide ? 0 : 85 });
    await this.pause(300);
  }

  /** Appuie sur un raccourci (« Control+Z ») et l'affiche dans une pastille. */
  async touche(combinaison) {
    const html = combinaison.split('+').map(k => '<kbd>' + (k === 'Control' ? 'Ctrl' : k) + '</kbd>').join(' + ');
    await this._calque('touche', html);
    await this.pause(600);
    // Les raccourcis de l'éditeur sont ignorés pendant la frappe dans un champ.
    await this.page.evaluate(() => document.activeElement && document.activeElement.blur());
    await this.page.keyboard.press(combinaison);
    await this.pause(800);
  }

  // ── Calque ──

  /** Assombrit tout sauf l'élément, le temps d'un coup d'œil (ou jusqu'à la
   *  fin de l'étape avec `{ garder: true }`). */
  async eclairer(cible, { garder = false } = {}) {
    await cible.waitFor({ state: 'visible' });
    const b = await this._defiler(cible);
    await this._calque('eclairer', b);
    await this.pause(1500);
    if (!garder) await this.eteindre();
  }

  async eteindre() { await this._calque('eteindre'); await this.pause(250); }

  async _calque(methode, ...args) {
    return this.page.evaluate(([m, a]) => window.__tuto && window.__tuto[m](...a), [methode, args]);
  }
}

/** Sous-titre : espaces insécables à la française (jamais de retour à la
 *  ligne avant « : » ou dans « … »), touches clavier en pastilles. */
function formater(texte) {
  return texte
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/ ([:;?!»])/g, ' $1').replace(/« /g, '« ')
    .replace(/\b(Ctrl|Maj)\b/g, '<kbd>$1</kbd>')
    .replace(/<kbd>(\w+)<\/kbd>\+(\w)\b/g, '<kbd>$1</kbd> + <kbd>$2</kbd>');
}

module.exports = { Tuto };
