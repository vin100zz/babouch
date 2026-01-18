let CANVAS_SIZE = 1000;
let MIDDLE = CANVAS_SIZE/2;

const LAYERS = 11;
let RADIUS = Math.floor(CANVAS_SIZE / (2*(LAYERS+1)));

let SIZE = LAYERS*RADIUS;

// Système de calques (layers) pour éviter de tout redessiner à chaque mousemove
const canvasNodes = document.getElementById("canvas-nodes");
const ctxNodes = canvasNodes.getContext("2d");

const canvasHighlight = document.getElementById("canvas-highlight");
const ctxHighlight = canvasHighlight.getContext("2d");

// Écouter les événements sur le canvas du dessus (highlight)
canvasHighlight.addEventListener('mousemove', onMouseMove);

function setCanvasSize(newSize) {
    CANVAS_SIZE = newSize;
    MIDDLE = CANVAS_SIZE / 2;
    RADIUS = Math.floor(CANVAS_SIZE / (2 * (LAYERS + 1)));
    SIZE = LAYERS * RADIUS;

    // Redimensionner tous les canvas
    [canvasNodes, canvasHighlight].forEach(canvas => {
        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
    });

    // Mettre à jour le conteneur
    const container = document.querySelector('.canvas-container');
    container.style.width = `${CANVAS_SIZE}px`;
    container.style.height = `${CANVAS_SIZE}px`;

    // Effacer les labels existants
    document.getElementById('labels').innerHTML = '';

    // Redessiner tout
    draw();
}

// Initialiser l'événement du slider
window.addEventListener('load', () => {
    const slider = document.getElementById('canvas-size-slider');

    if (slider) {
        slider.addEventListener('input', (e) => {
            const newSize = Number(e.target.value);
            setCanvasSize(newSize);
        });
    }

    // Initialiser le drag and drop du panneau filters
    initFiltersDrag();
});

function initFiltersDrag() {
    const filters = document.getElementById('filters');
    const header = document.getElementById('filters-header');

    if (!filters || !header) return;

    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target === header || header.contains(e.target)) {
            isDragging = true;
            header.style.cursor = 'grabbing';
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();

            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            setTranslate(currentX, currentY, filters);
        }
    }

    function dragEnd(e) {
        if (isDragging) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            header.style.cursor = 'move';
        }
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }
}

function draw() {
    drawNodes();
    drawLabels();
}

const REGION_LABELS = {
    'PACA': { label: 'Provence-Alpes-Côte d\'Azur', color: '#E63946' },
    'Bretagne': { label: 'Bretagne', color: '#FF9F1C' },
    'Pays de la Loire': { label: 'Pays de la Loire', color: '#2A9D8F' },
    'Grand Est': { label: 'Grand Est', color: 'lightblue' },
    'Auvergne-Rhône-Alpes': { label: 'Auvergne-Rhône-Alpes', color: '#9D4EDD' },
    'Île-de-France': { label: 'Île-de-France', color: '#F72585' },
    'Corse': { label: 'Corse', color: '#B5838D' },
    'Occitanie': { label: 'Occitanie', color: '#457B9D' },
    'Nouvelle-Aquitaine': { label: 'Nouvelle-Aquitaine', color: '#06A77D' },
    'Bourgogne-Franche-Comté': { label: 'Bourgogne-Franche-Comté', color: '#F4A261' },
    'Centre-Val de Loire': { label: 'Centre-Val de Loire', color: '#4CC9F0' },
    'Hauts-de-France': { label: 'Hauts-de-France', color: '#FB8500' },
    'Normandie': { label: 'Normandie', color: '#1D3557' },
    'Étranger': { label: 'Étranger', color: '#333' },
}

