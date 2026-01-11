<?php

$chapitreId = $_REQUEST["chapitreId"];
$pageId = $_REQUEST["pageId"];

$jsonFile = file_get_contents("chapitres.json");
$json = json_decode($jsonFile, true);

$htmlFile = "pages/" . $json["chapitres"][$chapitreId]["sous_chapitres"][$pageId]["page_html"];

$aReturn = array();

if(is_file($htmlFile) && $htmlContent = utf8_encode(implode(file($htmlFile))))
{
	$path = explode("/", $htmlFile);
	array_pop($path);
	$path = "contenu/" . implode("/", $path);
	
	$htmlContent = str_replace("src=\"", "src=\"$path/", $htmlContent);
	$htmlContent = str_replace("href=\"", "href=\"$path/", $htmlContent);
  
  $htmlContent = str_replace("$path/http", "http", $htmlContent);
  $htmlContent = str_replace("$path/#", "#", $htmlContent);
  
	$aReturn['htmlContent'] = $htmlContent;
}

print json_encode($aReturn, JSON_PRETTY_PRINT);


?>