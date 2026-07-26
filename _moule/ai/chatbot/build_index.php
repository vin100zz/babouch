<?php
/**
 * build_index.php — Construit l'index RAG pour le chatbot babouch.fr
 *
 * À exécuter une fois, puis après chaque mise à jour du contenu du site :
 *   • Navigateur      : http://…/babouch/_moule/ai/chatbot/build_index.php
 *   • Ligne de commande : php build_index.php
 */
set_time_limit(300);
header('Content-Type: text/plain; charset=utf-8');

$CHUNK_SIZE = 1200; // caractères par chunk (contexte envoyé à l'IA)
$OVERLAP    = 150;  // chevauchement pour ne pas couper au milieu d'une phrase

// ── Liste de tous les dossiers de contenu ─────────────────────────────────
$base = realpath(__DIR__ . '/../../../') . DIRECTORY_SEPARATOR;

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

// ── Collecte des fichiers HTML ─────────────────────────────────────────────
$allFiles = array();
foreach ($folders as $dir) {
    collectHtmlFiles($dir, $allFiles);
}
$totalFiles = count($allFiles);
echo "Fichiers HTML trouvés : $totalFiles\n";
flush();

// ── Construction de l'index ────────────────────────────────────────────────
$chunks     = array();
$fileCount  = 0;
$skipCount  = 0;
$chunkCount = 0;

foreach ($allFiles as $idx => $file) {

    // Progression tous les 50 fichiers
    if ($idx > 0 && $idx % 50 === 0) {
        echo "  ... $idx / $totalFiles fichiers traités\n";
        flush();
    }

    $raw = @file_get_contents($file);
    if (!$raw) { $skipCount++; continue; }

    // Normalisation encodage
    if (!mb_check_encoding($raw, 'UTF-8')) {
        $raw = mb_convert_encoding($raw, 'UTF-8', 'ISO-8859-1');
    }

    // Nettoyage du HTML (en préservant la structure paragraphe)
    $text = preg_replace('/<style[^>]*>.*?<\/style>/is', '', $raw);
    $text = preg_replace('/<script[^>]*>.*?<\/script>/is', '', $text);
    // Éléments de bloc → saut de ligne (pour garder les limites de paragraphes)
    $text = preg_replace('/<\/?(?:p|div|h[1-6]|li|tr|blockquote|section|article|header|footer)[^>]*>/i', "\n", $text);
    $text = preg_replace('/<br\s*\/?>/i', "\n", $text);
    // Supprimer les balises restantes
    $text = preg_replace('/<[^>]+>/', ' ', $text);
    $text = html_entity_decode($text, ENT_QUOTES, 'UTF-8');
    // Normaliser : espaces multiples sur une ligne → 1 espace, mais garder les \n
    $text = preg_replace('/[ \t]+/', ' ', $text);
    // Supprimer les lignes vides ou ne contenant que des espaces
    $text = preg_replace('/\n[ \t]*/', "\n", $text);
    // Réduire les sauts de ligne multiples (≥2) à un double saut de paragraphe
    $text = preg_replace('/\n{2,}/', "\n\n", trim($text));

    if (mb_strlen($text) < 30) { $skipCount++; continue; }

    $source = friendlyPath($file);

    // Extraire le titre de la page depuis le HTML brut
    $title = extractTitle($raw, $source);

    // Extraire une accroche (premiers 300 chars du texte nettoyé)
    $summary = mb_substr($text, 0, 300);
    $summary = preg_replace('/\s+/', ' ', $summary);
    // Couper à la dernière phrase complète
    $lastDot = max(mb_strrpos($summary, '. '), mb_strrpos($summary, ".\n"));
    if ($lastDot !== false && $lastDot > 50) {
        $summary = mb_substr($summary, 0, $lastDot + 1);
    }

    // Découpage intelligent en chunks
    $fileChunks = splitIntoChunks($text, $CHUNK_SIZE, $OVERLAP);
    foreach ($fileChunks as $idx => $chunk) {
        if ($idx === 0) {
            // Premier chunk : juste le titre
            $prefix = "[Page : \"{$title}\" — {$source}]\n\n";
        } else {
            // Chunks suivants : titre + accroche pour réancrer les pronoms
            $prefix = "[Page : \"{$title}\" — {$source} (suite)]\n"
                    . "[Début du document : {$summary}]\n\n";
        }
        $chunks[] = array('source' => $source, 'text' => $prefix . $chunk);
        $chunkCount++;
    }
    $fileCount++;
}