const DEPT_LABELS = {
    // PACA - nuances de rouge (#E63946)
    '13': { label: 'Bouches-du-Rhône', color: '#E63946' },
    '04': { label: 'Alpes-de-Haute-Provence', color: '#F15C68' },
    '83': { label: 'Var', color: '#C72E3C' },
    '84': { label: 'Vaucluse', color: '#FF6B77' },

    // Bretagne - nuances d'orange (#FF9F1C)
    '56': { label: 'Morbihan', color: '#FF9F1C' },

    // Pays de la Loire - nuances de vert (#2A9D8F)
    '49': { label: 'Maine-et-Loire', color: '#2A9D8F' },

    // Grand Est - nuances de jaune (#E9C46A)
    '68': { label: 'Haut-Rhin', color: 'lightblue' },
    '67': { label: 'Bas-Rhin', color: '#93C8D8' },

    // Auvergne-Rhône-Alpes - nuances de violet (#9D4EDD)
    '07': { label: 'Ardèche', color: '#9D4EDD' },
    '43': { label: 'Haute-Loire', color: '#B066F0' },
    '69': { label: 'Rhône', color: '#8437D1' },

    // Île-de-France - nuances de rose (#F72585)
    '75': { label: 'Paris', color: '#F72585' },

    // Corse - nuances de mauve (#B5838D)
    '20A': { label: 'Corse du Sud', color: '#B5838D' },

    // Étranger
    'Bavière': { label: 'Bavière', color: '#333' },
    'Italie': { label: 'Italie', color: '#333' }
}

function drawFilters() {
    drawRegionFilters();
    drawDeptFilters();
    drawAnneeFilters();
    initAccordion();
}

function drawRegionFilters() {
    const ul = document.getElementById('regionFilters');

    // Vider la liste existante
    ul.innerHTML = '';

    // Trier les régions par nombre d'occurrences décroissant
    const sortedRegions = Object.entries(REGIONS).sort((a, b) => b[1].length - a[1].length);

    // Créer un li pour chaque région
    sortedRegions.forEach(([region, ids]) => {
        const li = document.createElement('li');
        const regionInfo = REGION_LABELS[region];
        const label = regionInfo ? regionInfo.label : region;
        const color = regionInfo ? regionInfo.color : '#CCCCCC';

        // Créer un carré coloré
        const colorSquare = document.createElement('span');
        colorSquare.style.display = 'inline-block';
        colorSquare.style.width = '12px';
        colorSquare.style.height = '12px';
        colorSquare.style.backgroundColor = color;
        colorSquare.style.marginRight = '8px';
        colorSquare.style.verticalAlign = 'middle';
        colorSquare.style.border = '1px solid #888';

        // Créer le texte
        const text = document.createTextNode(`${label} (${ids.length})`);

        li.appendChild(colorSquare);
        li.appendChild(text);
        li.style.cursor = 'pointer';
        li.style.padding = '5px';

        // Hover effect
        li.addEventListener('mouseenter', () => {
            li.style.backgroundColor = 'lightblue';

            // Redessiner tous les noeuds
            ctxNodes.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            for (let layer=1; layer<=LAYERS; ++layer) {
                const nbIndexesInLayer = Math.pow(2, layer);
                for (let indexInLayer=0; indexInLayer<nbIndexesInLayer; ++indexInLayer) {
                    const nodeId = nbIndexesInLayer + indexInLayer;
                    if (MAP[nodeId]) {
                        // Vérifier si ce noeud appartient à la région survolée
                        const isInHoveredRegion = ids.includes(Number(nodeId));
                        const nodeColor = isInHoveredRegion ? color : 'lightgray';
                        drawNode(ctxNodes, layer, indexInLayer, nodeColor);
                    }
                }
            }

            // Highlight sur le canvas highlight
            ids.forEach(id => {
              drawNodeById(id, color);
            });
        });
        li.addEventListener('mouseleave', () => {
            li.style.backgroundColor = '';
            ctxHighlight.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

            // Restaurer l'affichage normal des noeuds
            drawNodes();
        });

        ul.appendChild(li);
    });
}

