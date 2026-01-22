// Utilitaires pour charger le CSV renuméroté
// Ce fichier expose `loadRenumeroteCsv(url)` sur `window` pour compatibilité avec un chargement via <script>.

// Fonction utilitaire pour parser un CSV en tableau d'objets (gère les champs entre guillemets)
function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  // lire une ligne en tenant compte des guillemets
  function readRow() {
    const fields = [];
    let field = '';
    let inQuotes = false;
    while (i < len) {
      const ch = text[i++];
      if (inQuotes) {
        if (ch === '"') {
          // peek next
          if (i < len && text[i] === '"') {
            // double quote -> literal "
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ';') {
          fields.push(field);
          field = '';
        } else if (ch === '\r') {
          // ignore CR
        } else if (ch === '\n') {
          fields.push(field);
          return fields;
        } else {
          field += ch;
        }
      }
    }
    // EOF
    if (field !== '' || i >= len) {
      fields.push(field);
      return fields;
    }
    return null;
  }

  // lire header
  i = 0;
  const headerFields = readRow();
  if (!headerFields) return [];
  // trim BOM if present on first header
  if (headerFields.length > 0 && headerFields[0].startsWith('\uFEFF')) {
    headerFields[0] = headerFields[0].replace(/^\uFEFF/, '');
  }

  // read following rows
  while (i < len) {
    const f = readRow();
    if (!f) break;
    // if row is entirely empty, skip
    if (f.length === 1 && f[0] === '') continue;
    const obj = {};
    for (let k = 0; k < headerFields.length; ++k) {
      const key = headerFields[k] || `__COL_${k}`;
      obj[key] = (k < f.length) ? f[k] : '';
    }
    rows.push(obj);
  }
  return rows;
}