// ── Indexation des CSV généalogiques ─────────────────────────────────────
$csvFiles = array(
    $base . 'geneatree' . DIRECTORY_SEPARATOR . 'carle.csv'   => 'geneatree/carle',
    $base . 'geneatree' . DIRECTORY_SEPARATOR . 'gotrand.csv' => 'geneatree/gotrand',
);

$csvPersons = 0;
foreach ($csvFiles as $csvPath => $csvSource) {
    if (!file_exists($csvPath)) {
        echo "CSV introuvable : $csvPath\n";
        continue;
    }
    $csvChunks = indexCsvGenealogy($csvPath, $csvSource, 20);
    foreach ($csvChunks as $c) {
        $chunks[] = $c;
        $chunkCount++;
    }
    echo "CSV indexé : $csvSource (" . count($csvChunks) . " chunks)\n";
    flush();
}

// ── Sauvegarde ────────────────────────────────────────────────────────────
$indexData = array(
    '_meta' => array(
        'built_at'    => date('Y-m-d H:i:s'),
        'file_count'  => $fileCount,
        'chunk_count' => $chunkCount,
        'chunk_size'  => $CHUNK_SIZE,
        'overlap'     => $OVERLAP,
    ),
    'chunks' => $chunks,
);

$indexFile = __DIR__ . '/index.json';
$ok = file_put_contents($indexFile, json_encode($indexData, JSON_UNESCAPED_UNICODE));

echo "\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "Fichiers indexés  : $fileCount\n";
echo "Fichiers ignorés  : $skipCount\n";
echo "Chunks créés      : $chunkCount\n";
echo "Taille chunk      : {$CHUNK_SIZE} cars, overlap {$OVERLAP}\n";
if ($ok !== false) {
    echo "Index sauvegardé  : index.json (" . round(filesize($indexFile) / 1024) . " Ko)\n";
} else {
    echo "ERREUR : impossible d'écrire index.json (droits d'écriture ?)\n";
}
echo "Terminé           : " . date('H:i:s') . "\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";


// ═══════════════════════════════════════════════════════════════════════════
// Fonctions utilitaires
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Découpe un texte en chunks en respectant les limites de paragraphes/phrases/mots.
 * Ordre de priorité pour le point de coupure :
 *   1. Saut de paragraphe (\n\n)
 *   2. Fin de phrase (. ! ?)
 *   3. Virgule / point-virgule
 *   4. Espace (limite de mot)
 *   5. Coupure dure (dernier recours)
 */
function splitIntoChunks($text, $chunkSize, $overlap) {
    $chunks = array();
    $len    = mb_strlen($text);
    $pos    = 0;

    while ($pos < $len) {
        $raw = mb_substr($text, $pos, $chunkSize);

        if ($pos + $chunkSize < $len) {
            // Trouver le meilleur point de fin pour ce chunk
            $cut   = findCutPoint($raw, $chunkSize);
            $chunk = trim(mb_substr($raw, 0, $cut));

            // Début du prochain chunk = (coupure - overlap), mais arrondi
            // à la prochaine limite de phrase pour éviter de commencer au milieu d'un mot
            $overlapStart = max($pos, $pos + $cut - $overlap);
            $cutAbs       = $pos + $cut; // position absolue de la coupure
            $nextPos      = advanceToSentenceStart($text, $overlapStart, $cutAbs);

            // Sécurité : toujours avancer
            $pos = ($nextPos > $pos) ? $nextPos : $cutAbs;
        } else {
            $chunk = trim($raw);
            $pos   = $len;
        }

        if (mb_strlen($chunk) >= 30) {
            $chunks[] = $chunk;
        }
    }
    return $chunks;
}