function drawDeptFilters() {
    const ul = document.getElementById('deptFilters');

    // Vider la liste existante
    ul.innerHTML = '';

    // sorter les lieux par nombre d'occurrences décroissant
    const sortedLieux = Object.entries(DEPTS).sort((a, b) => b[1].length - a[1].length);

    // Créer un li pour chaque lieu
    sortedLieux.forEach(([lieu, ids]) => {
        const li = document.createElement('li');
        const deptInfo = DEPT_LABELS[lieu];
        const label = deptInfo ? deptInfo.label : lieu;
        const color = deptInfo ? deptInfo.color : '#CCCCCC';

        // Créer un carré coloré
        const colorSquare = document.createElement('span');
        colorSquare.style.display = 'inline-block';
        colorSquare.style.width = '12px';
        colorSquare.style.height = '12px';
        colorSquare.style.backgroundColor = color;
        colorSquare.style.marginRight = '8px';
        colorSquare.style.verticalAlign = 'middle';
        colorSquare.style.border = '1px solid #888';

        // Créer le texte
        const text = document.createTextNode(`${label} (${ids.length})`);

        li.appendChild(colorSquare);
        li.appendChild(text);
        li.style.cursor = 'pointer';
        li.style.padding = '5px';

        // Hover effect
        li.addEventListener('mouseenter', () => {
            li.style.backgroundColor = 'lightblue';

            // Redessiner tous les noeuds
            ctxNodes.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            for (let layer=1; layer<=LAYERS; ++layer) {
                const nbIndexesInLayer = Math.pow(2, layer);
                for (let indexInLayer=0; indexInLayer<nbIndexesInLayer; ++indexInLayer) {
                    const nodeId = nbIndexesInLayer + indexInLayer;
                    if (MAP[nodeId]) {
                        // Vérifier si ce noeud appartient à la région survolée
                        const isInHoveredRegion = ids.includes(Number(nodeId));
                        const nodeColor = isInHoveredRegion ? color : 'lightgray';
                        drawNode(ctxNodes, layer, indexInLayer, nodeColor);
                    }
                }
            }

            ids.forEach(id => {
              drawNodeById(id, color);
            });
        });
        li.addEventListener('mouseleave', () => {
            li.style.backgroundColor = '';

            ctxHighlight.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

            // Restaurer l'affichage normal des noeuds
            drawNodes();
        });

        ul.appendChild(li);
    });
}

function drawAnneeFilters() {
    const ul = document.getElementById('anneeFilters');

    // Vider la liste existante
    ul.innerHTML = '';

    // Créer un li pour chaque région
    Object.entries(ANNEES).forEach(([annee, ids]) => {
        const li = document.createElement('li');
        const label = `${annee} - ${Number(annee) + ANNEE_FILTER_RANGE - 1}`;
        const color = ANNEES_COLORS[annee];

        // Créer un carré coloré
        const colorSquare = document.createElement('span');
        colorSquare.style.display = 'inline-block';
        colorSquare.style.width = '12px';
        colorSquare.style.height = '12px';
        colorSquare.style.backgroundColor = color;
        colorSquare.style.marginRight = '8px';
        colorSquare.style.verticalAlign = 'middle';
        colorSquare.style.border = '1px solid #888';

        // Créer le texte
        const text = document.createTextNode(`${label} (${ids.length})`);

        li.appendChild(colorSquare);
        li.appendChild(text);
        li.style.cursor = 'pointer';
        li.style.padding = '5px';

        // Hover effect
        li.addEventListener('mouseenter', () => {
            li.style.backgroundColor = 'lightblue';

            // Redessiner tous les noeuds
            ctxNodes.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            for (let layer=1; layer<=LAYERS; ++layer) {
                const nbIndexesInLayer = Math.pow(2, layer);
                for (let indexInLayer=0; indexInLayer<nbIndexesInLayer; ++indexInLayer) {
                    const nodeId = nbIndexesInLayer + indexInLayer;
                    if (MAP[nodeId]) {
                        // Vérifier si ce noeud appartient à la région survolée
                        const isInHoveredRegion = ids.includes(Number(nodeId));
                        const nodeColor = isInHoveredRegion ? color : 'lightgray';
                        drawNode(ctxNodes, layer, indexInLayer, nodeColor);
                    }
                }
            }

            // Highlight sur le canvas highlight
            ids.forEach(id => {
              drawNodeById(id, color);
            });
        });
        li.addEventListener('mouseleave', () => {
            li.style.backgroundColor = '';
            ctxHighlight.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

            // Restaurer l'affichage normal des noeuds
            drawNodes();
        });

        ul.appendChild(li);
    });
}

