'use strict';

// Tutoriel : modifier une page de contenu (texte, documents, sections).

module.exports = {
  titre: 'Comment éditer une page ?',
  depart: '1_jeunesse/1_fmp',
  etapes: [
    {
      dire: 'Ouvrez la page à modifier, puis cliquez sur le crayon et « Modifier cette page ».',
      faire: async (t, S) => {
        await t.cliquer(S.crayon);
        await t.cliquer(S.menu('Modifier cette page'));
      },
    },
    {
      dire: "Cliquez dans un texte pour l'écrire. Sa petite barre met en gras, en italique, aligne.",
      faire: async (t, S) => {
        const texte = S.texteDePage('naît à Marseille');
        await t.cliquer(await t.mot(texte, 'archives.', 'fin'));
        await t.page.keyboard.press('End');
        await t.page.keyboard.type(' Il grandit près du Vieux-Port.', { delay: t.rapide ? 0 : 85 });
        await t.pause(300);
        await t.doubleCliquer(await t.mot(texte, 'Marseille'));
        await t.cliquer(S.outilFlottant('Gras'));
        await t.doubleCliquer(await t.mot(texte, 'registre'));
        await t.cliquer(S.outilFlottant('Italique'));
      },
    },
    {
      dire: 'À gauche, ses réglages : police, taille, couleur.',
      faire: async (t, S) => {
        await t.choisir(S.champ('Police', 'Texte'), 'Georgia');
        await t.regler(S.champ('Taille', 'Texte'), 19);
        await t.saisir(S.hex('Couleur', 'Texte'), '#7f1d1d');
      },
    },
    {
      dire: 'Le + sous un élément ajoute un texte, une image, une vidéo ou un son.',
      faire: async (t, S) => {
        await t.cliquer(S.outilFlottant('Ajouter un élément en dessous'));
        await t.cliquer(S.menuAjout('Image, vidéo, son'));
      },
    },
    {
      dire: 'Choisissez le fichier parmi les documents du site.',
      faire: async (t, S) => {
        await t.cliquer(S.fichier('acte-de-naissance.jpg'));
      },
    },
    {
      dire: 'Glissez la poignée pour déplacer un élément, et son coin pour changer sa taille.',
      faire: async (t, S) => {
        await t.deposer(S.poignee, S.imageDePage('registre.jpg'), { y: 30 });
        await t.glisser(S.bordImage, { dx: -90 });
      },
    },
    {
      dire: "Une page est faite de sections, d'une à quatre colonnes.",
      faire: async (t, S) => {
        await t.cliquer(S.titreSection('1849'));
        await t.cliquer(S.nouvelleSection);
        await t.saisir(S.champ('Titre', 'Section'), 'Les témoins');
        await t.cliquer(S.segment('Colonnes', '3', 'Section'));
        await t.eclairer(S.colonneVide);
      },
    },
    {
      dire: 'Cliquez sur Enregistrer pour publier la page.',
      faire: async (t, S) => {
        await t.cliquer(S.enregistrer);
        await S.statut('Enregistré').waitFor();
      },
    },
  ],
};
