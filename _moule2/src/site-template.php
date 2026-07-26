<?php
/**
 * Gabarit HTML partagé par tous les sites _moule2.
 *
 * Chaque site n'a qu'un fichier index.php d'une ligne qui inclut ce gabarit
 * (voir espace2/index.php) : le nom du site et le chemin vers _moule2/ sont
 * déduits automatiquement de l'emplacement du fichier appelant, et la liste
 * des scripts/styles vit ici, une seule fois. Faire évoluer _moule2/src/ui
 * (ajouter un fichier, changer la version de cache) ne demande donc plus de
 * toucher aucun fichier par site.
 */

// Le fichier initialement demandé est toujours <site>/index.php, y compris
// lorsqu'on passe par ce require() : SCRIPT_FILENAME référence le script
// d'entrée, pas ce gabarit inclus.
$site       = basename(dirname($_SERVER['SCRIPT_FILENAME']));
$engineBase = '../_moule2';

// Unique numéro de version à incrémenter après toute modification de
// _moule2/src/ui/**, pour invalider le cache navigateur sur tous les sites.
$version = 20;

$title = ucfirst(str_replace(array('_', '-'), ' ', $site));

$scripts = array('util', 'api', 'richtext', 'filebrowser', 'home-view', 'content-editor', 'tree-editor', 'app');
?><!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?php echo htmlspecialchars($title, ENT_QUOTES, 'UTF-8'); ?></title>
  <link rel="stylesheet" href="<?php echo $engineBase; ?>/src/ui/css/app.css?v=<?php echo $version; ?>">
  <link rel="stylesheet" href="<?php echo $engineBase; ?>/src/ui/css/editor.css?v=<?php echo $version; ?>">
</head>
<body>

  <div id="m2-root"></div>

  <script>
    var SITE_NAME = <?php echo json_encode($site); ?>;
    var ENGINE_BASE = <?php echo json_encode($engineBase); ?>;
  </script>
<?php foreach ($scripts as $s): ?>
  <script src="<?php echo $engineBase; ?>/src/ui/js/<?php echo $s; ?>.js?v=<?php echo $version; ?>"></script>
<?php endforeach; ?>
</body>
</html>
