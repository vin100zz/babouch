<?php
/**
 * POST { site, data }  →  écrit <site>/data.json
 */
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    Response::json(array('ok' => true));
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Méthode non supportée', 405);
}

$rawBody = file_get_contents('php://input');
$body = json_decode($rawBody, true);
if (!is_array($body)) {
    Response::error('Corps JSON invalide');
}

$site = isset($body['site']) ? $body['site'] : '';
$data = isset($body['data']) ? $body['data'] : null;

if (!isValidSiteName($site)) {
    Response::error('Paramètre "site" manquant ou invalide.', 400);
}
if (!is_array($data)) {
    Response::error('Paramètre "data" manquant.', 400);
}

try {
    $repo = new SiteRepository($site);
    $saved = $repo->save($data);
    Response::json(array('ok' => true, 'data' => $saved));
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 500);
}
