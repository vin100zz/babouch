<?php
/**
 * Lecture/écriture du fichier JSON d'un site (<site>/data.json).
 *
 * Un site n'existe pas forcément encore sur disque : getSite() renvoie alors
 * un squelette vide sans rien écrire ; c'est le premier save() qui crée le
 * fichier. Écriture verrouillée + atomique, sur le modèle de
 * famille2/JsonPersonRepository::persist().
 */
class SiteRepository
{
    private $site;
    private $path;

    public function __construct($site)
    {
        if (!isValidSiteName($site)) {
            throw new RuntimeException('Nom de site invalide : ' . $site);
        }
        $this->site = $site;
        $this->path = siteJsonPath($site);
    }

    public function get()
    {
        if (!is_file($this->path)) {
            return $this->emptySite();
        }
        $raw = file_get_contents($this->path);
        if ($raw === false) {
            throw new RuntimeException('Impossible de lire : ' . $this->path);
        }
        $data = json_decode($raw, true);
        if ($data === null) {
            throw new RuntimeException('JSON invalide : ' . $this->path);
        }
        return $data;
    }

    public function save($data)
    {
        if (!is_array($data)) {
            throw new RuntimeException('Corps invalide : un objet est attendu');
        }
        $clean = array(
            'titre_site' => isset($data['titre_site']) ? (string) $data['titre_site'] : $this->site,
            'home'       => $this->cleanHome(isset($data['home']) ? $data['home'] : array()),
            'chapitres'  => $this->cleanChapitres(isset($data['chapitres']) ? $data['chapitres'] : array()),
        );

        $siteDir = dirname($this->path);
        if (!is_dir($siteDir)) {
            throw new RuntimeException('Dossier du site introuvable : ' . $this->site);
        }

        $json = json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        if ($json === false) {
            throw new RuntimeException('Erreur d\'encodage JSON : ' . json_last_error_msg());
        }

        $fp = fopen($this->path, 'c+');
        if (!$fp) {
            throw new RuntimeException('Impossible d\'ouvrir : ' . $this->path);
        }
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            throw new RuntimeException('Impossible de verrouiller le fichier JSON');
        }
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, $json);
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        return $clean;
    }

    private function emptySite()
    {
        return array(
            'titre_site' => $this->site,
            'home'       => array('images' => array()),
            'chapitres'  => array(),
        );
    }

    private function cleanHome($home)
    {
        $images = array();
        foreach ((isset($home['images']) && is_array($home['images'])) ? $home['images'] : array() as $img) {
            if (!is_array($img)) {
                continue;
            }
            $images[] = array(
                'id'     => isset($img['id']) ? (string) $img['id'] : uniqid('img_'),
                'image'  => isset($img['image']) ? (string) $img['image'] : '',
                'x'      => isset($img['x']) ? (int) $img['x'] : 0,
                'y'      => isset($img['y']) ? (int) $img['y'] : 0,
                'texte'  => (isset($img['texte']) && $img['texte'] !== '') ? (string) $img['texte'] : null,
                'lien'   => (isset($img['lien']) && $img['lien'] !== '') ? (string) $img['lien'] : null,
            );
        }
        return array('images' => $images);
    }

    /** Nettoie récursivement l'arbre de chapitres. */
    private function cleanChapitres($chapitres)
    {
        if (!is_array($chapitres)) {
            return array();
        }
        $out = array();
        foreach ($chapitres as $node) {
            if (!is_array($node)) {
                continue;
            }
            $clean = array(
                'keyword' => isset($node['keyword']) ? (string) $node['keyword'] : '',
                'label'   => isset($node['label'])   ? (string) $node['label']   : '',
            );
            $hasChildren = isset($node['chapitres']) && is_array($node['chapitres']) && count($node['chapitres']) > 0;
            if ($hasChildren) {
                $clean['chapitres'] = $this->cleanChapitres($node['chapitres']);
            } else {
                $clean['chapitres'] = array();
                $clean['sections']  = $this->cleanSections(isset($node['sections']) ? $node['sections'] : array());
            }
            $out[] = $clean;
        }
        return $out;
    }

    private function cleanSections($sections)
    {
        if (!is_array($sections)) {
            return array();
        }
        $out = array();
        foreach ($sections as $section) {
            if (!is_array($section)) {
                continue;
            }
            $colonnes = array();
            foreach ((isset($section['colonnes']) && is_array($section['colonnes'])) ? $section['colonnes'] : array() as $col) {
                $colonnes[] = $this->cleanBlocs(is_array($col) ? $col : array());
            }
            if (empty($colonnes)) {
                $colonnes = array(array());
            }
            $out[] = array(
                'titre'    => (isset($section['titre']) && $section['titre'] !== '') ? (string) $section['titre'] : null,
                'colonnes' => $colonnes,
            );
        }
        return $out;
    }

    private function cleanBlocs($blocs)
    {
        $out = array();
        foreach ($blocs as $bloc) {
            if (!is_array($bloc) || !isset($bloc['type'])) {
                continue;
            }
            if ($bloc['type'] === 'TEXTE') {
                $out[] = array(
                    'type'  => 'TEXTE',
                    'html'  => isset($bloc['html']) ? (string) $bloc['html'] : '',
                    'align' => in_array(isset($bloc['align']) ? $bloc['align'] : '', array('left', 'center', 'right'), true) ? $bloc['align'] : 'left',
                );
            } elseif ($bloc['type'] === 'DOCUMENTS') {
                $out[] = array(
                    'type'   => 'DOCUMENTS',
                    'fichier'=> isset($bloc['fichier']) ? (string) $bloc['fichier'] : '',
                    'width'  => isset($bloc['width']) ? (int) $bloc['width'] : 100,
                );
            }
        }
        return $out;
    }
}