function drawNodes() {
    ctxNodes.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    for (let layer=1; layer<=LAYERS; ++layer) {
        const nbIndexesInLayer = Math.pow(2, layer);
        for (let indexInLayer=0; indexInLayer<nbIndexesInLayer; ++indexInLayer) {
            const id = nbIndexesInLayer + indexInLayer;
            if (MAP[id]) {
                let color = 'lightgray';
                let darken = false;
                if (FILTER_MODE === 0) {
                    color = 'lightgray';
                    darken = id%2 === 1;
                } else if (FILTER_MODE === 1) {
                    color = REGION_LABELS[MAP[id]['Naissance_Region']] ? REGION_LABELS[MAP[id]['Naissance_Region']].color : 'lightgray';
                } else if (FILTER_MODE === 2) {
                    color = DEPT_LABELS[MAP[id]['Naissance_Dept']] ? DEPT_LABELS[MAP[id]['Naissance_Dept']].color : 'lightgray';
                }
                else if (FILTER_MODE === 3) {
                    const year = MAP[id]['Naissance_Year'];
                    if (year) {
                        const rangeStart = Math.floor((year - 1550) / ANNEE_FILTER_RANGE) * ANNEE_FILTER_RANGE + 1550;
                        color = ANNEES_COLORS[rangeStart] || 'lightgray';
                    }
                }
                drawNode(ctxNodes, layer, indexInLayer, color, darken);
            }
        }
    }
}

function drawLabels() {
    drawLabel("René CARLÉ", MIDDLE, MIDDLE, 10);

    drawLabel("Henri CARLÉ", MIDDLE, MIDDLE-RADIUS*3/2 + 7, 10);
    drawLabel("Marie PAYAN", MIDDLE, MIDDLE+RADIUS*3/2 - 5, 10);

    const chouiaX = 1/3*RADIUS;
    const chouiaY = RADIUS;
    drawLabel("Nicolas CARLÉ", MIDDLE+RADIUS*3/2 + chouiaX, MIDDLE-RADIUS*5/2 + chouiaY, 10, '45deg');
    drawLabel("Marie LEMESLE", MIDDLE-RADIUS*3/2 - chouiaX, MIDDLE-RADIUS*5/2 + chouiaY, 10, '-45deg');
    drawLabel("Louise CASTELIN", MIDDLE+RADIUS*3/2 + chouiaX, MIDDLE+RADIUS*5/2 - chouiaY, 10, '-45deg');
    drawLabel("Vincent PAYAN", MIDDLE-RADIUS*3/2 - chouiaX, MIDDLE+RADIUS*5/2 - chouiaY, 10, '45deg');

    for (let layer=3; layer<LAYERS; ++layer) {
        const nbIndexesInLayer = Math.pow(2, layer);
        for (let indexInLayer=0; indexInLayer<nbIndexesInLayer; ++indexInLayer) {
            const id = nbIndexesInLayer + indexInLayer;
            if (MAP[id]) {
                const angle = (2*indexInLayer + 1) * Math.PI / nbIndexesInLayer;
                const r = (layer + 0.5) * RADIUS;
                const x = MIDDLE + r * Math.cos(angle);
                const y = MIDDLE - r * Math.sin(angle);
                drawLabel(id, x, y);
            }
        }
    }
}

