<?php
/**
 * build_index_images.php — Indexe les images via Ollama Vision (modèle local)
 *
 * Prérequis :
 *   1. Installer Ollama : https://ollama.com
 *   2. Télécharger un modèle vision :
 *        ollama pull moondream    (~1.7 Go, rapide)
 *        ollama pull llava        (~4.5 Go, plus précis)
 *   3. Lancer Ollama (démarre automatiquement en tâche de fond)
 *
 * Exécution :
 *   • CLI     : php build_index_images.php
 *   • CLI resumable : php build_index_images.php --resume
 *   • Navigateur : http://…/babouch/_moule/ai/chatbot/build_index_images.php
 *
 * Produit : index_images.json  (fusionné avec index.json dans chat.php)
 */

set_time_limit(0); // Peut prendre longtemps selon le nombre d'images
header('Content-Type: text/plain; charset=utf-8');

// ── Configuration ─────────────────────────────────────────────────────────────

$OLLAMA_URL   = 'http://localhost:11434/api/generate';
$OLLAMA_MODEL = 'llava';   // ou 'moondream', 'llava:13b', 'minicpm-v', etc.
$OLLAMA_TIMEOUT = 90;         // secondes par image

$MAX_IMAGE_DIM = 800;         // redimensionner à max 800px (côté le plus long) avant envoi
$SAVE_EVERY    = 10;          // sauvegarde incrémentale toutes les N images
$MAX_IMAGES    = 10;          // 0 = illimité, >0 = limite pour test

// Dossiers à exclure (miniatures, etc.)
$EXCLUDE_DIRS  = array('mini', '_moule', '_search', '_chatbot', 'chatbot', 'style', 'css', 'js', 'lib');

// Extensions images acceptées
$IMAGE_EXTS    = array('jpg','jpeg','png','gif');

// ── Mode CLI vs navigateur ────────────────────────────────────────────────────

$isCli  = (PHP_SAPI === 'cli');
$resume = $isCli ? in_array('--resume', $argv) : isset($_GET['resume']);

function out($line) {
    echo $line . "\n";
    if (PHP_SAPI !== 'cli') flush();
}

// ── Chemins ───────────────────────────────────────────────────────────────────

$base      = realpath(__DIR__ . '/../../../') . DIRECTORY_SEPARATOR;
$indexFile = __DIR__ . '/index_images.json';

// ── Dossiers de contenu ───────────────────────────────────────────────────────

$folders = array(
    // Membres de la famille
    $base . '1_barles',        $base . '2_andre',         $base . '3_francois',
    $base . '4_rosine',        $base . '5_fmp',           $base . '6_vpnew',
    $base . '7_guerrevincent', $base . '8_alsace',
    $base . '11_florian',      $base . '12_lemesle',      $base . '13_nicolas',
    $base . '14_castelin',     $base . '15_h_et_m',
    $base . 'archives_J',      $base . 'chronique',           $base . 'domiciles_site',
    $base . 'famille',         $base . 'jean_et_leo',  $base . 'mg',
    $base . 'rue_guerin',
);

// ── Chargement de l'index existant (mode reprise) ────────────────────────────

$existingChunks = array();
$alreadyDone    = array();

if ($resume && file_exists($indexFile)) {
    $existing = json_decode(file_get_contents($indexFile), true);
    if (isset($existing['chunks'])) {
        $existingChunks = $existing['chunks'];
        foreach ($existingChunks as $c) {
            if (isset($c['image'])) {
                $alreadyDone[$c['image']] = true;
            }
        }
    }
    out('Reprise : ' . count($existingChunks) . ' images déjà indexées.');
} else {
    out('Démarrage d\'un nouvel index images.');
}

// ── Collecte des fichiers images ──────────────────────────────────────────────

out('Scan des images...');
$allImages = array();
foreach ($folders as $dir) {
    collectImages($dir, $allImages, $EXCLUDE_DIRS, $IMAGE_EXTS);
}

$total = count($allImages);
out("Images trouvées : $total (miniatures exclues)");

// Limitation pour test
if ($MAX_IMAGES > 0) {
    $allImages = array_slice($allImages, 0, $MAX_IMAGES);
    $total     = count($allImages);
    out("⚠ Mode test : limité à {$total} images (\$MAX_IMAGES = {$MAX_IMAGES}). Mettre 0 pour tout indexer.");
}
out("");

// ── Test de connexion Ollama ──────────────────────────────────────────────────

