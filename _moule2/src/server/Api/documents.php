<?php
/**
 * Listage des médias disponibles sous <site>/documents/.
 *
 * GET ?site=espace2&dir=chemin/relatif
 *   → { dir, dirs: [{name, path}], files: [{name, path}] }
 *
 * Sécurité : tout chemin tentant d'échapper au dossier documents/ du site
 * est rejeté (même contrôle que famille2/Api/images.php).
 */
require_once __DIR__ . '/../bootstrap.php';

$site = isset($_GET['site']) ? $_GET['site'] : '';
if (!isValidSiteName($site)) {
    Response::error('Paramètre "site" manquant ou invalide.', 400);
}

$BASE = siteDocumentsPath($site);
if ($BASE === null) {
    Response::error('Dossier documents introuvable pour le site : ' . $site, 404);
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

$real = realpath($targetDir);
if ($real === false) {
    Response::error('Dossier introuvable.', 404);
}
if (strncmp($real, $BASE, strlen($BASE)) !== 0) {
    Response::error('Accès interdit.', 403);
}

$extPattern = '/\.(' . implode('|', mediaExtensions()) . ')$/i';

$dirs  = array();
$files = array();

$it = new DirectoryIterator($real);
foreach ($it as $entry) {
    if ($entry->isDot()) { continue; }
    $name    = $entry->getFilename();
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