// Charge le CSV renuméroté et renvoie une Map<number, {id, father, mother, raw}>
async function loadRenumeroteCsv(url = 'gotrand.csv') {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Erreur de lecture du CSV (${res.status} ${res.statusText})`);
  }
  const txt = await res.text();
  const rows = parseCsv(txt);

  const map = {};
  for (const row of rows) {
    const rawId = (row['Id'] || '').trim();
    if (!rawId) continue; // ignorer les lignes sans id
    const id = Number(rawId);
    if (Number.isNaN(id)) continue; // ignorer si non numérique

    const fatherRaw = (row['ID_PERE'] || '').trim();
    const motherRaw = (row['ID_MERE'] || '').trim();
    const father = fatherRaw ? (Number(fatherRaw) || null) : null;
    const mother = motherRaw ? (Number(motherRaw) || null) : null;

    row['Naissance_Ville'] = (row['Naissance_Ville'] || '').trim();
    row['Naissance_Dept'] = extractDpt(row['Naissance_Dept']);

    // log warning if Naissance_Dept is empty and Naissance_Ville is not empty
    if (!row['Naissance_Dept'] && row['Naissance_Ville']) {
        console.warn('Département de naissance manquant pour une ville non vide:', row['Naissance_Ville'], ' (ID:', id, ')');
    }

    row['Naissance_Region'] = getRegionFromDpt(row['Naissance_Dept']);

    row['Décès_Ville'] = (row['Décès_Ville'] || '').trim();

    row['Naissance_Year'] = extractYear(row['Naissance_Date']);
    row['Décès_Year'] = extractYear(row['Décès_Date']);

    map[id] = row;
  }

  return map;
}

function extractDpt(str) {
    let dept = (str || '').trim().replaceAll(/\?/g, '').trim();

    // if dept is a number with one digit, pad with leading zero
    if (dept && /^\d$/.test(dept)) {
        dept = '0' + dept;
    }

    // if dept is not a number, log a warning
    if (dept && isNaN(Number(dept))) {
        console.warn('Département non numérique détecté', dept, ' | ',str);
    }
    return dept;
}

const REGIONS_LABELS = {
    'PACA': ['04', '05', '06', '13', '83', '84'],
    'Occitanie': ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
    'Auvergne-Rhône-Alpes': ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
    'Bretagne': ['22', '29', '35', '56'],
    'Centre-Val de Loire': ['18', '28', '36', '37', '41', '45'],
    'Corse': ['20A', '20B'],
    'Grand Est': ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
    'Hauts-de-France': ['02', '59', '60', '62', '80'],
    'Île-de-France': ['75', '77', '78', '91', '92', '93', '94', '95'],
    'Normandie': ['14', '27', '50', '61', '76'],
    'Nouvelle-Aquitaine': ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
    'Pays de la Loire': ['41', '44', '49', '53', '72', '85'],
    'Bourgogne-Franche-Comté': ['21', '25', '39', '58', '70', '71', '89', '90']
}

function getRegionFromDpt(dpt) {
    if (!dpt) {
        return null;
    }
    for (const [region, dpts] of Object.entries(REGIONS_LABELS)) {
        if (dpts.includes(dpt)) {
            return region;
        }
    }
    return 'Étranger';
}

function extractYear(str) {
    const date = (str || '').trim();
    let year = date.slice(-4);
    if (year === '?') {
        year = null;
    }
    return year ? Number(year) : null;
}

// Fonction pour créer l'arbre de Vincent en fusionnant René et Évelyne
async function loadVincentCsv() {
  // Charger les deux arbres
  const carleMap = await loadRenumeroteCsv('carle.csv');
  const gotrandMap = await loadRenumeroteCsv('gotrand.csv');

  const vincentMap = {};

  // Table de correspondance: carle.csv Id -> vincent.csv Id
  const carleIdMapping = {};
  // Table de correspondance: gotrand.csv Id -> vincent.csv Id
  const gotrandIdMapping = {};

  // 1. Créer Vincent (Id=1)
  vincentMap[1] = {
    'Id': '1',
    'Nom': 'CARLÉ',
    'Prénom': 'Vincent',
    'Naissance_Date': '15/03/1975',
    'Naissance_Ville': 'Bordeaux',
    'Naissance_Dept': '33',
    'Naissance_Region': 'Nouvelle-Aquitaine',
    'Naissance_Year': 1975,
    'Profession': 'Ingénieur',
    'Mariage_Date': '',
    'Mariage_Ville': '',
    'Mariage_Dept': '',
    'Décès_Date': '',
    'Décès_Ville': '',
    'Décès_Dept': '',
    'Décès_Year': null
  };

  // 2. Créer le mapping pour l'arbre de René
  // René (carle Id=1) devient Vincent Id=2
  // Dans l'arbre binaire: le père de Id=N est à Id=2*N, la mère à Id=2*N+1

  function mapCarleTree(carleId, vincentId) {
    carleIdMapping[carleId] = vincentId;

    // Dans carle.csv, si la personne existe, ses parents sont à 2*carleId et 2*carleId+1
    const pereCarleId = carleId * 2;
    const mereCarleId = carleId * 2 + 1;

    if (carleMap[pereCarleId]) {
      mapCarleTree(pereCarleId, vincentId * 2);
    }
    if (carleMap[mereCarleId]) {
      mapCarleTree(mereCarleId, vincentId * 2 + 1);
    }
  }

  // 3. Créer le mapping pour l'arbre d'Évelyne
  // Évelyne (gotrand Id=1) devient Vincent Id=3

  function mapGotrandTree(gotrandId, vincentId) {
    gotrandIdMapping[gotrandId] = vincentId;

    // Dans gotrand.csv, si la personne existe, ses parents sont à 2*gotrandId et 2*gotrandId+1
    const pereGotrandId = gotrandId * 2;
    const mereGotrandId = gotrandId * 2 + 1;

    if (gotrandMap[pereGotrandId]) {
      mapGotrandTree(pereGotrandId, vincentId * 2);
    }
    if (gotrandMap[mereGotrandId]) {
      mapGotrandTree(mereGotrandId, vincentId * 2 + 1);
    }
  }

  // Générer les mappings récursivement
  mapCarleTree(1, 2);
  mapGotrandTree(1, 3);

  console.log('Mapping Carle:', carleIdMapping);
  console.log('Mapping Gotrand:', gotrandIdMapping);

  // 4. Ajouter René avec ses ancêtres
  vincentMap[2] = { ...carleMap[1], 'Id': '2' };

  Object.keys(carleMap).forEach(carleId => {
    const numId = Number(carleId);
    if (numId > 1) { // Skip René lui-même
      const vincentId = carleIdMapping[numId];
      if (vincentId) {
        const newData = { ...carleMap[numId] };
        newData['Id'] = String(vincentId);
        vincentMap[vincentId] = newData;
      }
    }
  });

  // 5. Ajouter Évelyne avec ses ancêtres
  vincentMap[3] = { ...gotrandMap[1], 'Id': '3' };

  Object.keys(gotrandMap).forEach(gotrandId => {
    const numId = Number(gotrandId);
    if (numId > 1) { // Skip Évelyne elle-même
      const vincentId = gotrandIdMapping[numId];
      if (vincentId) {
        const newData = { ...gotrandMap[numId] };
        newData['Id'] = String(vincentId);

        vincentMap[vincentId] = newData;
      }
    }
  });

  console.log('Arbre de Vincent créé:', Object.keys(vincentMap).length, 'personnes');
  console.log('- René (Id=2) et ses', Object.keys(carleIdMapping).length - 1, 'ancêtres');
  console.log('- Évelyne (Id=3) et ses', Object.keys(gotrandIdMapping).length - 1, 'ancêtres');

  return vincentMap;
}

// Exposer globalement pour compatibilité avec scripts non-modulaires
window.loadRenumeroteCsv = loadRenumeroteCsv;
window.loadVincentCsv = loadVincentCsv;
