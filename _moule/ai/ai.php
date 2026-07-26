<?php

/**
 * Utilitaire générique d'appel aux APIs AI (Anthropic / OpenAI).
 *
 * Usage :
 *   require_once 'utils/ai.php';
 *   $result = AI::call($prompt);          // retourne un tableau associatif décodé du JSON renvoyé par l'IA
 *   $result = AI::call($prompt, $schema); // idem, avec validation de clés attendues
 *
 * Le fichier services/config.php doit définir les constantes :
 *   AI_PROVIDER       ('anthropic' ou 'openai', défaut : 'anthropic')
 *   ANTHROPIC_API_KEY / OPENAI_API_KEY
 *   ANTHROPIC_MODEL   / OPENAI_MODEL     (optionnel)
 *   AI_MAX_TOKENS                        (optionnel, défaut : 1024)
 *   AI_TIMEOUT                           (optionnel, défaut : 180)
 */
class AI {

  /**
   * Envoie un prompt à l'API AI configurée et retourne un tableau PHP.
   *
   * @param  string        $prompt   Le prompt à envoyer (doit demander une réponse JSON).
   * @param  string[]|null $keys     Clés JSON attendues dans la réponse (validation optionnelle).
   * @param  array|null    $images   Tableau d'images à envoyer : chaque entrée est
   *                                 ['data' => <base64>, 'media_type' => 'image/jpeg'|'image/png'|...].
   * @return array  ['data' => array, 'truncated' => bool]
   * @throws RuntimeException en cas d'erreur de configuration ou d'API.
   */
  public static function call($prompt, $keys = null, $images = null) {
    $provider = defined('AI_PROVIDER') ? AI_PROVIDER : 'anthropic';
    $timeout  = defined('AI_TIMEOUT')    ? AI_TIMEOUT    : 180;
    $maxTokens = defined('AI_MAX_TOKENS') ? AI_MAX_TOKENS : 1024;

    // --- Validation de la configuration ---
    if ($provider === 'openai') {
      if (!defined('OPENAI_API_KEY') || OPENAI_API_KEY === 'YOUR_OPENAI_KEY_HERE') {
        throw new RuntimeException('Clé API OpenAI non configurée. Modifiez services/config.php.');
      }
      $model   = defined('OPENAI_MODEL') ? OPENAI_MODEL : 'gpt-4o';
      // Construction du contenu (texte + images éventuelles)
      if (!empty($images)) {
        $contentParts = [];
        foreach ($images as $img) {
          $contentParts[] = [
            'type'      => 'image_url',
            'image_url' => ['url' => 'data:' . $img['media_type'] . ';base64,' . $img['data']]
          ];
        }
        $contentParts[] = ['type' => 'text', 'text' => $prompt];
      } else {
        $contentParts = $prompt;
      }
      $payload = json_encode([
        'model'                 => $model,
        'max_completion_tokens' => $maxTokens,
        'messages'              => [['role' => 'user', 'content' => $contentParts]],
        'response_format'       => ['type' => 'json_object']
      ], JSON_UNESCAPED_UNICODE);
      $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . OPENAI_API_KEY,
        'Content-Length: ' . strlen($payload)
      ];
      $apiUrl  = 'https://api.openai.com/v1/chat/completions';
      $apiName = 'OpenAI';
    } else {
      if (!defined('ANTHROPIC_API_KEY') || ANTHROPIC_API_KEY === 'YOUR_API_KEY_HERE') {
        throw new RuntimeException('Clé API Anthropic non configurée. Modifiez services/config.php.');
      }
      $model   = defined('ANTHROPIC_MODEL') ? ANTHROPIC_MODEL : 'claude-opus-4-5';
      // Construction du contenu (texte + images éventuelles)
      if (!empty($images)) {
        $contentParts = [];
        foreach ($images as $img) {
          $contentParts[] = [
            'type'   => 'image',
            'source' => [
              'type'       => 'base64',
              'media_type' => $img['media_type'],
              'data'       => $img['data']
            ]
          ];
        }
        $contentParts[] = ['type' => 'text', 'text' => $prompt];
      } else {
        $contentParts = $prompt;
      }
      $payload = json_encode([
        'model'      => $model,
        'max_tokens' => $maxTokens,
        'messages'   => [['role' => 'user', 'content' => $contentParts]]
      ], JSON_UNESCAPED_UNICODE);
      $headers = [
        'Content-Type: application/json',
        'x-api-key: ' . ANTHROPIC_API_KEY,
        'anthropic-version: 2023-06-01',
        'Content-Length: ' . strlen($payload)
      ];
      $apiUrl  = 'https://api.anthropic.com/v1/messages';
      $apiName = 'Anthropic';
    }

