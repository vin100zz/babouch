<?php

// -------------------------------------------------------
// Fournisseur IA : 'anthropic' ou 'openai'
// -------------------------------------------------------
//define('AI_PROVIDER', 'anthropic');
define('AI_PROVIDER', 'openai');

define('ANTHROPIC_MODEL', 'claude-opus-4-5');
define('OPENAI_MODEL',    'gpt-5.4');

// -------------------------------------------------------
// Ollama Vision (indexation locale des images)
// -------------------------------------------------------
// URL de l'API Ollama (par défaut : localhost)
define('OLLAMA_URL',     'http://localhost:11434/api/generate');
// Modèle vision à utiliser : 'moondream' (~1.7 Go) ou 'llava' (~4.5 Go)
define('OLLAMA_MODEL',   'llava');
// Timeout par image (secondes)
define('OLLAMA_TIMEOUT', 90);

// Clés API — stockées dans secrets.php (non committé)
require_once __DIR__ . '/secrets.php';

// Timeout des appels IA (en secondes)
define('AI_TIMEOUT', 180);

// Nombre maximum de tokens générés — 4000 pour le chatbot (réponses longues)
define('AI_MAX_TOKENS', 4000);

?>