/**
 * Depuis $from (position absolue dans $text), avance jusqu'au début
 * de la prochaine phrase/paragraphe, sans dépasser $limit.
 * Si aucune limite trouvée, retourne $limit (pas d'overlap, mais propre).
 */
function advanceToSentenceStart($text, $from, $limit) {
    $i = $from;
    while ($i < $limit) {
        $ch   = mb_substr($text, $i, 1);
        $next = ($i + 1 < $limit) ? mb_substr($text, $i + 1, 1) : '';

        // Après . ! ? suivi d'un espace ou saut de ligne
        if (in_array($ch, array('.', '!', '?')) && ($next === ' ' || $next === "\n")) {
            // Sauter le délimiteur et les espaces
            $i += 2;
            while ($i < $limit && mb_substr($text, $i, 1) === ' ') $i++;
            return $i;
        }
        // Saut de ligne → début d'un nouveau paragraphe
        if ($ch === "\n") {
            while ($i < $limit && mb_substr($text, $i, 1) === "\n") $i++;
            while ($i < $limit && mb_substr($text, $i, 1) === ' ')  $i++;
            return $i;
        }
        $i++;
    }
    // Pas de limite trouvée → démarrer juste après la coupure (sans overlap)
    return $limit;
}

/**
 * Trouve le meilleur point de coupure dans $text (recherche arrière depuis la fin).
 * Ne coupe pas avant 50% du chunk pour éviter les morceaux trop courts.
 */
function findCutPoint($text, $maxLen) {
    $min = (int)($maxLen * 0.5);

    // 1. Paragraphe (\n\n)
    $p = mb_strrpos($text, "\n\n");
    if ($p !== false && $p >= $min) return $p + 2;

    // 2. Fin de phrase
    foreach (array(".\n", "!\n", "?\n", '. ', '! ', '? ') as $delim) {
        $p = mb_strrpos($text, $delim);
        if ($p !== false && $p >= $min) return $p + mb_strlen($delim);
    }

    // 3. Virgule / point-virgule
    foreach (array(";\n", '; ', ",\n", ', ') as $delim) {
        $p = mb_strrpos($text, $delim);
        if ($p !== false && $p >= $min) return $p + mb_strlen($delim);
    }

    // 4. Espace (limite de mot)
    $p = mb_strrpos($text, ' ');
    if ($p !== false && $p >= $min) return $p + 1;

    // 5. Coupure dure
    return $maxLen;
}

/**
 * Extrait le titre d'une page HTML (title > h1 > h2 > h3 > chemin)
 */
function extractTitle($html, $fallback) {
    // <title>
    if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $m)) {
        $t = trim(strip_tags($m[1]));
        if ($t) return html_entity_decode($t, ENT_QUOTES, 'UTF-8');
    }
    // Premier heading h1..h3
    if (preg_match('/<h[1-3][^>]*>(.*?)<\/h[1-3]>/is', $html, $m)) {
        $t = trim(strip_tags($m[1]));
        if ($t) return html_entity_decode($t, ENT_QUOTES, 'UTF-8');
    }
    // Fallback : dernière partie du chemin
    $parts = explode('/', $fallback);
    return end($parts);
}

function collectHtmlFiles($dir, &$results) {    if (!is_dir($dir)) return;
    $items = @scandir($dir);
    if (!$items) return;
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        if (is_dir($path)) {
            collectHtmlFiles($path, $results);
        } elseif (preg_match('/\.html?$/i', $item)) {
            $norm = str_replace('\\', '/', $path);
            if (strpos($norm, '/contenu/') !== false || strpos($norm, '/content/') !== false) {
                $results[] = $path;
            }
        }
    }
}

