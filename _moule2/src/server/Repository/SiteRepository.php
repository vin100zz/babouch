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
            'pagesStyle' => $this->cleanPagesStyle(isset($data['pagesStyle']) ? $data['pagesStyle'] : array()),
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
        $json = $this->reindentTo2Spaces($json);

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

    /**
     * JSON_PRETTY_PRINT indente toujours à 4 espaces (pas d'option native pour
     * changer ça côté PHP) : on retasse chaque indentation de tête à 2 espaces
     * par niveau après coup. Sûr ligne à ligne, car json_encode échappe tout
     * retour à la ligne à l'intérieur d'une chaîne (\n littéral), donc chaque
     * saut de ligne réel du JSON pretty-printé est structurel.
     */
    private function reindentTo2Spaces($json)
    {
        $lines = explode("\n", $json);
        foreach ($lines as &$line) {
            if (preg_match('/^( +)/', $line, $m)) {
                $level = strlen($m[1]) / 4;
                $line = str_repeat('  ', (int) $level) . substr($line, strlen($m[1]));
            }
        }
        return implode("\n", $lines);
    }

    private function emptySite()
    {
        return array(
            'titre_site' => $this->site,
            'home'       => array(
                'images'      => array(),
                'headerStyle' => $this->cleanHeaderStyle(array()),
                'background'  => $this->cleanBackground(array()),
            ),
            'pagesStyle' => $this->cleanPagesStyle(array()),
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
        return array(
            'images'      => $images,
            'headerStyle' => $this->cleanHeaderStyle(isset($home['headerStyle']) && is_array($home['headerStyle']) ? $home['headerStyle'] : array()),
            'background'  => $this->cleanBackground(isset($home['background']) && is_array($home['background']) ? $home['background'] : array()),
        );
    }

    /**
     * Couleur/image de fond + apparence du titre (taille/couleur/police/
     * alignement) du header. `image`/`mode` ici sont ceux utilisés quand le
     * header s'affiche sur la page d'accueil (voir cleanPagesStyle pour
     * l'équivalent propre aux autres pages).
     */
    private function cleanHeaderStyle($style)
    {
        return array(
            'bg'           => $this->cleanColor(isset($style['bg']) ? $style['bg'] : null, '#1e293b'),
            'titleColor'   => $this->cleanColor(isset($style['titleColor']) ? $style['titleColor'] : null, '#ffffff'),
            'titleSize'    => isset($style['titleSize']) ? max(10, min(150, (int) $style['titleSize'])) : 18,
            'titleFont'    => isset($style['titleFont']) ? (string) $style['titleFont'] : '',
            'titleFontFile'=> $this->cleanRelPath(isset($style['titleFontFile']) ? $style['titleFontFile'] : null),
            'titleAlign'   => in_array(isset($style['titleAlign']) ? $style['titleAlign'] : '', array('left', 'center', 'right'), true) ? $style['titleAlign'] : 'left',
            'image'        => $this->cleanRelPath(isset($style['image']) ? $style['image'] : null),
            'mode'         => in_array(isset($style['mode']) ? $style['mode'] : '', array('cover', 'contain', 'repeat'), true) ? $style['mode'] : 'cover',
        );
    }

    /** Couleur + image (optionnelle) + mode d'affichage du fond de la page d'accueil. */
    private function cleanBackground($bg)
    {
        return array(
            'color' => $this->cleanColor(isset($bg['color']) ? $bg['color'] : null, '#fafbfc'),
            'image' => $this->cleanRelPath(isset($bg['image']) ? $bg['image'] : null),
            'mode'  => in_array(isset($bg['mode']) ? $bg['mode'] : '', array('cover', 'contain', 'repeat'), true) ? $bg['mode'] : 'cover',
        );
    }

    /**
     * Style des pages de contenu (sous-menus/feuilles, hors page d'accueil) :
     * fond de page + apparence des titres de section, blocs TEXTE et bordure
     * des images. Le header (couleur, police, taille, alignement) reste géré
     * par home.headerStyle (un seul header, partagé par toutes les pages du
     * site) ; seule son image de fond peut différer ici (headerBackground),
     * pour permettre une image propre à la page d'accueil et une autre aux
     * autres pages.
     */
    private function cleanPagesStyle($ps)
    {
        if (!is_array($ps)) {
            $ps = array();
        }
        $hb = (isset($ps['headerBackground']) && is_array($ps['headerBackground'])) ? $ps['headerBackground'] : array();
        return array(
            'background'      => $this->cleanBackground(isset($ps['background']) && is_array($ps['background']) ? $ps['background'] : array()),
            'headerBackground'=> array(
                'image' => $this->cleanRelPath(isset($hb['image']) ? $hb['image'] : null),
                'mode'  => in_array(isset($hb['mode']) ? $hb['mode'] : '', array('cover', 'contain', 'repeat'), true) ? $hb['mode'] : 'cover',
            ),
            'section'    => $this->cleanColorTextPair(isset($ps['section']) && is_array($ps['section']) ? $ps['section'] : array(), '#d0e4ff', '#1e293b'),
            'blocTexte'  => $this->cleanColorTextPair(isset($ps['blocTexte']) && is_array($ps['blocTexte']) ? $ps['blocTexte'] : array(), '#e3f8ff', '#1e293b'),
            'image'      => $this->cleanImageStyle(isset($ps['image']) && is_array($ps['image']) ? $ps['image'] : array()),
        );
    }

    private function cleanColorTextPair($v, $defaultBg, $defaultText)
    {
        return array(
            'bg'        => $this->cleanColor(isset($v['bg']) ? $v['bg'] : null, $defaultBg),
            'textColor' => $this->cleanColor(isset($v['textColor']) ? $v['textColor'] : null, $defaultText),
        );
    }

    private function cleanImageStyle($v)
    {
        return array(
            'borderColor'  => $this->cleanColor(isset($v['borderColor']) ? $v['borderColor'] : null, '#333333'),
            'borderWidth'  => isset($v['borderWidth']) ? max(0, min(20, (int) $v['borderWidth'])) : 1,
            'borderRadius' => isset($v['borderRadius']) ? max(0, min(200, (int) $v['borderRadius'])) : 0,
        );
    }

    /** #rrggbb ou #rrggbbaa (canal alpha optionnel, pour la transparence). */
    private function cleanColor($value, $default)
    {
        if (is_string($value) && preg_match('/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/', $value)) {
            return $value;
        }
        return $default;
    }

    /** Chemin relatif (documents/ ou style/) sans traversal ; null si absent/invalide. */
    private function cleanRelPath($value)
    {
        if (!is_string($value) || $value === '') {
            return null;
        }
        $value = ltrim($value, '/\\');
        if (strpos($value, '..') !== false) {
            return null;
        }
        return $value;
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
            } elseif ($bloc['type'] === 'HTML') {
                // Contenu HTML libre, non filtré : à la différence du bloc
                // TEXTE (sous-ensemble b/i/u/br/a imposé par l'éditeur riche),
                // celui-ci est saisi et rendu tel quel (couvre les tableaux et
                // autre contenu sans équivalent dans le modèle de blocs).
                // Éditable uniquement par le propriétaire du site depuis son
                // propre CMS : pas une entrée publique, donc pas de risque XSS
                // tiers à filtrer ici.
                $out[] = array(
                    'type' => 'HTML',
                    'html' => isset($bloc['html']) ? (string) $bloc['html'] : '',
                );
            }
        }
        return $out;
    }
}