    // --- Appel HTTP ---
    $response = self::httpPost($apiUrl, $headers, $payload, $timeout, $apiName);
    $httpCode = $response['httpCode'];
    $body     = $response['body'];

    if ($httpCode !== 200) {
      throw new RuntimeException("Erreur API $apiName (HTTP $httpCode) : $body");
    }

    $apiData = json_decode($body, true);

    // --- Extraction du contenu et détection de troncature ---
    $truncated = false;
    if ($provider === 'openai') {
      $finishReason = isset($apiData['choices'][0]['finish_reason']) ? $apiData['choices'][0]['finish_reason'] : '';
      $truncated    = ($finishReason === 'length');
      $content      = isset($apiData['choices'][0]['message']['content']) ? $apiData['choices'][0]['message']['content'] : '';
    } else {
      $stopReason = isset($apiData['stop_reason']) ? $apiData['stop_reason'] : '';
      $truncated  = ($stopReason === 'max_tokens');
      $content    = isset($apiData['content'][0]['text']) ? $apiData['content'][0]['text'] : '';
    }

    // --- Réparation du JSON tronqué ---
    if ($truncated) {
      $content = rtrim($content);
      if (substr($content, -1) !== '"' && substr($content, -1) !== '}') {
        $content .= '…"}';
      } elseif (substr($content, -1) === '"') {
        $content .= '}';
      }
    }

    // --- Nettoyage des backticks éventuels ---
    if (preg_match('/```(?:json)?\s*(\{[\s\S]*\})\s*```/s', $content, $matches)) {
      $content = $matches[1];
    } else {
      $start = strpos($content, '{');
      $end   = strrpos($content, '}');
      if ($start !== false && $end !== false) {
        $content = substr($content, $start, $end - $start + 1);
      }
    }

    $data = json_decode($content, true);

    if (!is_array($data)) {
      $data = ['raw' => strip_tags($content)];
    }

    // --- Validation des clés attendues ---
    if ($keys !== null) {
      foreach ($keys as $key) {
        if (!isset($data[$key])) {
          $data[$key] = null;
        }
      }
    }

    return ['data' => $data, 'truncated' => $truncated];
  }

  // ---------------------------------------------------------------------------
  // Méthode HTTP interne
  // ---------------------------------------------------------------------------

  private static function httpPost($url, $headers, $payload, $timeout, $apiName) {
    if (function_exists('curl_init')) {
      $ch = curl_init($url);
      curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
      ]);
      $body      = curl_exec($ch);
      $httpCode  = intval(curl_getinfo($ch, CURLINFO_HTTP_CODE));
      $curlError = curl_error($ch);
      curl_close($ch);

      if ($body === false || $curlError) {
        throw new RuntimeException("Impossible de contacter l'API $apiName via cURL : $curlError");
      }

      return ['httpCode' => $httpCode, 'body' => $body];
    }

    // Fallback file_get_contents
    $context = stream_context_create([
      'http' => [
        'method'        => 'POST',
        'header'        => implode("\r\n", $headers),
        'content'       => $payload,
        'timeout'       => $timeout,
        'ignore_errors' => true
      ],
      'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]
    ]);
    $body = @file_get_contents($url, false, $context);

    if ($body === false) {
      throw new RuntimeException("Impossible de contacter l'API $apiName. cURL est désactivé et allow_url_fopen est désactivé dans php.ini.");
    }

    $httpCode = 0;
    if (isset($http_response_header)) {
      foreach ($http_response_header as $h) {
        if (preg_match('#HTTP/\d+\.\d+\s+(\d+)#', $h, $m)) {
          $httpCode = intval($m[1]);
        }
      }
    }

    return ['httpCode' => $httpCode, 'body' => $body];
  }
}

