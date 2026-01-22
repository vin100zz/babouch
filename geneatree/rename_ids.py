#!/usr/bin/env python3
"""
Renomme les identifiants d'un fichier gen_individus.csv selon la numérotation binaire
(proband/root -> 1, père -> 2*i, mère -> 2*i+1).

Usage (depuis le répertoire contenant gen_individus.csv):
    python rename_ids.py [input_csv] [output_csv] [mapping_csv] [root_id]

Exemples:
    python rename_ids.py
    python rename_ids.py gen_individus.csv gen_individus_renumerote.csv mapping.csv I1086

Comportement en cas d'ancêtre répété (inbreeding):
- Si la même personne originale apparaît comme parent de plusieurs noeuds, le script
  garde le premier index assigné et émet un avertissement. La numérotation binaire
  parfaite suppose qu'aucun ancêtre n'apparaisse deux fois dans l'arbre ascendant.

Sorties:
- output_csv: même forme que l'entrée mais avec colonnes ID_INDIVIDU, ID_PERE, ID_MERE
  remplacées par leurs nouveaux numéros (si assignés), sinon laissées vides.
- mapping_csv: deux colonnes original_id,new_id

"""
import csv
import sys
import os
from collections import deque

INPUT_DEFAULT = 'gotrand_raw.csv'
OUTPUT_DEFAULT = 'gotrand.csv'
MAPPING_DEFAULT = 'mapping.csv'
ROOT_DEFAULT = 'I1'


def load_rows(path):
    # Essayer plusieurs encodages courants (utf-8, utf-8-sig, cp1252, latin-1) car
    # le CSV peut provenir d'un système Windows et contenir des caractères étendus.
    encodings = ['utf-8', 'utf-8-sig', 'cp1252', 'latin-1']
    for enc in encodings:
        try:
            with open(path, newline='', encoding=enc) as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                fieldnames = reader.fieldnames
            # Indiquer à l'utilisateur quel encodage a fonctionné
            print(f"Lecture CSV avec encodage: {enc}")

            # Nettoyer les fieldnames: certains CSV ont une virgule finale produisant
            # un champ None ou vide; on remplace ces noms vides par des noms générés
            cleaned_fieldnames = []
            rename_map = {}
            had_empty = False
            for i, fn in enumerate(fieldnames if fieldnames else []):
                if fn is None or fn.strip() == '':
                    new_name = f'__COL_{i}'
                    cleaned_fieldnames.append(new_name)
                    rename_map[fn] = new_name
                    had_empty = True
                else:
                    cleaned_fieldnames.append(fn)
                    rename_map[fn] = fn

            if had_empty:
                print(f"En-têtes vides détectées; renommage appliqué: {rename_map}")
                # Recréer les rows avec les nouvelles clés
                new_rows = []
                for r in rows:
                    newr = {}
                    for old_key, new_key in rename_map.items():
                        # csv.DictReader uses None for missing header names, so use r.get(old_key)
                        newr[new_key] = r.get(old_key)
                    # Conserver aussi toute autre clé déjà correcte
                    for k, v in r.items():
                        if k not in rename_map:
                            newr[k] = v
                    new_rows.append(newr)
                rows = new_rows
                fieldnames = cleaned_fieldnames

            return rows, fieldnames
        except UnicodeDecodeError:
            continue
    # Si aucun encodage n'a fonctionné, échouer proprement
    raise ValueError(f"Impossible de lire le fichier {path} avec les encodages testés: {encodings}")


def build_index(rows, id_field='ID_INDIVIDU'):
    d = {}
    for r in rows:
        key = (r.get(id_field) or '').strip()
        if key:
            d[key] = r
    return d


