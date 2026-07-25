<?php
/**
 * GET ?site=espace2  →  contenu complet du site (titre_site, home, chapitres)
 */
require_once __DIR__ . '/../bootstrap.php';

$site = isset($_GET['site']) ? $_GET['site'] : '';
if (!isValidSiteName($site)) {
    Response::error('Paramètre "site" manquant ou invalide.', 400);
}

try {
    $repo = new SiteRepository($site);
    Response::json($repo->get());
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 500);
}