function drawLabel(label, x, y, fontSize=8, rotate) {
    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.left = `${x-50}px`;
    div.style.width = `100px`;
    div.style.top = `${y-10}px`;
    div.style.height = `20px`;
    div.style.textAlign = "center";
    div.style.color = "#333";
    div.style.font = `${fontSize}px Arial`;
    div.style.lineHeight = `20px`;  // Mettre lineHeight APRÈS font pour éviter qu'elle soit écrasée
    if (rotate) {
        div.style.transform = `rotate(${rotate})`;
    }
    div.innerHTML = label;
    document.getElementById("labels").appendChild(div);
}

function drawTooltip() {
    const div = document.createElement("div");
    div.id = "tooltip";
    div.style.position = "absolute";
    div.style.textAlign = "center";
    div.style.backgroundColor = "white";
    div.style.padding = "10px";
    div.style.color = "black";
    div.style.font = "12px Arial";
    div.style.border = "1px solid black";
    div.style.display = "none";
    div.style.lineHeight = "20px";
    document.body.appendChild(div);
}

function showTooltip(text, x, y) {
    const div = document.getElementById("tooltip");
    div.style.left = `${x + 15}px`;
    div.style.top = `${y + 15}px`;
    div.innerHTML = text;
    div.style.display = "block";
}

function hideTooltip() {
    const div = document.getElementById("tooltip");
    div.style.display = "none";
}

function onMouseMove(evt) {
  // Effacer uniquement le canvas des highlights
  ctxHighlight.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const rect = canvasHighlight.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;

  const r = Math.sqrt(Math.pow(x - MIDDLE, 2) + Math.pow(y - MIDDLE, 2));

  // between [0, 2*PI]
  const angle = (y - MIDDLE < 0) ? (-Math.atan2(y - MIDDLE, x - MIDDLE)) : (2*Math.PI - Math.atan2(y - MIDDLE, x - MIDDLE));

  if (r > SIZE) {
    hideTooltip();
    return;
  }
  const layer = Math.floor(r / RADIUS);

  if (layer === 0) {
    hideTooltip();
    return;
  }

  let nbIndexesInLayer = 1;
  let indexInLayer = 0;
  if (layer === 1) {
    indexInLayer = y - MIDDLE < 0 ? 0 : 1;
  } else {
    const nbIndexesInLayer = Math.pow(2, layer);
    indexInLayer = Math.floor(angle * nbIndexesInLayer / 2 / Math.PI);
  }

  const id = (layer === 0) ? 1 : (Math.pow(2, layer) + indexInLayer);

  if (!MAP[id]) {
    hideTooltip();
    return;
  }

  if (FILTER_MODE === 0) {
    const ancestors = getAncestors(id);
    ancestors.forEach(ancestorId => {
        drawNodeById(ancestorId, 'lightgreen');
    });

    const descendants = getDescendants(id);
    descendants.forEach(descendantId => {
        drawNodeById(descendantId, 'lightblue');
    });

    drawNode(ctxHighlight, layer, indexInLayer, 'orange');
  }

  const label = MAP[id] ? generateTooltipLabel(id) : '-';
  // utiliser pageX/pageY (coordonnées document) pour que le tooltip reste collé
  // à la souris même quand la page est scrollée
  showTooltip(label, evt.pageX, evt.pageY);
}

function drawNodeById(id, color) {
    const layer = Math.floor(Math.log2(id));
    const indexInLayer = id - Math.pow(2, layer);
    drawNode(ctxHighlight, layer, indexInLayer, color);
}

