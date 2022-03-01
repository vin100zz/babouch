<?php

$site = $_REQUEST["site"];

$content = file_get_contents('php://input');

file_put_contents("../../" . $site . "../contenu/chapitres.json", $content);

?>