out("Test connexion Ollama ({$OLLAMA_URL})...");
$testOk = testOllama($OLLAMA_URL);
if (!$testOk) {
    out("ERREUR : Ollama n'est pas accessible sur {$OLLAMA_URL}");
    out("Vérifiez qu'Ollama est lancé : https://ollama.com");
    exit(1);
}
out("Ollama OK — modèle : {$OLLAMA_MODEL}\n");

// ── Boucle principale ─────────────────────────────────────────────────────────

$chunks     = $existingChunks;
$newCount   = 0;
$skipCount  = 0;
$errorCount = 0;
$processed  = 0;

foreach ($allImages as $imagePath) {

    $friendly = friendlyPath($imagePath, $base);

    // Déjà indexé ?
    if (isset($alreadyDone[$friendly])) {
        $skipCount++;
        continue;
    }

    $processed++;
    out("[{$processed}/{$total}] " . $friendly);

    // Vérification taille minimale (évite les icônes < 3 Ko)
    $filesize = @filesize($imagePath);
    if ($filesize === false || $filesize < 3072) {
        out("    → ignoré (trop petit : {$filesize} octets)");
        $skipCount++;
        continue;
    }

    // Redimensionnement en mémoire
    $imageB64 = resizeAndEncode($imagePath, $MAX_IMAGE_DIM);
    if ($imageB64 === null) {
        out("    → ignoré (format non supporté ou erreur GD)");
        $skipCount++;
        continue;
    }

    // Contexte sémantique depuis le chemin
    $context = extractContext($friendly);

    // Prompt pour Ollama
    $prompt = "Décris cette photo de famille en français, de manière précise et détaillée. "
            . "Contexte : {$context}. "
            . "Décris les personnes visibles (âge apparent, tenue, expression), "
            . "le lieu, les objets, l'ambiance, la période estimée, et toute information pertinente. "
            . "Réponds uniquement en français.";

    // Appel Ollama
    $description = callOllama($OLLAMA_URL, $OLLAMA_MODEL, $prompt, $imageB64, $OLLAMA_TIMEOUT);

    if ($description === null) {
        out("    → ERREUR appel Ollama");
        $errorCount++;
        continue;
    }

    $description = trim($description);
    out("    → OK (" . mb_strlen($description) . " cars)");

    // Source = dossier parent de l'image
    $sourceDir = friendlyDir($friendly);

    $chunks[] = array(
        'source' => $sourceDir,
        'text'   => '[IMAGE] ' . $description,
        'type'   => 'image',
        'image'  => $friendly,
    );
    $newCount++;

    // Sauvegarde incrémentale
    if ($newCount % $SAVE_EVERY === 0) {
        saveIndex($indexFile, $chunks, $OLLAMA_MODEL);
        out("  ── Sauvegarde intermédiaire (" . count($chunks) . " images) ──");
    }
}

// ── Sauvegarde finale ─────────────────────────────────────────────────────────

saveIndex($indexFile, $chunks, $OLLAMA_MODEL);

out("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
out("Images trouvées   : {$total}");
out("Nouvelles indexées: {$newCount}");
out("Ignorées (déjà OK): {$skipCount}");
out("Erreurs Ollama    : {$errorCount}");
out("Total dans index  : " . count($chunks));
out("Modèle utilisé    : {$OLLAMA_MODEL}");
if (file_exists($indexFile)) {
    out("Fichier           : index_images.json (" . round(filesize($indexFile) / 1024) . " Ko)");
}
out("Terminé           : " . date('H:i:s'));
out("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");


// ═══════════════════════════════════════════════════════════════════════════════
// Fonctions utilitaires
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Collecte récursive des images en excluant les dossiers miniatures
 */
function collectImages($dir, &$results, $excludeDirs, $exts) {
    if (!is_dir($dir)) return;
    $items = @scandir($dir);
    if (!$items) return;
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        if (is_dir($path)) {
            if (!in_array(strtolower($item), $excludeDirs)) {
                collectImages($path, $results, $excludeDirs, $exts);
            }
        } else {
            $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
            if (in_array($ext, $exts)) {
                $results[] = $path;
            }
        }
    }
}

/**
 * Convertit un chemin absolu en chemin relatif lisible
 */
function friendlyPath($path, $base) {
    $path = str_replace('\\', '/', $path);
    $base = str_replace('\\', '/', $base);
    if (strpos($path, $base) === 0) {
        $path = substr($path, strlen($base));
    }
    return $path;
}