function drawNode(ctx, layer, indexInLayer, color, darken=false) {
    const nbIndexesInLayer = Math.pow(2, layer);

    ctx.globalAlpha = darken ? 0.5 : 1.0;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(MIDDLE, MIDDLE, layer*RADIUS, -2*Math.PI * (indexInLayer+1)/nbIndexesInLayer, -2*Math.PI * indexInLayer/nbIndexesInLayer);
    ctx.lineTo(MIDDLE + (layer+1)*RADIUS * Math.cos(2*Math.PI * indexInLayer/nbIndexesInLayer), MIDDLE - (layer+1)*RADIUS * Math.sin(2*Math.PI * indexInLayer/nbIndexesInLayer));
    ctx.arc(MIDDLE, MIDDLE, (layer+1)*RADIUS, -2*Math.PI * indexInLayer/nbIndexesInLayer, -2*Math.PI * (indexInLayer+1)/nbIndexesInLayer, true);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();
}

function getDescendants(id) {
    const descendants = [];
    while (true) {
        id = Math.floor(id/2);
        if (id > 1) {
            descendants.push(id);
        } else {
            break;
        }
    }
    return descendants;
}

function getAncestors(id) {
    const MAX_ID = Math.pow(2, LAYERS+1) - 1;
    const ancestors = [];
    const queue = [id];
    const visited = new Set();

    while (queue.length > 0) {
        const current = queue.shift();

        if (visited.has(current) || current > MAX_ID) {
            continue;
        }

        visited.add(current);

        const parents = getParents(current);
        for (const parent of parents) {
            if (parent <= MAX_ID && !visited.has(parent)) {
                ancestors.push(parent);
                queue.push(parent);
            }
        }
    }

    return ancestors;
}

function getParents(id) {
    const parents = [];
    if (MAP[2*id]) {
        parents.push(2*id);
    }
    if (MAP[2*id + 1]) {
        parents.push(2*id + 1);
    }
    return parents;
}

function generateTooltipLabel(id) {
    const prenom = MAP[id]['Prénom'];
    const nom = MAP[id]['Nom'];
    const birthDate = MAP[id]['Naissance_Date'];
    const deathDate = MAP[id]['Décès_Date'];
    const lieuNaissance = MAP[id]['Naissance_Ville'];
    const lieuDeces = MAP[id]['Décès_Ville'];
    const profession = MAP[id]['Profession'];

    let naissance = '';
    if (birthDate) {
        naissance += birthDate;
    }
    if (lieuNaissance) {
        naissance += (naissance ? ' - ' : '') + lieuNaissance;
    }

    let death = '';
    if (deathDate) {
        death += deathDate;
    }
    if (lieuDeces) {
        death += (death ? ' - ' : '') + lieuDeces;
    }

    return `
        <span style='display: block; font-size: 110%; font-weight: bold; margin-bottom: 2px'>${prenom} ${nom}</span>
        ${naissance ? ('Naissance : ' + naissance + '<br/>') : ''}
        ${death ? ('Décès : ' + death + '<br/>') : ''}
        ${profession ? (profession.charAt(0).toUpperCase() + profession.slice(1)) : ''}`;
}

// Charge le CSV renuméroté et renvoie une Map<number, {id, father, mother, raw}>
// (implémentation déplacée dans renumeroteLoader.js; la fonction est exposée
// sur window.loadRenumeroteCsv)

let MAP = {};

if (typeof window.loadRenumeroteCsv === 'function') {
  window.loadRenumeroteCsv().then(map => init(map)).catch(console.error);
} else {
  // Chargement asynchrone si renumeroteLoader.js est inclus après tree.js
  window.addEventListener('load', () => {
    if (typeof window.loadRenumeroteCsv === 'function') {
      window.loadRenumeroteCsv().then(map => init(map)).catch(console.error);
    } else {
      console.warn('loadRenumeroteCsv() non disponible — assurez-vous d\'inclure renumeroteLoader.js');
    }
  });
}

const DEPTS = {};
const REGIONS = {};

const ANNEE_FILTER_RANGE = 30;
const ANNEES = {};
const ANNEES_COLORS = {};

let MIN_ANNEE = null;
const MAX_ANNEE = 2026;

