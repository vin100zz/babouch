<?php

set_time_limit(600);

$query = strtolower($_REQUEST["query"]);
$category = strtolower($_REQUEST["category"]);

$folders = array();
if ($category == "voyages") {
  $folders[] = "../r1/";
} else if ($category == "annees") {
  for ($i=2009; $i<=2040; ++$i) {
    $folders[] = "../$i";
  }
  $folders[] = "../souvenirs/";
} else if ($category == "famille") {
  $folders[] = "../1_barles/";
  $folders[] = "../2_andre/";
  $folders[] = "../3_francois/";
  $folders[] = "../4_rosine/";
  $folders[] = "../4a_recensements/";
  $folders[] = "../5_fmp/";
  $folders[] = "../6_vpnew/";
  $folders[] = "../7_guerrevincent/";
  $folders[] = "../8_alsace/";
  $folders[] = "../11_florian/";
  $folders[] = "../12_lemesle/";
  $folders[] = "../13_nicolas/";
  $folders[] = "../1_barles/";
  $folders[] = "../14_castelin/";
  $folders[] = "../15_h_et_m/";
  $folders[] = "../domiciles_site/";
  $folders[] = "../famille/";
  $folders[] = "../jean_et_leo/";
  $folders[] = "../rue_guerin/";
}

$res = array();

foreach ($folders as $folder) {
  getResults($res, $folder, $query);
}


print json_encode($res, JSON_PRETTY_PRINT);


// -----------------

function getResults(&$results, $folder, $query) {

  $files = getDirContents($folder);

  for ($i=0; $i<count($files); ++$i) {
    $file = $files[$i];

    $content = file_get_contents($file);

    $content = preg_replace("/<.*?>/", " ", $content);
    $content = str_replace("\t", "", $content);
    $content = str_replace("\n", "", $content);
    $content = str_replace("\r", "", $content);
    $content = str_replace("  ", " ", $content);

    $pos = strpos(strtolower($content), $query);

    $NB_CHAR_CONTEXT = 150;

    if ($pos !== false) {
      $start = max(0, $pos - $NB_CHAR_CONTEXT);
      $length = $start == 0 ? $pos : $NB_CHAR_CONTEXT;

      $results[] = array(
        "file" => $file,
        "before" => utf8_encode(($pos < $NB_CHAR_CONTEXT ? '' : '...' ) . substr($content, $start, $length)),
        "match" => utf8_encode(substr($content, $pos, strlen($query))),
        "after" => utf8_encode(substr($content, $pos + strlen($query), $NB_CHAR_CONTEXT) . '...')
      );
    }
  }

}               


function getDirContents($dir, &$results = array()) {
  if (!is_dir($dir)){
    return $results;
  }

  $files = scandir($dir);

  foreach ($files as $key => $value) {
      $path = realpath($dir . DIRECTORY_SEPARATOR . $value);
      if (!is_dir($path)) {
        if (endsWith($path, '.html') && (strpos($path, "\\contenu\\") !== false || strpos($path, "/contenu/") !== false || strpos($path, "\\content\\") !== false || strpos($path, "/content/") !== false)) {
          $results[] = $path;
          //print "<div>$path</div>";
        }
      } else if ($value != "." && $value != "..") {
          getDirContents($path, $results);
          //$results[] = $path;
      }
  }

  return $results;
}

function endsWith($haystack, $needle) {
  $length = strlen($needle);
  if (!$length) {
    return true;
  }
  return substr($haystack, -$length) === $needle;
}

?>