/**
 * Extrait le dossier parent (source) depuis le chemin friendly
 */
function friendlyDir($friendlyPath) {
    return preg_replace('/\/[^\/]+$/', '', $friendlyPath);
}

/**
 * Extrait un contexte lisible depuis le chemin (dossiers et noms de fichiers)
 * Ex: "11_florian/contenu/pages/2_mariage" → "album Florian, section mariage"
 */
function extractContext($path) {
    $parts = explode('/', $path);
    $labels = array();
    foreach ($parts as $part) {
        // Retire le préfixe numérique : "2_mariage" → "mariage"
        $clean = preg_replace('/^\d+_/', '', $part);
        $clean = str_replace('_', ' ', $clean);
        $clean = preg_replace('/\.[^.]+$/', '', $clean); // retire extension
        if ($clean && !in_array(strtolower($clean), array('contenu','content','pages','mini','index'))) {
            $labels[] = $clean;
        }
    }
    return implode(', ', array_unique($labels));
}

/**
 * Redimensionne l'image et retourne son encodage base64 (ou null si erreur)
 */
function resizeAndEncode($path, $maxDim) {
    if (!function_exists('imagecreatefromjpeg')) {
        // GD non disponible : envoie l'image brute
        $raw = @file_get_contents($path);
        return $raw ? base64_encode($raw) : null;
    }

    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

    // Chargement selon le type
    $src = null;
    if ($ext === 'jpg' || $ext === 'jpeg') {
        $src = @imagecreatefromjpeg($path);
    } elseif ($ext === 'png') {
        $src = @imagecreatefrompng($path);
    } elseif ($ext === 'gif') {
        $src = @imagecreatefromgif($path);
    }

    if (!$src) {
        // Fallback : envoi brut
        $raw = @file_get_contents($path);
        return $raw ? base64_encode($raw) : null;
    }

    $w = imagesx($src);
    $h = imagesy($src);

    // Redimensionnement si nécessaire
    if ($w > $maxDim || $h > $maxDim) {
        if ($w >= $h) {
            $nw = $maxDim;
            $nh = (int) round($h * $maxDim / $w);
        } else {
            $nh = $maxDim;
            $nw = (int) round($w * $maxDim / $h);
        }
        $dst = imagecreatetruecolor($nw, $nh);
        // Fond blanc pour les PNG avec transparence
        imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
        imagedestroy($src);
        $src = $dst;
    }

    // Capture en JPEG dans un buffer
    ob_start();
    imagejpeg($src, null, 85);
    $data = ob_get_clean();
    imagedestroy($src);

    return base64_encode($data);
}

/**
 * Teste si Ollama est accessible
 */
function testOllama($url) {
    $base    = preg_replace('/\/api\/generate$/', '', $url);
    $ctx     = stream_context_create(array(
        'http' => array('timeout' => 5, 'ignore_errors' => true),
    ));
    $resp    = @file_get_contents($base . '/api/tags', false, $ctx);
    return ($resp !== false);
}

/**
 * Appelle Ollama Vision et retourne la description
 */
function callOllama($url, $model, $prompt, $imageB64, $timeout) {
    $payload = json_encode(array(
        'model'  => $model,
        'prompt' => $prompt,
        'images' => array($imageB64),
        'stream' => false,
    ));

    $ctx = stream_context_create(array(
        'http' => array(
            'method'        => 'POST',
            'header'        => "Content-Type: application/json\r\n",
            'content'       => $payload,
            'timeout'       => $timeout,
            'ignore_errors' => true,
        ),
    ));

    $resp = @file_get_contents($url, false, $ctx);
    if ($resp === false) return null;

    $data = json_decode($resp, true);
    return isset($data['response']) ? $data['response'] : null;
}

/**
 * Sauvegarde l'index images
 */
function saveIndex($indexFile, $chunks, $model) {
    $imageCount = 0;
    foreach ($chunks as $c) {
        if (isset($c['type']) && $c['type'] === 'image') $imageCount++;
    }

    $data = array(
        '_meta' => array(
            'built_at'    => date('Y-m-d H:i:s'),
            'image_count' => $imageCount,
            'chunk_count' => count($chunks),
            'model'       => $model,
        ),
        'chunks' => $chunks,
    );
    file_put_contents($indexFile, json_encode($data, JSON_UNESCAPED_UNICODE));
}