function init(map) {
    MAP = map;
    console.log('MAP', MAP);
    //console.log('Lieu naissance', Object.keys(MAP).map(id => `${MAP[id]['Naissance_Dept']}  --- ${id} | ${MAP[id]['Naissance_Lieu']}`));
    //console.log('Année naissance', Object.keys(MAP).map(id => `${id}: ${MAP[id]['Naissance_Date']} -> ${MAP[id]['Naissance_Year']}`));
    //console.log('Année décès', Object.keys(MAP).map(id => `${id}: ${MAP[id]['Décès_Date']} -> ${MAP[id]['Décès_Year']}`));

    Object.keys(MAP).forEach(id => {
        if (id <= 1) return;

        const dept = MAP[id]['Naissance_Dept'];
        if (dept) {
            if (!DEPTS[dept]) {
                DEPTS[dept] = [];
            }
            DEPTS[dept].push(id);
        }

        const region = MAP[id]['Naissance_Region'];
        if (region) {
            if (!REGIONS[region]) {
                REGIONS[region] = [];
            }
            REGIONS[region].push(id);
        }

        if (!MIN_ANNEE) {
            MIN_ANNEE = MAP[id]['Naissance_Year'];
        } else if (MAP[id]['Naissance_Year'] && MAP[id]['Naissance_Year'] < MIN_ANNEE) {
            MIN_ANNEE = MAP[id]['Naissance_Year'];
        }
    });

    // Remplir la map ANNEES avec les IDs des personnes par plages d'années
    const startYear = 1550;

    Object.keys(MAP).forEach(id => {
        if (id <= 1) return;

        const birthYear = MAP[id]['Naissance_Year'];
        if (birthYear) {
            // Calculer la clé de la plage (arrondi vers le bas au multiple de ANNEE_FILTER_RANGE)
            const rangeStart = Math.floor((birthYear - startYear) / ANNEE_FILTER_RANGE) * ANNEE_FILTER_RANGE + startYear;

            if (!ANNEES[rangeStart]) {
                ANNEES[rangeStart] = [];
            }
            ANNEES[rangeStart].push(id);
        }
    });

    const nbRanges = Object.keys(ANNEES).length;
    Object.keys(ANNEES).forEach((rangeStart, index) => {
        // Générer une couleur entre le bleu et le rouge
        const ratio = index / (nbRanges - 1);
        const red = Math.floor(255 * ratio);
        const blue = Math.floor(255 * (1 - ratio));
        const color = `rgb(${red}, 0, ${blue}, 0.7)`;
        ANNEES_COLORS[rangeStart] = color;
    });

    document.getElementById('ancestors-count').innerHTML = `
        ${Object.keys(MAP).length-1} ancêtres
        <br/>
        ${LAYERS+1} générations
        <br/>
        depuis ${MIN_ANNEE} jusqu'à aujourd'hui`;

    draw();
    drawTooltip();
    drawFilters();
}

let FILTER_MODE = 0;

function initAccordion() {
    const headers = document.querySelectorAll('.accordion-header');

    // Ouvrir le premier élément par défaut
    if (headers.length > 0) {
        headers[0].classList.add('active');
        headers[0].nextElementSibling.classList.add('active');
        FILTER_MODE = 0; // Premier élément
    }

    headers.forEach((header, index) => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const isActive = header.classList.contains('active');

            // Si la section cliquée est déjà active, ne rien faire
            // (toujours garder exactement un élément ouvert)
            if (isActive) {
                return;
            }

            // Fermer toutes les sections
            headers.forEach(h => {
                h.classList.remove('active');
                h.nextElementSibling.classList.remove('active');
            });

            // Ouvrir la section cliquée
            header.classList.add('active');
            content.classList.add('active');

            // Mettre à jour FILTER_MODE avec l'index (0-based)
            FILTER_MODE = index;
            drawNodes();
        });
    });
}
