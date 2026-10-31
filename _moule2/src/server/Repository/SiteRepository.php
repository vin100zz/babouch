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
    /** Nom d'affichage du site (dernier segment de son chemin). */
    private $site;
    private $path;

    /** Problèmes non bloquants du dernier save() (ex. police Google non téléchargée). */
    private $warnings = array();

    /** Nom de police Google → fichier dans style/ (ou null), une fois par save(). */
    private $googleFonts = array();

    /** @param string $site chemin du site relatif à la racine (ex. 'espace2', 'r1/sardaigne') */
    public function __construct($site)
    {
        if (!isValidSitePath($site)) {
            throw new RuntimeException('Chemin de site invalide : ' . $site);
        }
        $this->site = basename($site);
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
            'pagesStyle' => $this->cleanPagesStyle(
                isset($data['pagesStyle']) ? $data['pagesStyle'] : array(),
                isset($data['home']['headerStyle']) && is_array($data['home']['headerStyle']) ? $data['home']['headerStyle'] : array()
            ),
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

    /** @return string[] */
    public function getWarnings()
    {
        return $this->warnings;
    }

    /**
     * Police Google (font = 'gf:<nom>') : renseigne fontFile avec la copie
     * locale de la police dans style/fonts/, téléchargée au premier
     * enregistrement qui l'utilise. Les visiteurs ne contactent ainsi jamais
     * Google. En cas d'échec, fontFile reste null : le site charge alors la
     * police depuis Google (voir HomeView.cssFontFamily), et le prochain
     * enregistrement retente le téléchargement.
     */
    private function localizeGoogleFont(&$font, &$fontFile)
    {
        if (!is_string($font) || strpos($font, 'gf:') !== 0) {
            return;
        }
        $fontFile = null;
        $name = substr($font, 3);
        if (!preg_match('/^[A-Za-z0-9 ]{1,60}$/', $name)) {
            $font = '';
            return;
        }
        if (!array_key_exists($name, $this->googleFonts)) {
            $this->googleFonts[$name] = $this->downloadGoogleFont($name);
        }
        $fontFile = $this->googleFonts[$name];
    }

    /**
     * Télécharge une police Google dans <site>/style/fonts/ : <Nom>.ttf
     * (normal) et, si la police existe en gras, <Nom>-bold.ttf. Sans
     * User-Agent de navigateur, l'API de Google renvoie un seul fichier
     * TrueType complet par graisse (tous alphabets), au lieu de fichiers woff2
     * découpés par alphabet.
     * @return string|null chemin relatif à style/ du fichier normal
     */
    private function downloadGoogleFont($name)
    {
        $slug = str_replace(' ', '-', $name);
        $rel = 'fonts/' . $slug . '.ttf';
        $dir = dirname($this->path) . DIRECTORY_SEPARATOR . 'style' . DIRECTORY_SEPARATOR . 'fonts';
        $regular = $dir . DIRECTORY_SEPARATOR . $slug . '.ttf';
        if (is_file($regular)) {
            return $rel;
        }
        $fail = 'La police « ' . $name . ' » n\'a pas pu être copiée sur le site'
            . ' (%s) : elle reste chargée depuis Google. Un prochain enregistrement réessaiera.';

        $css = $this->httpGet('https://fonts.googleapis.com/css2?family=' . str_replace(' ', '+', $name) . ':wght@400;700');
        if ($css === null) {
            $css = $this->httpGet('https://fonts.googleapis.com/css2?family=' . str_replace(' ', '+', $name));
        }
        $urls = array();
        if ($css !== null && preg_match_all('#font-weight:\s*(\d+);\s*src:\s*url\((https://fonts\.gstatic\.com/[^)\s]+\.ttf)\)#', $css, $m, PREG_SET_ORDER)) {
            foreach ($m as $face) {
                $urls[$face[1]] = $face[2];
            }
        }
        if (!isset($urls['400'])) {
            $this->warnings[] = sprintf($fail, 'Google Fonts injoignable depuis le serveur');
            return null;
        }
        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
            $this->warnings[] = sprintf($fail, 'impossible de créer le dossier style/fonts');
            return null;
        }
        // Le gras d'abord : le fichier normal, qui sert de témoin « déjà
        // téléchargée », n'est écrit qu'une fois tout le reste réussi.
        $targets = array('700' => $dir . DIRECTORY_SEPARATOR . $slug . '-bold.ttf', '400' => $regular);
        foreach ($targets as $weight => $file) {
            if (!isset($urls[$weight])) {
                continue;
            }
            $data = $this->httpGet($urls[$weight]);
            if ($data === null || strlen($data) < 1000) {
                $this->warnings[] = sprintf($fail, 'téléchargement du fichier échoué');
                return null;
            }
            if (@file_put_contents($file, $data) === false) {
                $this->warnings[] = sprintf($fail, 'écriture dans style/fonts impossible');
                return null;
            }
        }
        return $rel;
    }

    /** Corps d'une réponse HTTP 200, ou null (erreur, autre statut, aucun moyen d'accès). */
    private function httpGet($url)
    {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
            $body = curl_exec($ch);
            $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            return ($body !== false && $status == 200) ? $body : null;
        }
        if (ini_get('allow_url_fopen')) {
            $ctx = stream_context_create(array('http' => array('timeout' => 30, 'ignore_errors' => true, 'header' => "User-Agent: moule2\r\n")));
            $body = @file_get_contents($url, false, $ctx);
            if ($body === false || !isset($http_response_header[0]) || !preg_match('#^HTTP/\S+\s+200\b#', $http_response_header[0])) {
                return null;
            }
            return $body;
        }
        return null;
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
            'pagesStyle' => $this->cleanPagesStyle(array(), array()),
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
            $clean = array(
                'id'     => isset($img['id']) ? (string) $img['id'] : uniqid('img_'),
                'image'  => isset($img['image']) ? (string) $img['image'] : '',
                'x'      => isset($img['x']) ? (int) $img['x'] : 0,
                'y'      => isset($img['y']) ? (int) $img['y'] : 0,
                // Largeur en px après redimensionnement ; null = taille naturelle.
                'width'  => (isset($img['width']) && (int) $img['width'] > 0) ? max(10, min(1000, (int) $img['width'])) : null,
                'texte'  => (isset($img['texte']) && $img['texte'] !== '') ? (string) $img['texte'] : null,
                'lien'   => (isset($img['lien']) && $img['lien'] !== '') ? (string) $img['lien'] : null,
            );
            // Police/taille/couleur du texte affiché sous l'image (facultatif).
            $texteStyle = $this->cleanTextExtras(isset($img['texteStyle']) ? $img['texteStyle'] : null);
            if (!empty($texteStyle)) {
                $clean['texteStyle'] = $texteStyle;
            }
            // Décalage du texte (px) par rapport à sa place sous l'image.
            foreach (array('texteX', 'texteY') as $k) {
                if (isset($img[$k]) && is_numeric($img[$k]) && (int) $img[$k] !== 0) {
                    $clean[$k] = max(-2000, min(2000, (int) $img[$k]));
                }
            }
            $images[] = $clean;
        }
        return array(
            'images'      => $images,
            'headerStyle' => $this->cleanHeaderStyle(isset($home['headerStyle']) && is_array($home['headerStyle']) ? $home['headerStyle'] : array()),
            'background'  => $this->cleanBackground(isset($home['background']) && is_array($home['background']) ? $home['background'] : array()),
        );
    }

    /**
     * Couleur/image de fond + apparence du titre (taille/couleur/police/
     * alignement) du header. `image`/`mode` et le titre ici sont ceux utilisés
     * quand le header s'affiche sur la page d'accueil (voir cleanPagesStyle
     * pour l'équivalent propre aux autres pages).
     */
    private function cleanHeaderStyle($style)
    {
        $clean = array_merge(
            array('bg' => $this->cleanColor(isset($style['bg']) ? $style['bg'] : null, '#1e293b')),
            $this->cleanHeaderTitle($style),
            array(
                'image' => $this->cleanRelPath(isset($style['image']) ? $style['image'] : null),
                'mode'  => in_array(isset($style['mode']) ? $style['mode'] : '', array('cover', 'contain', 'repeat'), true) ? $style['mode'] : 'cover',
            ),
            $this->cleanHeaderPadding($style)
        );
        return $clean;
    }

    /** Marge intérieure du header (facultative, absente = padding du CSS). */
    private function cleanHeaderPadding($style)
    {
        $out = array();
        foreach (array('padY', 'padX') as $k) {
            if (isset($style[$k]) && is_numeric($style[$k])) {
                $out[$k] = max(0, min(300, (int) $style[$k]));
            }
        }
        return $out;
    }

    /** Apparence du titre du site dans le header (clés title*). */
    private function cleanHeaderTitle($style)
    {
        $clean = array(
            'titleColor'   => $this->cleanColor(isset($style['titleColor']) ? $style['titleColor'] : null, '#ffffff'),
            'titleSize'    => isset($style['titleSize']) ? max(10, min(150, (int) $style['titleSize'])) : 18,
            'titleFont'    => isset($style['titleFont']) ? (string) $style['titleFont'] : '',
            'titleFontFile'=> $this->cleanRelPath(isset($style['titleFontFile']) ? $style['titleFontFile'] : null),
            'titleAlign'   => in_array(isset($style['titleAlign']) ? $style['titleAlign'] : '', array('left', 'center', 'right'), true) ? $style['titleAlign'] : 'left',
        );
        $this->localizeGoogleFont($clean['titleFont'], $clean['titleFontFile']);
        return $clean;
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
     * des images, et header propre aux autres pages : remplissage, titre et
     * marges (header), image de fond (headerBackground), fond et couleur du
     * texte du fil d'Ariane (breadcrumb). Sans `header` (site
     * enregistré avant), on reprend headerTitle (titre seul, version
     * précédente) par-dessus le header de l'accueil (`$homeHeader`).
     */
    private function cleanPagesStyle($ps, $homeHeader)
    {
        if (!is_array($ps)) {
            $ps = array();
        }
        $hb = (isset($ps['headerBackground']) && is_array($ps['headerBackground'])) ? $ps['headerBackground'] : array();
        if (isset($ps['header']) && is_array($ps['header'])) {
            $h = $ps['header'];
        } else {
            $h = array_merge($homeHeader, (isset($ps['headerTitle']) && is_array($ps['headerTitle'])) ? $ps['headerTitle'] : array());
        }
        $fi = (isset($ps['footerIcon']) && is_array($ps['footerIcon'])) ? $ps['footerIcon'] : array();
        $bc = (isset($ps['breadcrumb']) && is_array($ps['breadcrumb'])) ? $ps['breadcrumb'] : array();
        return array(
            'background'      => $this->cleanBackground(isset($ps['background']) && is_array($ps['background']) ? $ps['background'] : array()),
            'headerBackground'=> array(
                'image' => $this->cleanRelPath(isset($hb['image']) ? $hb['image'] : null),
                'mode'  => in_array(isset($hb['mode']) ? $hb['mode'] : '', array('cover', 'contain', 'repeat'), true) ? $hb['mode'] : 'cover',
            ),
            'header'          => array_merge(
                array('bg' => $this->cleanColor(isset($h['bg']) ? $h['bg'] : null, '#1e293b')),
                $this->cleanHeaderTitle($h),
                $this->cleanHeaderPadding($h)
            ),
            'section'    => $this->cleanColorTextPair(
                isset($ps['section']) && is_array($ps['section']) ? $ps['section'] : array(),
                array('bg' => '#d0e4ff', 'textColor' => '#1e293b', 'borderColor' => '#b8d4f8', 'borderWidth' => 1, 'borderRadius' => 0)
            ),
            'blocTexte'  => $this->cleanColorTextPair(
                isset($ps['blocTexte']) && is_array($ps['blocTexte']) ? $ps['blocTexte'] : array(),
                array('bg' => '#e3f8ff', 'textColor' => '#1e293b', 'borderColor' => '#b8e6f5', 'borderWidth' => 1, 'borderRadius' => 6)
            ),
            'pageTitle'  => $this->cleanColorTextPair(
                isset($ps['pageTitle']) && is_array($ps['pageTitle']) ? $ps['pageTitle'] : array(),
                array('bg' => '#ffffff00', 'textColor' => '#1e293b', 'borderColor' => '#e2e8f0', 'borderWidth' => 0, 'borderRadius' => 0)
            ),
            'image'      => $this->cleanImageStyle(isset($ps['image']) && is_array($ps['image']) ? $ps['image'] : array()),
            'footerIcon' => array(
                'image' => $this->cleanRelPath(isset($fi['image']) ? $fi['image'] : null),
                'width' => isset($fi['width']) ? max(12, min(300, (int) $fi['width'])) : 40,
            ),
            'breadcrumb' => array(
                'bg'        => $this->cleanColor(isset($bc['bg']) ? $bc['bg'] : null, '#f1f5f9'),
                'textColor' => $this->cleanColor(isset($bc['textColor']) ? $bc['textColor'] : null, '#1e293b'),
            ),
        );
    }

    /**
     * Fond + texte + bordure (couleur/épaisseur/arrondi) : titres de page, de
     * section et blocs TEXTE, plus leurs réglages de police/marges facultatifs.
     */
    private function cleanColorTextPair($v, $defaults)
    {
        return array_merge(
            array(
                'bg'        => $this->cleanColor(isset($v['bg']) ? $v['bg'] : null, $defaults['bg']),
                'textColor' => $this->cleanColor(isset($v['textColor']) ? $v['textColor'] : null, $defaults['textColor']),
            ),
            $this->cleanBorder($v, $defaults['borderColor'], $defaults['borderWidth'], $defaults['borderRadius']),
            $this->cleanTextExtras($v)
        );
    }

    /**
     * Police, taille, couleur, alignement et marges d'un texte. Toutes ces clés
     * sont facultatives et ne sont écrites que si elles sont présentes : un
     * site enregistré avant leur ajout garde un JSON identique, et son rendu
     * retombe sur les valeurs d'app.css.
     */
    private function cleanTextExtras($v)
    {
        $out = array();
        if (!is_array($v)) {
            return $out;
        }
        $font = (isset($v['font']) && is_string($v['font'])) ? $v['font'] : '';
        $fontFile = $this->cleanRelPath(isset($v['fontFile']) ? $v['fontFile'] : null);
        $this->localizeGoogleFont($font, $fontFile);
        if ($font !== '') {
            $out['font'] = $font;
        }
        if ($fontFile !== null) {
            $out['fontFile'] = $fontFile;
        }
        if (isset($v['size']) && is_numeric($v['size'])) {
            $out['size'] = max(8, min(150, (int) $v['size']));
        }
        if (isset($v['color'])) {
            $color = $this->cleanColor($v['color'], '');
            if ($color !== '') {
                $out['color'] = $color;
            }
        }
        if (isset($v['align']) && in_array($v['align'], array('left', 'center', 'right'), true)) {
            $out['align'] = $v['align'];
        }
        foreach (array('padY', 'padX', 'mTop', 'mBottom') as $k) {
            if (isset($v[$k]) && is_numeric($v[$k])) {
                $out[$k] = max(0, min(300, (int) $v[$k]));
            }
        }
        return $out;
    }

    private function cleanImageStyle($v)
    {
        return $this->cleanBorder($v, '#333333', 1, 0);
    }

    private function cleanBorder($v, $defaultColor, $defaultWidth, $defaultRadius)
    {
        return array(
            'borderColor'  => $this->cleanColor(isset($v['borderColor']) ? $v['borderColor'] : null, $defaultColor),
            'borderWidth'  => isset($v['borderWidth']) ? max(0, min(20, (int) $v['borderWidth'])) : $defaultWidth,
            'borderRadius' => isset($v['borderRadius']) ? max(0, min(200, (int) $v['borderRadius'])) : $defaultRadius,
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
                'style'    => $this->cleanSectionBox(isset($section['style']) ? $section['style'] : null),
                'colonnes' => $colonnes,
            );
        }
        return $out;
    }

    /**
     * Fond + bordure propres à une section (l'ensemble titre/colonnes), à ne
     * pas confondre avec pagesStyle.section qui ne stylise que le bandeau du
     * titre. Une largeur de bordure à 0 signifie « pas de bordure ». null si
     * ni fond ni bordure : la section s'affiche alors comme avant.
     */
    private function cleanSectionBox($v)
    {
        if (!is_array($v)) {
            return null;
        }
        $bg = $this->cleanColor(isset($v['bg']) ? $v['bg'] : null, '');
        $border = $this->cleanBorder($v, '#94a3b8ff', 0, 0);
        if ($bg === '' && $border['borderWidth'] === 0) {
            return null;
        }
        return array_merge(array('bg' => $bg !== '' ? $bg : null), $border);
    }

    private function cleanBlocs($blocs)
    {
        $out = array();
        foreach ($blocs as $bloc) {
            if (!is_array($bloc) || !isset($bloc['type'])) {
                continue;
            }
            if ($bloc['type'] === 'TEXTE') {
                $clean = array(
                    'type'  => 'TEXTE',
                    'html'  => isset($bloc['html']) ? (string) $bloc['html'] : '',
                    'align' => in_array(isset($bloc['align']) ? $bloc['align'] : '', array('left', 'center', 'right'), true) ? $bloc['align'] : 'left',
                );
                // Facultatifs : largeur (%) et police/taille/couleur propres à ce bloc.
                if (isset($bloc['width']) && is_numeric($bloc['width'])) {
                    $clean['width'] = max(10, min(100, (int) $bloc['width']));
                }
                $style = $this->cleanTextExtras(isset($bloc['style']) ? $bloc['style'] : null);
                if (!empty($style)) {
                    $clean['style'] = $style;
                }
                $out[] = $clean;
            } elseif ($bloc['type'] === 'DOCUMENTS') {
                $clean = array(
                    'type'   => 'DOCUMENTS',
                    'fichier'=> isset($bloc['fichier']) ? (string) $bloc['fichier'] : '',
                    'width'  => isset($bloc['width']) ? (int) $bloc['width'] : 100,
                );
                // Facultatif : image ajustée à la colonne (largeur en % de celle-ci).
                if (!empty($bloc['fit'])) {
                    $clean['fit'] = true;
                }
                $out[] = $clean;
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