def renumerote(rows, root_id, id_field='ID_INDIVIDU', father_field='ID_PERE', mother_field='ID_MERE'):
    rows_by_id = build_index(rows, id_field=id_field)

    mapping = {}  # original_id -> new_int
    reverse = {}  # new_int -> original_id
    warnings = []

    q = deque()
    root = root_id
    if not root:
        raise ValueError('root id vide')
    mapping[root] = 1
    reverse[1] = root
    q.append(root)

    while q:
        cur = q.popleft()
        cur_pos = mapping[cur]
        row = rows_by_id.get(cur)
        if not row:
            # pas de ligne correspondante dans le CSV
            continue
        father = (row.get(father_field) or '').strip()
        mother = (row.get(mother_field) or '').strip()

        if father:
            expected = 2 * cur_pos
            if father in mapping:
                if mapping[father] != expected:
                    warnings.append(f"Conflit: '{father}' déjà mappé à {mapping[father]} mais attendu {expected} (père de {cur})")
            else:
                mapping[father] = expected
                reverse[expected] = father
                q.append(father)

        if mother:
            expected = 2 * cur_pos + 1
            if mother in mapping:
                if mapping[mother] != expected:
                    warnings.append(f"Conflit: '{mother}' déjà mappé à {mapping[mother]} mais attendu {expected} (mère de {cur})")
            else:
                mapping[mother] = expected
                reverse[expected] = mother
                q.append(mother)

    return mapping, warnings


def write_output(rows, fieldnames, mapping, out_path, id_field='ID_INDIVIDU', father_field='ID_PERE', mother_field='ID_MERE'):
    # remplacer les valeurs par les nouveaux ids numériques si disponibles, sinon vide
    # Nettoyer les fieldnames pour s'assurer qu'ils sont tous des strings non-None
    fieldnames_out = [fn if (fn is not None) else '__COL_UNKNOWN' for fn in fieldnames]
    # Écrire en UTF-8 (avec BOM si vous voulez Excel : 'utf-8-sig')
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames_out)
        writer.writeheader()
        for r in rows:
            # Construire explicitement la ligne en respectant les en-têtes
            newr = {}
            for fn in fieldnames_out:
                # récupérer la valeur originale (ou vide)
                val = r.get(fn)
                # Si la clé originale n'existe pas mais il existe une clé vide ou None, tenter de récupérer
                if val is None:
                    # essayer quelques alternatives courantes
                    val = r.get('') or r.get(None) or ''
                newr[fn] = val

            # Remplacer les identifiants par leurs nouveaux numéros si disponibles
            orig = (r.get(id_field) or '').strip()
            newr[id_field] = str(mapping[orig]) if orig in mapping else ''
            father = (r.get(father_field) or '').strip()
            mother = (r.get(mother_field) or '').strip()
            newr[father_field] = str(mapping[father]) if father in mapping else ''
            newr[mother_field] = str(mapping[mother]) if mother in mapping else ''

            writer.writerow(newr)


def write_mapping(mapping, path):
    # sort by new id
    items = sorted(mapping.items(), key=lambda kv: kv[1])
    with open(path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['original_id', 'new_id'])
        for orig, new in items:
            writer.writerow([orig, new])


def main(argv):
    input_csv = argv[0] if len(argv) > 0 else INPUT_DEFAULT
    output_csv = argv[1] if len(argv) > 1 else OUTPUT_DEFAULT
    mapping_csv = argv[2] if len(argv) > 2 else MAPPING_DEFAULT
    root_id = argv[3] if len(argv) > 3 else ROOT_DEFAULT

    if not os.path.exists(input_csv):
        print(f"Fichier d'entrée introuvable: {input_csv}")
        sys.exit(1)

    rows, fieldnames = load_rows(input_csv)
    if not fieldnames:
        print('Aucune en-tête détectée dans le CSV')
        sys.exit(1)

    # s'assurer que les champs existent
    for f in ('ID_INDIVIDU', 'ID_PERE', 'ID_MERE'):
        if f not in fieldnames:
            print(f"Champ requis '{f}' absent du CSV. Champs trouvés: {fieldnames}")
            sys.exit(1)

    mapping, warnings = renumerote(rows, root_id)

    write_output(rows, fieldnames, mapping, output_csv)
    write_mapping(mapping, mapping_csv)

    print(f"Écriture terminée: {output_csv}")
    print(f"Mapping écrit: {mapping_csv} (total {len(mapping)} entrées)")
    if warnings:
        print('\nNB: avertissements rencontrés:')
        for w in warnings:
            print(' -', w)
    else:
        print('Pas d\'avertissements.')


if __name__ == '__main__':
    main(sys.argv[1:])
