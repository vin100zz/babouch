'use strict';

// Tutoriel : modifier le style des pages (apparence commune à toutes les
// pages de contenu, réglée sur une page d'exemple).

module.exports = {
  titre: 'Comment éditer le style des pages ?',
  depart: '1_jeunesse/1_fmp',
  etapes: [
    {
      dire: "Le style des pages s'applique à toutes les pages du site, sauf l'accueil.",
      faire: async (t, S) => {
        await t.cliquer(S.crayon);
        await t.cliquer(S.menu('Style des pages'));
      },
    },
    {
      dire: "Vous travaillez sur une page d'exemple : elle n'est jamais publiée.",
      faire: async (t, S) => {
        await t.eclairer(S.sousTitreEditeur);
        await t.eclairer(S.pageEditee);
      },
    },
    {
      dire: 'Cliquez sur un élément, ici le titre de la page, puis changez sa couleur.',
      faire: async (t, S) => {
        await t.cliquer(S.titrePage);
        // Une couleur absente du site se tape en code ; elle rejoint aussitôt
        // la palette (reprise à l'étape suivante).
        await t.saisir(S.hex('Couleur', 'Remplissage'), '#7f1d1d');
      },
    },
    {
      dire: 'Chaque élément a ses réglages : police, taille, bordure, marges.',
      faire: async (t, S) => {
        await t.choisir(S.champ('Police', 'Texte'), 'Georgia');
        await t.regler(S.champ('Taille', 'Texte'), 40);
        await t.regler(S.champ('Arrondi', 'Bordure'), 18);
        await t.saisir(S.margeHautBas('Marges'), '36');
      },
    },
    {
      dire: 'Même principe pour les titres de section, les textes et les images.',
      faire: async (t, S) => {
        await t.cliquer(S.titreSection('Une section à deux colonnes'));
        await t.couleur(S.champ('Couleur', 'Remplissage'), S.couleurDuSite('#7f1d1d'));
        await t.cliquer(S.texteDePage('Lorem ipsum'), { x: 120, y: 40 });
        await t.regler(S.champ('Arrondi', 'Bordure'), 14);
        await t.cliquer(S.imageDePage('svg').first());
        await t.regler(S.champ('Épaisseur', 'Bordure'), 4);
        await t.regler(S.champ('Arrondi', 'Bordure'), 24);
      },
    },
    {
      dire: 'Enregistrez : toutes les pages prennent le nouveau style.',
      faire: async (t, S) => {
        await t.cliquer(S.enregistrer);
        await S.statut('Enregistré').waitFor();
        await t.cliquer(S.quitter);
        await t.eclairer(S.titrePageLue);
      },
    },
  ],
};
