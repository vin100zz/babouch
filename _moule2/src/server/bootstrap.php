<?php
if (PHP_MAJOR_VERSION < 7) {
    @ini_set('always_populate_raw_post_data', '-1');
}
error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Repository/SiteRepository.php';
require_once __DIR__ . '/Api/Response.php';