function friendlyPath($path) {
    $path = str_replace('\\', '/', $path);
    $pos  = strpos($path, 'babouch/');
    if ($pos !== false) {
        $path = substr($path, $pos + strlen('babouch/'));
    }
    $path = preg_replace('/\/[^\/]+\.html?$/i', '', $path);
    // Remplace "contenu/pages" par "#/chapitre" pour les URLs du site
    $path = str_replace('contenu/pages', '#/chapitre', $path);
    return $path;
}

/**
 * Indexe un CSV généalogique (numérotation Ahnentafel : parents de N = 2N et 2N+1)
 * Retourne un tableau de chunks, chacun contenant $perChunk personnes.
 */
function indexCsvGenealogy($csvPath, $source, $perChunk = 20) {
    $raw = @file_get_contents($csvPath);
    if (!$raw) return array();

    // Normalisation encodage
    if (!mb_check_encoding($raw, 'UTF-8')) {
        $raw = mb_convert_encoding($raw, 'UTF-8', 'ISO-8859-1');
    }
    // Suppression du BOM UTF-8 éventuel (EF BB BF)
    if (substr($raw, 0, 3) === "\xef\xbb\xbf") {
        $raw = substr($raw, 3);
    }

    $lines  = explode("\n", str_replace("\r", '', $raw));
    $header = array_map('trim', explode(';', array_shift($lines)));

    // Debug : affiche les noms de colonnes détectés
    echo "  Colonnes CSV : " . implode(' | ', $header) . "\n";
    flush();

    // ── 1re passe : construire le dictionnaire id => row ──────────────────
    $byId    = array();
    $idColKey = null; // nom exact de la colonne Id dans ce fichier

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '') continue;
        $cols = explode(';', $line);
        $row  = array();
        foreach ($header as $i => $col) {
            $row[$col] = isset($cols[$i]) ? trim($cols[$i]) : '';
        }

        // Déterminer une fois le nom exact de la colonne Id (insensible à la casse / BOM)
        if ($idColKey === null) {
            foreach (array_keys($row) as $k) {
                if (strtolower(preg_replace('/[^a-zA-Z]/', '', $k)) === 'id') {
                    $idColKey = $k;
                    break;
                }
            }
        }

        $id = ($idColKey !== null && isset($row[$idColKey])) ? (int)$row[$idColKey] : 0;
        if ($id > 0) $byId[$id] = $row;
    }

    echo "  Personnes lues : " . count($byId) . "\n";
    flush();

    // ── 2e passe : générer les phrases avec liens de parenté ──────────────
    $sentences = array();
    ksort($byId); // ordre croissant des IDs
    foreach ($byId as $id => $row) {

        // Père = 2N, mère = 2N+1 (Ahnentafel)
        $fatherId = $id * 2;
        $motherId = $id * 2 + 1;
        $father   = isset($byId[$fatherId]) ? personName($byId[$fatherId]) : null;
        $mother   = isset($byId[$motherId]) ? personName($byId[$motherId]) : null;

        // Enfant = floor(N/2), sauf pour la racine (id=1)
        $childId  = ($id >= 2) ? (int)floor($id / 2) : 0;
        $child    = ($childId > 0 && isset($byId[$childId])) ? personName($byId[$childId]) : null;

        // Rôle : pair = père, impair = mère (sauf id=1 = racine)
        $role = null;
        if ($id > 1) {
            $role = ($id % 2 === 0) ? 'père' : 'mère';
        }

        $sentence = csvRowToSentence($row, $father, $mother, $child, $role);
        if ($sentence) $sentences[] = $sentence;
    }

    // ── Regroupement en chunks de $perChunk personnes ─────────────────────
    $chunks = array();
    $total  = count($sentences);
    for ($i = 0; $i < $total; $i += $perChunk) {
        $group    = array_slice($sentences, $i, $perChunk);
        $chunks[] = array(
            'source' => $source,
            'text'   => implode("\n", $group),
        );
    }
    return $chunks;
}

