<?php
/**
 * Configuration du moteur _moule2.
 *
 * _moule2 est générique : il ne connaît pas un site en particulier, chaque
 * requête précise ?site=<chemin>. <chemin> est le chemin du dossier du site
 * relatif à la racine (parent de _moule2/) : 'espace2' pour un site placé à
 * la racine, 'r1/sardaigne' pour un site rangé dans un sous-dossier. Les
 * données de ce site vivent dans son propre dossier (à côté de _moule2/ ou
 * dans un de ses sous-dossiers, jamais dedans) :
 *   - <racine>/<chemin>/data.json          (arborescence + contenu des pages)
 *   - <racine>/<chemin>/documents/         (médias de ce site)
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
 * Valide le chemin d'un site, relatif à BASE_DIR : un ou plusieurs segments
 * séparés par '/', chacun limité à [a-zA-Z0-9_-] (donc ni '..', ni '.', ni
 * chemin absolu, ni séparateur Windows : pas de traversal possible).
 * @return bool
 */
function isValidSitePath($site)
{
    return is_string($site) && preg_match('#^[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$#', $site) === 1;
}

/**
 * Chemin relatif à BASE_DIR (séparateur '/') d'un dossier de site donné en
 * chemin absolu, ou null s'il n'est pas sous BASE_DIR ou n'est pas un chemin
 * de site valide.
 */
function sitePathFromDir($dir)
{
    $real = realpath($dir);
    if ($real === false) {
        return null;
    }
    $prefix = BASE_DIR . DIRECTORY_SEPARATOR;
    // Système de fichiers insensible à la casse sous Windows.
    $sameCase = DIRECTORY_SEPARATOR === '\\'
        ? strncasecmp($real, $prefix, strlen($prefix)) === 0
        : strncmp($real, $prefix, strlen($prefix)) === 0;
    if (!$sameCase) {
        return null;
    }
    $rel = str_replace(DIRECTORY_SEPARATOR, '/', substr($real, strlen($prefix)));
    return isValidSitePath($rel) ? $rel : null;
}

/**
 * Chemin absolu vers le fichier data.json d'un site (n'implique pas qu'il existe).
 */
function siteJsonPath($site)
{
    return BASE_DIR . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $site) . DIRECTORY_SEPARATOR . 'data.json';
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
    $dir = BASE_DIR . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $site) . DIRECTORY_SEPARATOR . $root;
    $real = realpath($dir);
    if ($real === false) {
        return null;
    }
    // Le dossier doit rester sous la racine (garde-fou, ex. lien symbolique).
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
