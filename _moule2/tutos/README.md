# Tutoriels vidéo de l'éditeur _moule2

Courtes vidéos sous-titrées (une tâche chacune, indépendantes les unes des
autres), générées en rejouant un scénario sur l'éditeur réel avec Chrome.

| Vidéo | Scénario |
| --- | --- |
| `videos/accueil.mp4` | `scenarios/accueil.js` — modifier la page d'accueil |
| `videos/style.mp4` | `scenarios/style.js` — modifier le style des pages |
| `videos/page.mp4` | `scenarios/page.js` — modifier une page de contenu |
| `videos/plan.mp4` | `scenarios/plan.js` — modifier le plan du site |

## Dans l'éditeur

Menu crayon › « Tutoriels vidéo » : un lecteur en fenêtre
(`src/ui/js/tutorials.js`) ouvert sur la vidéo de la page affichée (accueil,
page de contenu, sinon plan du site), avec les quatre vidéos au choix. Les
fichiers sont lus directement dans `videos/` ; les titres viennent de
`videos/manifest.json`. Les MP4 et leurs aperçus `.jpg` doivent donc être
présents (et committés) pour que le menu fonctionne.

## Régénérer

Prérequis : Node 18+, Google Chrome, Apache servant la racine du dépôt.

```
cd _moule2/tutos
npm install
npm run tutos                  # toutes les vidéos
npm run tutos -- accueil       # une seule
npm run tutos:check            # rejoue les scénarios sans filmer (quelques secondes)
npm run tutos -- accueil --voir   # fenêtre Chrome visible, pour la mise au point
```

L'URL de la racine se change avec `TUTOS_URL` (défaut :
`http://127.0.0.1/edsa-messites/babouch/`).

## Après une modification de l'éditeur

Lancer `npm run tutos:check`. En cas d'échec, le message nomme l'étape :
corriger le sélecteur dans `lib/selecteurs.js` (seul fichier qui connaît la
structure de l'éditeur), ou le scénario si le geste a changé. Si l'apparence
ou le comportement filmé a changé, régénérer la vidéo concernée.
`videos/manifest.json` indique pour chaque vidéo la version du moteur
(`$version` de `src/site-template.php`) au moment du tournage.

## Fonctionnement

- `site-demo/` : extrait figé de 5a_fmp2 (avec une page « Marius » garnie et
  trois documents pour la vidéo « page »), recopié dans `<racine>/_tuto_demo/`
  avant chaque prise puis supprimé. Les enregistrements filmés ne touchent
  aucun vrai site.
- `lib/calque.js` : injecté dans la page pendant le tournage — curseur
  dessiné (Chrome ne filme pas le pointeur), onde de clic, carte de
  lecture, sous-titre,
  projecteur, pastille de raccourci, barre de progression.
- `lib/tuto.js` : gestes des scénarios (`t.cliquer` avec ou sans Ctrl,
  `t.saisir`, `t.glisser`, `t.encadrer` pour un cadre de sélection,
  `t.regler` pour un curseur, `t.choisir` pour une liste, `t.couleur` pour la
  palette, `t.deposer` pour glisser vers un élément, `t.doubleCliquer` et
  `t.mot` pour viser un mot dans un texte, `t.touche`, `t.eclairer`). La
  page défile en douceur jusqu'à un élément hors de l'écran. Les listes `<select>` natives
  n'apparaissant pas dans la capture, `t.choisir` en affiche une copie dans
  le calque. De même, pendant un glisser-déposer natif (plan du site), le
  calque fait suivre au curseur une étiquette du texte glissé. Le `titre` du
  scénario s'affiche en bandeau au début.

## Rythme

Chaque étape s'ouvre sur son explication, seule au centre de l'écran, le
temps de la lire ; elle reste ensuite
en sous-titre pendant les gestes qui l'illustrent. Durées de lecture et
micro-pauses : constantes en tête de `lib/tuto.js`. Les déplacements du curseur
sont calés sur l'horloge, donc indépendants de la vitesse de la machine.
Pour repérer les images figées d'une vidéo (au-delà de 1,5 s ; les
cartes de lecture y figurent forcément) :

```
node_modules/ffmpeg-static/ffmpeg.exe -i videos/accueil.mp4 -vf freezedetect=n=0.0005:d=1.5 -f null -
```

`TUTOS_DEBUG=1` affiche en plus les pauses longues du moteur et les
statistiques de capture.
- `lib/enregistreur.js` : images du screencast Chrome, rééchantillonnées à
  30 i/s et encodées en MP4 H.264 par ffmpeg ; image d'aperçu `.jpg`.

Un scénario est une liste d'étapes `{ dire, faire }` ; option `legende: 'haut'`
pour forcer le sous-titre en haut (sinon il y monte seul quand le curseur
s'en approche).