/**
 * Retourne "Prénom NOM" d'une ligne CSV (gère Prnom et Prénom)
 */
function personName($row) {
    $nom    = isset($row['Nom'])    ? $row['Nom']    : '';
    $prenom = isset($row['Prénom']) ? $row['Prénom']
            : (isset($row['Prnom']) ? $row['Prnom'] : '');
    $prenom = preg_replace("/'([^']+)'/", '$1', $prenom);
    return trim($prenom . ' ' . $nom);
}

/**
 * Convertit une ligne CSV en phrase naturelle enrichie des liens de parenté
 */
function csvRowToSentence($row, $father = null, $mother = null, $child = null, $role = null) {
    $nom    = isset($row['Nom'])    ? $row['Nom']    : '';
    $prenom = isset($row['Prénom']) ? $row['Prénom']
            : (isset($row['Prnom']) ? $row['Prnom'] : '');
    if (!$nom && !$prenom) return '';

    $prenom = preg_replace("/'([^']+)'/", '$1', $prenom);

    $parts   = array();
    $parts[] = trim($prenom . ' ' . $nom);

    // Naissance
    $nd = isset($row['Naissance_Date'])  ? $row['Naissance_Date']  : '';
    $nv = isset($row['Naissance_Ville']) ? $row['Naissance_Ville'] : '';
    $np = isset($row['Naissance_Dept'])  ? $row['Naissance_Dept']  : '';
    if ($nd || $nv) {
        $s = 'né(e)';
        if ($nd) $s .= ' le ' . $nd;
        if ($nv) $s .= ' à ' . $nv;
        if ($np) $s .= ' (' . $np . ')';
        $parts[] = $s;
    }

    // Profession
    $prof = isset($row['Profession']) ? $row['Profession'] : '';
    if ($prof) $parts[] = 'profession : ' . $prof;

    // Mariage
    $md = isset($row['Mariage_Date'])  ? $row['Mariage_Date']  : '';
    $mv = isset($row['Mariage_Ville']) ? $row['Mariage_Ville'] : '';
    $mp = isset($row['Mariage_Dept'])  ? $row['Mariage_Dept']  : '';
    if ($md || $mv) {
        $s = 'marié(e)';
        if ($md) $s .= ' le ' . $md;
        if ($mv) $s .= ' à ' . $mv;
        if ($mp) $s .= ' (' . $mp . ')';
        $parts[] = $s;
    }

    // Décès (Dcs_ ou Décès_)
    $dd = isset($row['Décès_Date'])  ? $row['Décès_Date']
        : (isset($row['Dcs_Date'])   ? $row['Dcs_Date']  : '');
    $dv = isset($row['Décès_Ville']) ? $row['Décès_Ville']
        : (isset($row['Dcs_Ville'])  ? $row['Dcs_Ville'] : '');
    $dp = isset($row['Décès_Dept'])  ? $row['Décès_Dept']
        : (isset($row['Dcs_Dept'])   ? $row['Dcs_Dept']  : '');
    if ($dd || $dv) {
        $s = 'décédé(e)';
        if ($dd) $s .= ' le ' . $dd;
        if ($dv) $s .= ' à ' . $dv;
        if ($dp) $s .= ' (' . $dp . ')';
        $parts[] = $s;
    }

    // ── Liens de parenté (Ahnentafel) ────────────────────────────────────
    // Parents
    if ($father && $mother) {
        $parts[] = 'enfant de ' . $father . ' et de ' . $mother;
    } elseif ($father) {
        $parts[] = 'enfant de ' . $father;
    } elseif ($mother) {
        $parts[] = 'enfant de ' . $mother;
    }

    // Rôle par rapport à l'enfant
    if ($child && $role) {
        $parts[] = $role . ' de ' . $child;
    }

    return implode(', ', $parts) . '.';
}

