<?php
/**
 * Listage des médias disponibles sous <site>/documents/ ou <site>/style/.
 *
 * GET ?site=espace2&dir=chemin/relatif&root=documents|style&type=image|font|media
 *   → { dir, dirs: [{name, path}], files: [{name, path}] }
 * (type=media : images et vidéos, pour les blocs DOCUMENTS)
 *
 * Sécurité : tout chemin tentant d'échapper au dossier racine du site
 * est rejeté (même contrôle que famille2/Api/images.php).
 */
require_once __DIR__ . '/../bootstrap.php';

$site = isset($_GET['site']) ? $_GET['site'] : '';
if (!isValidSitePath($site)) {
    Response::error('Paramètre "site" manquant ou invalide.', 400);
}

$root = isset($_GET['root']) ? $_GET['root'] : 'documents';
$BASE = siteAssetPath($site, $root);
if ($BASE === null) {
    Response::error('Dossier "' . $root . '" introuvable pour le site : ' . $site, 404);
}

$relDir = isset($_GET['dir']) ? trim($_GET['dir'], '/\\') : '';

if ($relDir !== '' && (
    strpos($relDir, '..') !== false ||
    preg_match('/[:\\\\]/', $relDir)
)) {
    Response::error('Chemin invalide.', 400);
}

$targetDir = $relDir !== ''
    ? $BASE . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relDir)
    : $BASE;

$real = realpathFromUtf8($targetDir);
if ($real === false) {
    Response::error('Dossier introuvable.', 404);
}
if (strncmp($real, $BASE, strlen($BASE)) !== 0) {
    Response::error('Accès interdit.', 403);
}

$type = isset($_GET['type']) ? $_GET['type'] : 'image';
if ($type === 'font') {
    $extensions = fontExtensions();
} elseif ($type === 'media') {
    $extensions = array_merge(mediaExtensions(), videoExtensions());
} else {
    $extensions = mediaExtensions();
}
$extPattern = '/\.(' . implode('|', $extensions) . ')$/i';

$dirs  = array();
$files = array();

$it = new DirectoryIterator($real);
foreach ($it as $entry) {
    if ($entry->isDot()) { continue; }
    $name    = fsNameToUtf8($entry->getFilename());
    $relPath = $relDir !== '' ? $relDir . '/' . $name : $name;

    if ($entry->isDir()) {
        $dirs[] = array('name' => $name, 'path' => $relPath);
    } elseif ($entry->isFile() && preg_match($extPattern, $name)) {
        $files[] = array('name' => $name, 'path' => $relPath);
    }
}

usort($dirs,  function($a, $b) { return strcasecmp($a['name'], $b['name']); });
usort($files, function($a, $b) { return strcasecmp($a['name'], $b['name']); });

Response::json(array('dir' => $relDir, 'dirs' => $dirs, 'files' => $files));
