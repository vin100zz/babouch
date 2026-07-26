// map.js - Gestion de la visualisation par carte de France

function switchVisualizationMode(mode) {
    VISUALIZATION_MODE = mode;

    const canvasContainer = document.querySelector('.canvas-container');
    const mapContainer = document.getElementById('map-container');
    const sizeControl = document.getElementById('size-control');
    const accordion = document.querySelector('.accordion');

    if (mode === 'carte') {
        // Masquer les canvas de l'arbre
        canvasContainer.style.display = 'none';

        // Masquer les contrôles spécifiques à l'arbre
        if (sizeControl) sizeControl.style.display = 'none';
        if (accordion) accordion.style.display = 'none';

        // Afficher ou créer le conteneur de la carte
        if (!mapContainer) {
            createMapContainer();
        } else {
            mapContainer.style.display = 'block';
        }

        // Dessiner la carte
        drawMap();
    } else {
        // Mode arbre
        canvasContainer.style.display = 'block';

        // Afficher les contrôles spécifiques à l'arbre
        if (sizeControl) sizeControl.style.display = 'block';
        if (accordion) accordion.style.display = 'block';

        if (mapContainer) {
            mapContainer.style.display = 'none';
        }
    }
}

function createMapContainer() {
    const container = document.createElement('div');
    container.id = 'map-container';
    container.className = 'map-container';

    document.body.appendChild(container);
}

function drawMap() {
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) return;

    // Calculer le nombre d'ancêtres par département
    const deptCounts = {};
    let maxCount = 0;

    Object.keys(MAP).forEach(id => {
        const dept = MAP[id]['Naissance_Dept'];
        if (dept && dept !== '' && id > 1) { // Exclure la personne racine
            deptCounts[dept] = (deptCounts[dept] || 0) + 1;
            maxCount = Math.max(maxCount, deptCounts[dept]);
        }
    });

    console.log('Départements:', deptCounts);
    console.log('Max count:', maxCount);

    // Fonction pour calculer la couleur en fonction du nombre d'ancêtres
    function getColor(count) {
        if (count === 0) return '#f5f5f5';

        const intensity = Math.min(count / maxCount, 1);

        // Dégradé de bleu clair à bleu foncé
        if (intensity > 0.8) return '#0d47a1';
        if (intensity > 0.6) return '#1976d2';
        if (intensity > 0.4) return '#42a5f5';
        if (intensity > 0.2) return '#90caf9';
        return '#bbdefb';
    }

    // Créer le HTML du conteneur
    let html = `
        <div class="map-wrapper">
            <div id="leaflet-map" style="height: calc(100vh - 20px); width: 100%; border-radius: 8px; overflow: hidden; background: #ffffff;"></div>
        </div>
    `;

    mapContainer.innerHTML = html;

    // Initialiser la carte Leaflet après un court délai pour s'assurer que le DOM est prêt
    setTimeout(() => {
        initLeafletMap(deptCounts, maxCount, getColor);
    }, 100);
}

function initLeafletMap(deptCounts, maxCount, getColor) {
    // Vérifier si Leaflet est chargé
    if (typeof L === 'undefined') {
        console.error('Leaflet n\'est pas chargé. Chargement en cours...');
        loadLeafletLibrary(() => {
            initLeafletMap(deptCounts, maxCount, getColor);
        });
        return;
    }

    // Créer la carte centrée sur la France
    const map = L.map('leaflet-map', {
        zoomControl: false,
        scrollWheelZoom: false,
        zoomSnap: 0.1,  // Permet des valeurs de zoom décimales (0.1 = pas de 0.1)
        zoomDelta: 0.1
    });

    // Définir les limites de la France métropolitaine pour un meilleur cadrage
    const franceBounds = [
        [41.0, -5.5],  // Sud-Ouest (coin inférieur gauche)
        [51.5, 10.0]   // Nord-Est (coin supérieur droit)
    ];

    // Ajuster la vue sur la France avec un padding pour ne pas être trop collé
    map.fitBounds(franceBounds, {
        padding: [20, 20]
    });

    // Ne pas ajouter de couche de fond de carte (fond blanc par défaut)
    // Les départements seront dessinés directement sur le fond blanc

    // Charger les données GeoJSON des départements français
    loadDepartmentsGeoJSON(map, deptCounts, getColor);
}

function loadLeafletLibrary(callback) {
    // Charger Leaflet CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    cssLink.crossOrigin = '';
    document.head.appendChild(cssLink);

    // Charger Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = callback;
    document.head.appendChild(script);
}

function loadDepartmentsGeoJSON(map, deptCounts, getColor) {
    // URL du GeoJSON des départements français (fichier local)
    const geojsonUrl = 'departements.geojson';

    fetch(geojsonUrl)
        .then(response => response.json())
        .then(data => {
            // Ajouter les départements à la carte
            L.geoJSON(data, {
                style: function(feature) {
                    const deptCode = feature.properties.code;
                    const count = deptCounts[deptCode] || 0;

                    return {
                        fillColor: getColor(count),
                        weight: 1,
                        opacity: 1,
                        color: '#666',
                        fillOpacity: 0.7
                    };
                },
                onEachFeature: function(feature, layer) {
                    const deptCode = feature.properties.code;
                    const deptName = feature.properties.nom;
                    const count = deptCounts[deptCode] || 0;

                    // Tooltip qui s'affiche au survol
                    layer.bindTooltip(`
                        <div style="font-family: Arial, sans-serif;">
                            <strong style="font-size: 16px;">${deptName} (${deptCode})</strong><br>
                            <span style="font-size: 14px; color: #2c5aa0;">
                                <strong>${count}</strong> ancêtre${count > 1 ? 's' : ''}
                            </span>
                        </div>
                    `, {
                        permanent: false,
                        sticky: true,
                        direction: 'top',
                        opacity: 0.9
                    });

                    // Effet de survol
                    layer.on('mouseover', function(e) {
                        this.setStyle({
                            weight: 2,
                            color: '#000',
                            fillOpacity: 0.9
                        });
                    });

                    layer.on('mouseout', function(e) {
                        this.setStyle({
                            weight: 1,
                            color: '#666',
                            fillOpacity: 0.7
                        });
                    });
                }
            }).addTo(map);
        })
        .catch(error => {
            console.error('Erreur lors du chargement des données GeoJSON:', error);
            // Fallback: afficher un message d'erreur
            document.getElementById('leaflet-map').innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f5f5f5; color: #666;">
                    <div style="text-align: center;">
                        <p style="font-size: 18px; margin-bottom: 10px;">⚠️ Erreur de chargement de la carte</p>
                        <p style="font-size: 14px;">Impossible de charger les données géographiques.</p>
                        <p style="font-size: 12px; margin-top: 10px;">Vérifiez votre connexion internet.</p>
                    </div>
                </div>
            `;
        });
}

// Exposer les fonctions globalement
window.switchVisualizationMode = switchVisualizationMode;
window.drawMap = drawMap;

