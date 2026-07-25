<?php
/**
 * POST multipart { site, dir, file }  →  upload un média dans <site>/documents/<dir>/
 */
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    Response::json(array('ok' => true));
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Méthode non supportée', 405);
}

$site = isset($_POST['site']) ? $_POST['site'] : '';
if (!isValidSiteName($site)) {
    Response::error('Paramètre "site" manquant ou invalide.', 400);
}

$BASE = siteDocumentsPath($site);
if ($BASE === null) {
    Response::error('Dossier documents introuvable pour le site : ' . $site, 404);
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $code = isset($_FILES['file']) ? $_FILES['file']['error'] : -1;
    Response::error('Aucun fichier valide reçu (code ' . $code . ')');
}

$file = $_FILES['file'];
$ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

if (!in_array($ext, mediaExtensions(), true)) {
    Response::error('Type de fichier non autorisé : ' . htmlspecialchars($ext));
}

$info = @getimagesize($file['tmp_name']);
if ($info === false) {
    Response::error('Le fichier n\'est pas une image valide');
}

$relDir = isset($_POST['dir']) ? trim($_POST['dir'], '/\\') : '';
if ($relDir !== '' && (strpos($relDir, '..') !== false || preg_match('/[:\\\\]/', $relDir))) {
    Response::error('Chemin invalide.', 400);
}

$targetDir = $relDir !== ''
    ? $BASE . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relDir)
    : $BASE;

if (!is_dir($targetDir)) {
    if (!mkdir($targetDir, 0755, true)) {
        Response::error('Impossible de créer le dossier de destination', 500);
    }
}

$real = realpath($targetDir);
if ($real === false || strncmp($real, $BASE, strlen($BASE)) !== 0) {
    Response::error('Accès interdit.', 403);
}

$filename = uniqid('img_', true) . '.' . $ext;
$dest     = $real . DIRECTORY_SEPARATOR . $filename;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    Response::error('Échec du déplacement du fichier', 500);
}

Response::json(array('fichier' => ($relDir !== '' ? $relDir . '/' : '') . $filename));
