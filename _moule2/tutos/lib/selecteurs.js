'use strict';

// ── Tous les éléments de l'éditeur visés par les scénarios ──────────────────
// Seul fichier à corriger si l'interface change (libellé, classe, structure) :
// les scénarios n'utilisent que les noms ci-dessous. On vise de préférence ce
// que l'utilisateur voit (libellés, aria-label) plutôt que la structure.

module.exports = function selecteurs(page) {
  const barre = page.locator('.st-sidebar');
  const exact = texte => new RegExp('^\\s*' + texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');
  /** Corps du groupe repliable du panneau (« Remplissage », « Texte »…). */
  const groupe = nom => barre.locator('.pp-group', { hasText: exact(nom) }).locator('xpath=following-sibling::div[1]');
  const dans = g => (g ? groupe(g) : barre);

  return {
    // Site en lecture
    crayon: page.getByRole('button', { name: 'Édition', exact: true }),
    menu: libelle => page.locator('.m2-editmenu__item', { hasText: libelle }),

    // Cadre commun des éditeurs
    barreEdition: barre,
    pageEditee: page.locator('.st-page'),
    enregistrer: barre.getByRole('button', { name: 'Enregistrer', exact: true }),
    statut: texte => barre.locator('.st-status__text', { hasText: texte }),
    outil: libelle => barre.locator('.st-status').getByRole('button', { name: libelle, exact: true }),

    // Panneau de propriétés. `groupe` lève l'ambiguïté quand un même libellé
    // (« Couleur », « Taille »…) apparaît dans plusieurs groupes.
    groupe,
    ligne: (libelle, g) => dans(g).locator('.pp-row', { has: page.locator('.pp-row__label', { hasText: exact(libelle) }) }),
    champ: (libelle, g) => dans(g).getByLabel(libelle, { exact: true }),
    hex: (libelle, g) => dans(g).getByLabel(libelle + ' (code hexadécimal)', { exact: true }),
    margeHautBas: g => dans(g).getByLabel('Marge intérieure en haut et en bas (px)', { exact: true }),
    bouton: libelle => barre.locator('.st-panel').getByRole('button', { name: libelle, exact: true }),
    couleurDuSite: hex => page.locator('.pp-palette').getByRole('button', { name: hex, exact: true }),

    // Éditeur de l'accueil
    entete: page.locator('.st-page .m2-header'),
    titreSite: page.locator('.st-page .m2-header__title'),
    blocAccueil: texte => page.locator('.st-page .m2-thumb', { hasText: texte }),
    dernierBlocAccueil: page.locator('.st-page .m2-thumb').last(),   // le bloc qu'on vient d'ajouter

    // Boutons à plusieurs choix (« Colonnes » : 1 2 3 4…)
    segment: (libelle, valeur, g) => dans(g).locator('.pp-row', { has: page.locator('.pp-row__label', { hasText: exact(libelle) }) })
      .getByRole('button', { name: valeur, exact: true }),
    quitter: barre.getByRole('button', { name: "Quitter l'édition", exact: true }),
    sousTitreEditeur: barre.locator('.st-top__titles'),

    // Pages de contenu (éditeur de page, page d'exemple du style des pages)
    titrePage: page.locator('.st-page .m2-page__title'),
    titrePageLue: page.locator('.m2-page__title').first(),   // hors de l'éditeur
    titreSection: texte => page.locator('.st-page .m2-section__titre', { hasText: texte }),
    texteDePage: texte => page.locator('.st-page .m2-bloc-texte', { hasText: texte }),
    imageDePage: nom => page.locator('.st-page .m2-bloc-image img[src*="' + nom + '"]'),
    outilFlottant: libelle => page.getByRole('button', { name: libelle, exact: true }),
    poignee: page.locator('.st-tool--grip'),
    bordImage: page.locator('.st-handle'),
    menuAjout: libelle => page.locator('.st-menu__item', { hasText: exact(libelle) }),
    nouvelleSection: page.locator('.st-pill', { hasText: 'Nouvelle section' }),
    colonneVide: page.locator('.st-emptycol').first(),
    pageVide: page.locator('.st-empty-page'),

    // Plan du site
    planListe: page.locator('.pl-tree'),
    planDeplier: nom => page.getByRole('button', { name: 'Déplier ' + nom, exact: true }),
    planLigne: nom => page.locator('.pl-row', { has: page.locator('.pl-row__label', { hasText: exact(nom) }) }),
    planPage: nom => page.locator('.pl-row__main', { has: page.locator('.pl-row__label', { hasText: exact(nom) }) }),
    planPoignee: nom => page.locator('.pl-row', { has: page.locator('.pl-row__label', { hasText: exact(nom) }) }).locator('.pl-grip'),
    planNouvellePage: page.locator('.pl-toolbar .pp-btn').first(),
    planChamp: libelle => page.locator('.pl-details').getByLabel(libelle, { exact: true }),
    planAdresse: page.locator('.pl-url'),
    planBouton: libelle => page.locator('.pl').getByRole('button', { name: libelle, exact: true }),
    planEnregistrer: page.locator('.pl-top .st-save'),
    planStatut: texte => page.locator('.pl-top .st-status__text', { hasText: texte }),

    // Explorateur de fichiers
    fichier: nom => page.locator('.imgbr-item--file', { hasText: nom }),
  };
};
