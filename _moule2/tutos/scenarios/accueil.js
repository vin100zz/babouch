'use strict';

// Tutoriel : modifier la page d'accueil (titre, en-tête, fond, blocs).

module.exports = {
  titre: "Comment éditer la page d'accueil ?",
  depart: '',
  etapes: [
    {
      dire: 'Cliquez sur le crayon, puis sur « Modifier cette page ».',
      faire: async (t, S) => {
        await t.cliquer(S.crayon);
        await t.cliquer(S.menu('Modifier cette page'));
      },
    },
    {
      dire: "À gauche, les réglages. À droite, votre page telle qu'elle sera publiée.",
      faire: async (t, S) => {
        await t.eclairer(S.barreEdition);
        await t.eclairer(S.pageEditee);
      },
    },
    {
      dire: "Cliquez sur le titre, l'en-tête, le fond ou un bloc : ses réglages s'affichent à gauche.",
      faire: async (t, S) => {
        await t.cliquer(S.titreSite);
        await t.pause(700);
        await t.cliquer(S.entete, { x: 70 });
        await t.pause(700);
        await t.cliquer(S.pageEditee, { x: 120, y: 260 });
        await t.pause(700);
        await t.cliquer(S.blocAccueil('Leur jeunesse'));
      },
    },
    {
      dire: 'Le titre : son texte, sa police, sa taille, sa couleur.',
      faire: async (t, S) => {
        await t.cliquer(S.titreSite);
        await t.choisir(S.champ('Police', 'Texte'), 'Georgia');
        await t.regler(S.champ('Taille', 'Texte'), 64);
        await t.couleur(S.champ('Couleur', 'Texte'), S.couleurDuSite('#cccccc'));
      },
    },
    {
      dire: "L'en-tête : la couleur et l'opacité de son fond, son image, ses marges.",
      faire: async (t, S) => {
        await t.cliquer(S.entete, { x: 70 });
        await t.couleur(S.champ('Couleur', 'Remplissage'), S.couleurDuSite('#011a44'));
        await t.regler(S.champ('Opacité', 'Remplissage'), 85);
        await t.saisir(S.margeHautBas('Marges'), '24');
      },
    },
    {
      dire: 'Le fond de la page : une couleur, ou une image.',
      faire: async (t, S) => {
        await t.cliquer(S.pageEditee, { x: 120, y: 260 });
        await t.saisir(S.hex('Couleur', 'Remplissage'), '#f3ead8');
        await t.eclairer(S.groupe('Image de fond'));
      },
    },
    {
      dire: 'Un bloc : son image, son texte et la page vers laquelle il mène.',
      faire: async (t, S) => {
        await t.cliquer(S.blocAccueil('Leur jeunesse'));
        await t.saisir(S.champ('Texte', 'Contenu'), 'Leur enfance');
        await t.eclairer(S.ligne('Lien vers', 'Contenu'));
      },
    },
    {
      dire: 'Son texte a aussi sa police, sa taille et sa couleur.',
      faire: async (t, S) => {
        await t.choisir(S.champ('Police', 'Texte'), 'Georgia');
        await t.regler(S.champ('Taille', 'Texte'), 20);
        // Une couleur absente du site se tape en code : elle rejoint aussitôt
        // la palette (reprise plus loin pour la multisélection).
        await t.saisir(S.hex('Couleur', 'Texte'), '#b3261e');
      },
    },
    {
      dire: "Et sa position par rapport à l'image.",
      faire: async (t, S) => {
        await t.saisir(S.champ('Position verticale', 'Texte'), '-38');
        await t.saisir(S.champ('Position horizontale', 'Texte'), '60');
      },
    },
    {
      dire: 'Faites glisser un bloc pour le déplacer.',
      faire: async (t, S) => {
        await t.glisser(S.blocAccueil('Leur enfance'), { dy: -110 });
      },
    },
    {
      dire: '« + Bloc » ajoute un bloc : choisissez son image, puis placez-le.',
      faire: async (t, S) => {
        await t.cliquer(S.outil('+ Bloc'));
        await t.cliquer(S.fichier('vert.png'));
        await t.saisir(S.champ('Texte', 'Contenu'), 'Nos souvenirs');
        await t.glisser(S.dernierBlocAccueil, { dx: -335, dy: 390 });
      },
    },
    {
      dire: 'Plusieurs blocs à la fois : tracez un cadre autour, ou Ctrl + clic sur chacun.',
      faire: async (t, S) => {
        await t.encadrer(S.blocAccueil('Le temps des malheurs'), S.blocAccueil('Leurs descendants'));
        await t.cliquer(S.blocAccueil('Le patron du'), {}, { ctrl: true });
        await t.cliquer(S.blocAccueil('Nos souvenirs'), {}, { ctrl: true });
        await t.eclairer(S.groupe('Disposition'));
        await t.regler(S.champ('Taille', 'Texte'), 20);
        await t.couleur(S.champ('Couleur', 'Texte'), S.couleurDuSite('#b3261e'));
      },
    },
    {
      dire: 'Une erreur ? Ctrl+Z annule. Puis cliquez sur Enregistrer.',
      faire: async (t, S) => {
        await t.cliquer(S.pageEditee, { x: 120, y: 260 });   // désélectionne les blocs
        await t.cliquer(S.blocAccueil('Nos souvenirs'));
        await t.cliquer(S.bouton('Supprimer'));
        await t.touche('Control+Z');
        await t.cliquer(S.enregistrer);
        await S.statut('Enregistré').waitFor();
      },
    },
  ],
};
