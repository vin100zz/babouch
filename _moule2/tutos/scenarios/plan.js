'use strict';

// Tutoriel : modifier le plan du site (rubriques et pages).

module.exports = {
  titre: 'Comment éditer le plan du site ?',
  depart: '',
  etapes: [
    {
      dire: 'Cliquez sur le crayon, puis sur « Plan du site » : il montre toutes vos pages.',
      faire: async (t, S) => {
        await t.cliquer(S.crayon);
        await t.cliquer(S.menu('Plan du site'));
        await t.eclairer(S.planListe);
      },
    },
    {
      dire: 'Un dossier est une rubrique, qui regroupe des pages. Une feuille est une page de contenu.',
      faire: async (t, S) => {
        await t.cliquer(S.planDeplier('Leur jeunesse'));
        await t.eclairer(S.planLigne('Leur jeunesse'));
        await t.eclairer(S.planLigne('Marius'));
      },
    },
    {
      dire: 'Sélectionnez une rubrique, puis « + Nouvelle page ». Donnez-lui un titre à droite.',
      faire: async (t, S) => {
        await t.cliquer(S.planPage('Leur jeunesse'), { x: 120 });
        await t.cliquer(S.planNouvellePage);
        await t.saisir(S.planChamp('Titre de la page'), 'Les vacances');
        await t.eclairer(S.planAdresse);
      },
    },
    {
      dire: 'Glissez la poignée pour déplacer la page, ou choisissez « Déplacer dans ».',
      faire: async (t, S) => {
        // Haut de la ligne « Marie » : la page se place juste avant.
        await t.deposer(S.planPoignee('Les vacances'), S.planLigne('Marie'), { x: 200, y: 5 });
        await t.eclairer(S.planChamp('Déplacer dans'));
      },
    },
    {
      dire: 'Le bouton rouge supprime la page, après confirmation.',
      faire: async (t, S) => {
        await t.eclairer(S.planBouton('Supprimer la page…'));
      },
    },
    {
      dire: 'Enregistrez, puis « Modifier le contenu » pour remplir la nouvelle page.',
      faire: async (t, S) => {
        await t.cliquer(S.planEnregistrer);
        await S.planStatut('Enregistré').waitFor();
        await t.cliquer(S.planBouton('Modifier le contenu'));
        await t.eclairer(S.pageVide);
      },
    },
  ],
};
