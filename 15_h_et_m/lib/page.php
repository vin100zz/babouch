<?php

$paths = $_REQUEST["paths"];
$site = $_REQUEST["site"];

$dir = "../../" . $site . "/contenu/pages/" . $paths;

$files = scandir($dir);

for ($i=0; $i<count($files); ++$i) {
  if (preg_match("/\.html$/", $files[$i])) {
    $htmlFile = $dir . "/" . $files[$i];
    break;
  }
}

$res = array();

if (is_file($htmlFile) && $htmlContent = utf8_encode(implode(file($htmlFile))))
{
  $path = explode("/", $htmlFile);
  array_pop($path);
  $path = "contenu/" . implode("/", $path);

  $htmlContent = str_replace("src=\"", "src=\"$path/", $htmlContent);
  $htmlContent = str_replace("href=\"", "href=\"$path/", $htmlContent);
  
  $htmlContent = str_replace("$path/http", "http", $htmlContent);
  $htmlContent = str_replace("$path/#", "#", $htmlContent);
  
  $res['htmlContent'] = $htmlContent;
}

print json_encode($res, JSON_PRETTY_PRINT);

?>