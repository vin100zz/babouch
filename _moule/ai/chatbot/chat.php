<?php
/**
 * Backend du chatbot babouch.fr
 * Approche RAG : index pré-construit (index.json) → appel API IA → réponse en langage naturel
 * Configuration IA : _moule/ai/config.php  |  Indexation : build_index.php
 */
// ── Configuration ─────────────────────────────────────────────────────────
$ENABLE_LINKS = false;  // true = liens cliquables dans les réponses, false = texte brut

header('Content-Type: application/json; charset=utf-8');
set_time_limit(60);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../ai.php';

// ── Lecture de la requête ──────────────────────────────────────────────────
$body     = json_decode(file_get_contents('php://input'), true);
$question = trim(isset($body['question']) ? $body['question'] : '');
$dryrun   = !empty($body['dryrun']);

if (mb_strlen($question) < 3) {
    echo json_encode(array('error' => 'Question trop courte.'), JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Chargement des index pré-construits ───────────────────────────────────

// Index textes (obligatoire)
$indexFile = __DIR__ . '/index.json';
if (!file_exists($indexFile)) {
    echo json_encode(array('error' => "Index introuvable. Ouvrir build_index.php pour construire l'index."), JSON_UNESCAPED_UNICODE);
    exit;
}
$indexData = json_decode(file_get_contents($indexFile), true);
$chunks    = isset($indexData['chunks']) ? $indexData['chunks'] : array();
$indexMeta = isset($indexData['_meta'])  ? $indexData['_meta']  : array();

if (empty($chunks)) {
    echo json_encode(array('error' => "Index vide. Ouvrir build_index.php."), JSON_UNESCAPED_UNICODE);
    exit;
}

// Index images (optionnel — généré par build_index_images.php)
$indexImagesFile = __DIR__ . '/index_images.json';
$indexImagesMeta = array();
if (file_exists($indexImagesFile)) {
    $imgData = json_decode(file_get_contents($indexImagesFile), true);
    if (isset($imgData['chunks']) && !empty($imgData['chunks'])) {
        $chunks = array_merge($chunks, $imgData['chunks']);
        $indexImagesMeta = isset($imgData['_meta']) ? $imgData['_meta'] : array();
    }
}

// ── Extraction des mots-clés significatifs ────────────────────────────────
$stopWords = array(
    'dans','avec','pour','que','qui','les','des','est','une','sur','par',
    'pas','mais','donc','quand','comment','quel','quelle','quels','selon',
    'sont','cette','tout','plus','tres','bien','aussi','car','ces',
    'cela','elle','elles','eux','lui','nous','vous','ils','leur','leurs',
    'comme','etait','avait','avoir','faire','meme','dont','puis',
    'alors','encore','jamais','toujours','autre','entre','apres','avant',
    'depuis','pendant','sous','vers','chez','sans','trop','peu','etre',
    'moins','avez','avons','avaient','serait','etaient','furent','avons',
);

// Normalise les accents pour la comparaison aux stop words
function removeAccents($str) {
    $from = array('à','â','ä','é','è','ê','ë','î','ï','ô','ö','ù','û','ü','ç','œ','æ',
                  'À','Â','Ä','É','È','Ê','Ë','Î','Ï','Ô','Ö','Ù','Û','Ü','Ç','Œ','Æ');
    $to   = array('a','a','a','e','e','e','e','i','i','o','o','u','u','u','c','oe','ae',
                  'a','a','a','e','e','e','e','i','i','o','o','u','u','u','c','oe','ae');
    return str_replace($from, $to, $str);
}

$rawWords = preg_split('/[\s\p{P}]+/u', mb_strtolower($question));
$words = array_values(array_unique(array_filter($rawWords, function($w) use ($stopWords) {
    return mb_strlen($w) > 2 && !in_array(removeAccents($w), $stopWords);
})));

// ── Recherche dans les chunks de l'index ──────────────────────────────────
$passages = array();
foreach ($chunks as $chunk) {
    $lower = mb_strtolower($chunk['text']);
    $score = 0;
    foreach ($words as $w) {
        // Compter le nombre d'occurrences (pas juste présence/absence)
        $count = mb_substr_count($lower, $w);
        $score += $count;
    }
    if ($score > 0) {
        $passages[] = array('source' => $chunk['source'], 'text' => $chunk['text'], 'score' => $score);
    }
}

if (empty($passages)) {
    echo json_encode(array(
        'answer'  => "Je n'ai trouvé aucune information sur ce sujet dans le site.",
        'sources' => array(),
    ), JSON_UNESCAPED_UNICODE);
    exit;
}

// Tri par score décroissant, on garde les 20 meilleurs chunks
usort($passages, function($a, $b) { return $b['score'] - $a['score']; });
$passages = array_slice($passages, 0, 20);

// ── Sources (calculées avant le dry-run) ──────────────────────────────────
$sourcePaths = array();
foreach ($passages as $p) { $sourcePaths[] = $p['source']; }
$sourcePaths = array_values(array_unique($sourcePaths));

// ── Construction du contexte ──────────────────────────────────────────────
$contextParts = array();
foreach ($passages as $i => $p) {
    $contextParts[] = '[Extrait ' . ($i + 1) . ' — ' . $p['source'] . '] ' . $p['text'];
}
$context = implode("\n\n---\n\n", $contextParts);

$linksInstruction = $ENABLE_LINKS
    ? "- Intègre des liens markdown tout au long du texte, sur les noms de personnes, lieux et événements mentionnés — pas seulement une fois en début de réponse. Chaque information importante issue d'une page source doit être linkée. Vise au moins un lien par paragraphe.\n"
    . "  N'ajoute PAS de lien vers les sources dont le chemin commence par \"geneatree\".\n"
    . "  Exemple correct : \"**[Jean Payan](/1_barles/#/chapitre/1_jean/)** est né vers 1665 à Barles.\"\n"
    . "  Exemple incorrect : \"Jean Payan est né vers 1665 à Barles (voir la page).\"\n"
    . "  Le chemin du lien est la partie après le tiret long dans l'en-tête de chaque extrait, préfixée de \"/\" et suffixée de \"/\"."
    : "- N'ajoute aucun lien dans ta réponse.";

// ── Prompt ────────────────────────────────────────────────────────────────
$prompt = <<<PROMPT
Tu es l'assistant du site familial babouch.fr, dédié à l'histoire des familles Payan et Carlé.
Ce site rassemble des documents généalogiques, des carnets de guerre (Marcel Gotrand, Vincent Payan), des albums photos, des récits historiques sur Marseille, et l'histoire de la famille Carlé en Alsace.

Voici des extraits tirés du site :

$context

Réponds à la question suivante en français :
« $question »

Consignes de rédaction :
- Écris un texte fluide et agréable à lire, comme un récit — pas une liste de données brutes.
- La réponse doit être développée et détaillée : vise au moins 4 à 6 paragraphes si le sujet le permet. Ne résume pas, développe.
- Adopte un ton chaleureux et bienveillant, sans être excessivement enthousiaste.
- Organise ta réponse en paragraphes. Tu peux utiliser le gras (**mot**) pour les noms et dates importants.
- Ne termine PAS la réponse par un paragraphe de synthèse ou de conclusion du type "En somme…", "En résumé…", "Ainsi…", "Pour conclure…" — arrête-toi simplement après le dernier fait pertinent.
- Ne mentionne JAMAIS les "extraits", les "documents fournis" ou les "sources" dans ta réponse : écris directement les informations, comme si tu les connaissais.
- $linksInstruction
- Si l'information est absente, dis-le brièvement et simplement.
- Réponds en JSON strict : {"answer": "ta réponse complète ici"}
PROMPT;

// ── Dry-run : retourne le prompt sans appeler l'API ───────────────────────
if ($dryrun) {
    echo json_encode(array(
        'answer'        => '[dry-run] Appel API non effectué.',
        'sources'       => $sourcePaths,
        'prompt'        => $prompt,
        'dryrun'        => true,
        'nb_chunks'     => count($passages),
        'index_textes'  => $indexMeta,
        'index_images'  => $indexImagesMeta,
    ), JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Appel API IA ──────────────────────────────────────────────────────────
try {
    $result = AI::call($prompt, array('answer'));
    $answer = isset($result['data']['answer']) ? $result['data']['answer'] : "Désolé, je n'ai pas pu générer de réponse.";
} catch (Exception $e) {
    $answer = "Erreur lors de la consultation de l'IA : " . $e->getMessage();
}

echo json_encode(array(
    'answer'  => $answer,
    'sources' => $sourcePaths,
    'prompt'  => $prompt,
), JSON_UNESCAPED_UNICODE);
