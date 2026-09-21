<?php
/**
 * Gabarit HTML partagé par tous les sites _moule2.
 *
 * Chaque site n'a qu'un fichier index.php d'une ligne qui inclut ce gabarit
 * (voir espace2/index.php) : le nom du site, sa position par rapport à la
 * racine et le chemin vers _moule2/ sont déduits automatiquement de
 * l'emplacement du fichier appelant, et la liste des scripts/styles vit ici,
 * une seule fois. Faire évoluer _moule2/src/ui (ajouter un fichier, changer
 * la version de cache) ne demande donc plus de toucher aucun fichier par site.
 *
 * Un site peut être placé n'importe où sous la racine (parent de _moule2/) :
 * à la racine (espace2/) comme dans un sous-dossier (r1/sardaigne/). Son
 * index.php doit alors viser ce fichier avec le bon nombre de '..' :
 *   <?php require __DIR__ . '/../../_moule2/src/site-template.php';
 */

require_once __DIR__ . '/server/config.php';

// Le fichier initialement demandé est toujours <site>/index.php, y compris
// lorsqu'on passe par ce require() : SCRIPT_FILENAME référence le script
// d'entrée, pas ce gabarit inclus.
$siteDir  = dirname($_SERVER['SCRIPT_FILENAME']);
$sitePath = sitePathFromDir($siteDir);
if ($sitePath === null) {
    http_response_code(500);
    exit('Ce site doit se trouver sous la racine de _moule2 (parent du dossier _moule2), dans des dossiers nommés uniquement avec [a-zA-Z0-9_-].');
}

// $site : nom d'affichage ; $sitePath : chemin relatif à la racine, transmis
// à l'API pour retrouver le dossier du site (ex. 'r1/sardaigne').
$site = basename($sitePath);

// URL relative de _moule2/ depuis la page du site : un '../' par niveau de
// profondeur du site sous la racine. Les URL du gabarit sont relatives à
// celle de la page, qui reflète l'arborescence disque.
$engineBase = str_repeat('../', substr_count($sitePath, '/') + 1) . basename(dirname(__DIR__));

// Unique numéro de version à incrémenter après toute modification de
// _moule2/src/ui/**, pour invalider le cache navigateur sur tous les sites.
$version = 69;

$title = ucfirst(str_replace(array('_', '-'), ' ', $site));

$scripts = array('util', 'api', 'richtext', 'filebrowser', 'home-view', 'content-editor', 'tree-editor', 'app');

// style.css optionnel, propre à chaque site (<site>/style/style.css) : permet
// de surcharger certaines propriétés du moule sans toucher à _moule2. Chargé
// en dernier s'il existe, pour que ses règles priment. Invalidation via
// filemtime() (et non $version, propre au moteur) : se met à jour tout seul
// dès que l'utilisateur modifie son fichier, sans bump manuel.
$customCssPath = $siteDir . DIRECTORY_SEPARATOR . 'style' . DIRECTORY_SEPARATOR . 'style.css';
$customCssVersion = is_file($customCssPath) ? filemtime($customCssPath) : null;
?><!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?php echo htmlspecialchars($title, ENT_QUOTES, 'UTF-8'); ?></title>
  <link rel="stylesheet" href="<?php echo $engineBase; ?>/src/ui/css/app.css?v=<?php echo $version; ?>">
  <link rel="stylesheet" href="<?php echo $engineBase; ?>/src/ui/css/editor.css?v=<?php echo $version; ?>">
<?php if ($customCssVersion !== null): ?>
  <link rel="stylesheet" href="style/style.css?v=<?php echo $customCssVersion; ?>">
<?php endif; ?>
</head>
<body>

  <div id="m2-root"></div>

  <script>
    var SITE_NAME = <?php echo json_encode($site); ?>;
    var SITE_PATH = <?php echo json_encode($sitePath); ?>;
    var ENGINE_BASE = <?php echo json_encode($engineBase); ?>;
  </script>
<?php foreach ($scripts as $s): ?>
  <script src="<?php echo $engineBase; ?>/src/ui/js/<?php echo $s; ?>.js?v=<?php echo $version; ?>"></script>
<?php endforeach; ?>
</body>
</html>
