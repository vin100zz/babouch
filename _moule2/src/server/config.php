<?php
/**
 * Configuration du moteur _moule2.
 *
 * _moule2 est générique : il ne connaît pas un site en particulier, chaque
 * requête précise ?site=<nom>. Les données de ce site vivent dans son propre
 * dossier, à la racine du dépôt (à côté de _moule2/, pas dedans) :
 *   - <racine>/<site>/data.json          (arborescence + contenu des pages)
 *   - <racine>/<site>/documents/         (médias de ce site)
 */

// Racine du dépôt (parent de _moule2/)
define('BASE_DIR', realpath(__DIR__ . '/../../..'));

// Origines autorisées pour CORS (* = toutes)
define('CORS_ORIGIN', '*');

/**
 * Extensions d'images acceptées par l'explorateur de documents et l'upload.
 * Fonction plutôt que constante : define() n'accepte un tableau qu'à partir
 * de PHP 5.6, or cet hébergement tourne sur une version plus ancienne.
 */
function mediaExtensions()
{
    return array('jpg', 'jpeg', 'png', 'gif', 'webp');
}

/** Extensions de police acceptées par l'explorateur de documents (dossier style/). */
function fontExtensions()
{
    return array('ttf', 'otf', 'woff', 'woff2');
}

/**
 * Valide un nom de site (segment de chemin uniquement, pas de traversal).
 * @return bool
 */
function isValidSiteName($site)
{
    return is_string($site) && preg_match('/^[a-zA-Z0-9_-]+$/', $site) === 1;
}

/**
 * Chemin absolu vers le fichier data.json d'un site (n'implique pas qu'il existe).
 */
function siteJsonPath($site)
{
    return BASE_DIR . DIRECTORY_SEPARATOR . $site . DIRECTORY_SEPARATOR . 'data.json';
}

/**
 * Chemin absolu vers un dossier d'assets d'un site ('documents' ou 'style'),
 * ou null si ce dossier n'existe pas.
 */
function siteAssetPath($site, $root = 'documents')
{
    if (!in_array($root, array('documents', 'style'), true)) {
        return null;
    }
    $dir = BASE_DIR . DIRECTORY_SEPARATOR . $site . DIRECTORY_SEPARATOR . $root;
    $real = realpath($dir);
    if ($real === false) {
        return null;
    }
    // Le dossier du site doit être un enfant direct de la racine (pas de '..').
    if (strncmp($real, BASE_DIR, strlen(BASE_DIR)) !== 0) {
        return null;
    }
    return $real;
}

/**
 * Chemin absolu vers le dossier documents/ d'un site, ou null si le dossier
 * du site (ou son sous-dossier documents/) n'existe pas.
 */
function siteDocumentsPath($site)
{
    return siteAssetPath($site, 'documents');
}
