#!/usr/bin/env python3
import argparse
import csv
import gzip
import hashlib
import json
import math
import re
import sys
import zipfile
from array import array
from collections import Counter, defaultdict
from pathlib import Path

ATTR = 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International'
SYS = {
    'skeletal': '#d8cfb6', 'muscular': '#a85b50', 'arterial': '#b95345',
    'venous': '#527c9f', 'nervous': '#d8b565', 'respiratory': '#b98991',
    'digestive': '#b8916b', 'urinary': '#88738f', 'reproductive': '#bda098',
    'lymphatic': '#879f7c', 'endocrine': '#c5a09a', 'sensory': '#91aeb2',
    'cardiac': '#9d4f45', 'connective': '#aec3bb', 'integumentary': '#ba9b7d',
    'other': '#9da5a3'
}
KW = [
    ('cardiac', ['heart', 'ventricle', 'atrium', 'cardiac valve']),
    ('arterial', ['artery', 'aorta']),
    ('venous', ['vein', 'vena cava']),
    ('nervous', ['nerve', 'brain', 'spinal cord', 'ganglion', 'plexus', 'cerebell', 'medulla', 'pons']),
    ('skeletal', ['bone', 'vertebra', 'rib', 'femur', 'tibia', 'fibula', 'humerus', 'radius', 'ulna', 'skull', 'mandible', 'maxilla', 'sternum', 'sacrum', 'coccyx', 'patella', 'carpal', 'tarsal', 'metacarp', 'metatars', 'phalan', 'scapula', 'clavicle']),
    ('muscular', ['muscle', 'diaphragm']),
    ('respiratory', ['lung', 'bronch', 'trachea', 'larynx', 'alveol']),
    ('digestive', ['stomach', 'intestin', 'colon', 'rectum', 'esophagus', 'liver', 'gallbladder', 'pancreas', 'duodenum', 'jejun', 'ileum', 'bile duct']),
    ('urinary', ['kidney', 'ureter', 'bladder', 'urethra']),
    ('reproductive', ['testis', 'prostate', 'penis', 'seminal', 'epididym', 'spermatic']),
    ('lymphatic', ['lymph', 'spleen', 'thymus', 'tonsil']),
    ('endocrine', ['adrenal', 'pituitary', 'thyroid', 'parathyroid', 'pineal']),
    ('sensory', ['eye', 'retina', 'optic', 'ear', 'cochlea', 'vestib', 'lens', 'cornea']),
    ('integumentary', ['skin']),
    ('connective', ['cartilage', 'ligament', 'tendon', 'fascia'])
]


def rows(path):
    with open(path, encoding='utf-8-sig', errors='replace', newline='') as handle:
        return [[cell.strip() for cell in row] for row in csv.reader(handle, delimiter='\t') if row]


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def packed(values, code):
    result = array(code, values)
    if sys.byteorder != 'little':
        result.byteswap()
    return result.tobytes()


def metadata(parts_path, relations_path, elements_path):
    concepts = {}
    parent = {}
    children = defaultdict(list)
    element_to_concepts = defaultdict(list)

    for row in rows(parts_path)[1:]:
        if len(row) >= 3:
            concepts[row[0]] = {'id': row[0], 'representationId': row[1], 'name': row[2], 'elements': []}

    for row in rows(relations_path)[1:]:
        if len(row) >= 4:
            parent[row[2]] = row[0]
            children[row[0]].append(row[2])
            concepts.setdefault(row[0], {'id': row[0], 'representationId': '', 'name': row[1], 'elements': []})
            concepts.setdefault(row[2], {'id': row[2], 'representationId': '', 'name': row[3], 'elements': []})

    for row in rows(elements_path)[1:]:
        if len(row) >= 3:
            concepts.setdefault(row[0], {'id': row[0], 'representationId': '', 'name': row[1], 'elements': []})['elements'].append(row[2])
            element_to_concepts[row[2].upper()].append(row[0])

    depth_cache = {}

    def depth(concept_id, seen=None):
        if concept_id in depth_cache:
            return depth_cache[concept_id]
        seen = set() if seen is None else seen
        if concept_id in seen:
            return 0
        seen.add(concept_id)
        depth_cache[concept_id] = 0 if concept_id not in parent else depth(parent[concept_id], seen) + 1
        return depth_cache[concept_id]

    def choose(element_id):
        return max(element_to_concepts.get(element_id.upper(), []), key=depth, default=None)

    def lineage(concept_id):
        result = []
        seen = set()
        while concept_id and concept_id not in seen:
            seen.add(concept_id)
            result.append(concepts.get(concept_id, {}).get('name', ''))
            concept_id = parent.get(concept_id)
        return result

    packed_concepts = [dict(value, parentId=parent.get(key), children=children.get(key, [])) for key, value in sorted(concepts.items())]
    return packed_concepts, choose, lineage


def system_for(name, lineage):
    text = ' | '.join([name, *lineage]).lower()
    for system_id, words in KW:
        if any(word in text for word in words):
            return system_id
    return 'other'


def scan_bounds(archive, members):
    low = [1e9] * 3
    high = [-1e9] * 3
    for member in members:
        for raw_line in archive.open(member):
            if raw_line.startswith(b'v '):
                fields = raw_line.decode('ascii', 'ignore').split()
                x, y, z = map(float, fields[1:4])
                point = (x * .001, z * .001, -y * .001)
                for axis in range(3):
                    low[axis] = min(low[axis], point[axis])
                    high[axis] = max(high[axis], point[axis])
    return low, high


def parse_obj(text, raw_bounds):
    positions = []
    normals = []
    faces = []
    english_name = ''
    low, high = raw_bounds
    center_x = (low[0] + high[0]) / 2
    center_z = (low[2] + high[2]) / 2

    for line in text.splitlines():
        if line.startswith('#') and 'english name' in line.lower() and ':' in line:
            english_name = line.split(':', 1)[1].strip()
        elif line.startswith('v '):
            x, y, z = map(float, line.split()[1:4])
            positions.append((x * .001 - center_x, z * .001 - low[1], -y * .001 - center_z))
        elif line.startswith('vn '):
            x, y, z = map(float, line.split()[1:4])
            normal = (x, z, -y)
            length = math.sqrt(sum(value * value for value in normal)) or 1
            normals.append(tuple(value / length for value in normal))
        elif line.startswith('f '):
            face = []
            for token in line.split()[1:]:
                fields = token.split('/')
                vertex_index = int(fields[0])
                vertex_index = vertex_index - 1 if vertex_index > 0 else len(positions) + vertex_index
                normal_index = None
                if len(fields) > 2 and fields[2]:
                    normal_index = int(fields[2])
                    normal_index = normal_index - 1 if normal_index > 0 else len(normals) + normal_index
                face.append((vertex_index, normal_index))
            faces.append(face)

    have_normals = bool(normals) and any(normal_index is not None for face in faces for _, normal_index in face)
    vertex_map = {}
    packed_positions = []
    packed_normals = []
    indices = []

    def vertex(reference):
        key = reference if have_normals else (reference[0], None)
        if key in vertex_map:
            return vertex_map[key]
        result = len(packed_positions) // 3
        vertex_map[key] = result
        packed_positions.extend(positions[reference[0]])
        normal = normals[reference[1]] if have_normals and reference[1] is not None else (0, 0, 0)
        packed_normals.extend(normal)
        return result

    for face in faces:
        face_indices = [vertex(reference) for reference in face]
        for index in range(1, len(face_indices) - 1):
            indices.extend((face_indices[0], face_indices[index], face_indices[index + 1]))

    if not have_normals:
        accumulated = [0.0] * len(packed_positions)
        for offset in range(0, len(indices), 3):
            ia, ib, ic = indices[offset:offset + 3]
            a = packed_positions[3 * ia:3 * ia + 3]
            b = packed_positions[3 * ib:3 * ib + 3]
            c = packed_positions[3 * ic:3 * ic + 3]
            u = [b[i] - a[i] for i in range(3)]
            v = [c[i] - a[i] for i in range(3)]
            normal = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
            for vertex_index in (ia, ib, ic):
                for axis in range(3):
                    accumulated[3 * vertex_index + axis] += normal[axis]
        packed_normals = []
        for offset in range(0, len(accumulated), 3):
            normal = accumulated[offset:offset + 3]
            length = math.sqrt(sum(value * value for value in normal)) or 1
            packed_normals.extend(value / length for value in normal)

    bounds = [
        [min(packed_positions[axis::3]) for axis in range(3)],
        [max(packed_positions[axis::3]) for axis in range(3)]
    ]
    return english_name, packed_positions, packed_normals, indices, bounds


def region_for(center, body_bounds):
    low, high = body_bounds
    y = (center[1] - low[1]) / (high[1] - low[1])
    x = abs(center[0] - (low[0] + high[0]) / 2) / (high[0] - low[0])
    if y >= .79:
        return 'head & neck'
    if x > .30 and .34 <= y < .78:
        return 'upper limb'
    if y >= .56:
        return 'thorax'
    if y >= .39:
        return 'abdomen'
    if y >= .29:
        return 'pelvis'
    return 'lower limb'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', required=True)
    parser.add_argument('--isa-parts', required=True)
    parser.add_argument('--isa-relations', required=True)
    parser.add_argument('--isa-elements', required=True)
    parser.add_argument('--out', default='public/models')
    parser.add_argument('--expected-parts', type=int, default=2234)
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    concepts, choose_concept, lineage = metadata(args.isa_parts, args.isa_relations, args.isa_elements)
    concept_by_id = {concept['id']: concept for concept in concepts}

    with zipfile.ZipFile(args.archive) as archive:
        members = sorted(member for member in archive.namelist() if member.lower().endswith('.obj'))
        assert len(members) == args.expected_parts, (len(members), args.expected_parts)

        raw_bounds = scan_bounds(archive, members)
        low, high = raw_bounds
        body_bounds = [
            [-(high[0] - low[0]) / 2, 0, -(high[2] - low[2]) / 2],
            [(high[0] - low[0]) / 2, high[1] - low[1], (high[2] - low[2]) / 2]
        ]

        parts = []
        chunks = []
        stats = defaultdict(lambda: {'parts': 0, 'vertices': 0, 'indices': 0})
        blob = bytearray()
        chunk_index = 0
        triangle_count = 0
        used_mesh_ids = set()
        element_counts = Counter()

        def flush():
            nonlocal blob, chunk_index
            if not blob:
                return
            filename = out / f'body-{chunk_index}.bin.gz'
            filename.write_bytes(gzip.compress(bytes(blob), compresslevel=9, mtime=0))
            chunks.append({
                'url': f'/models/{filename.name}',
                'bytes': len(blob),
                'gzipBytes': filename.stat().st_size,
                'sha256': sha256(filename)
            })
            chunk_index += 1
            blob = bytearray()

        for ordinal, member in enumerate(members, 1):
            source_stem = Path(member).stem.upper()
            match = re.search(r'FJ\d+', source_stem, re.I)
            element_id = (match.group(0) if match else source_stem).upper()
            element_counts[element_id] += 1

            # An FJ element can legitimately be represented by more than one OBJ entry.
            # Keep the ontology lookup key in elementId and give every archive mesh its own stable id.
            mesh_id = source_stem
            if mesh_id in used_mesh_ids:
                suffix = hashlib.sha1(member.encode('utf-8')).hexdigest()[:10].upper()
                mesh_id = f'{source_stem}__{suffix}'
            if mesh_id in used_mesh_ids:
                raise AssertionError(f'Unable to make a unique mesh id for {member}')
            used_mesh_ids.add(mesh_id)

            english_name, positions, normals, indices, bounds = parse_obj(
                archive.read(member).decode('utf-8', 'replace'), raw_bounds
            )
            concept_id = choose_concept(element_id)
            name = english_name or concept_by_id.get(concept_id, {}).get('name') or element_id
            system_id = system_for(name, lineage(concept_id))
            center = [(bounds[0][axis] + bounds[1][axis]) / 2 for axis in range(3)]

            position_bytes = packed(positions, 'f')
            normal_bytes = packed([max(-32767, min(32767, round(value * 32767))) for value in normals], 'h')
            index_bytes = packed(indices, 'I')

            if blob and len(blob) + len(position_bytes) + len(normal_bytes) + len(index_bytes) > 6_000_000:
                flush()

            def append(data):
                while len(blob) % 4:
                    blob.append(0)
                offset = len(blob)
                blob.extend(data)
                return offset

            position_offset = append(position_bytes)
            normal_offset = append(normal_bytes)
            index_offset = append(index_bytes)
            part = {
                'id': mesh_id,
                'elementId': element_id,
                'sourceFile': member,
                'name': name,
                'conceptId': concept_id,
                'system': system_id,
                'region': region_for(center, body_bounds),
                'chunk': chunk_index,
                'positions': position_offset,
                'normals': normal_offset,
                'indices': index_offset,
                'vertexCount': len(positions) // 3,
                'indexCount': len(indices),
                'bounds': bounds
            }
            parts.append(part)
            triangle_count += len(indices) // 3
            system_stats = stats[system_id]
            system_stats['parts'] += 1
            system_stats['vertices'] += part['vertexCount']
            system_stats['indices'] += part['indexCount']

            if ordinal % 100 == 0:
                print(f'{ordinal}/{len(members)}')

        flush()

    duplicate_elements = {key: value for key, value in sorted(element_counts.items()) if value > 1}
    atlas = {
        'version': 'BodyParts3D 4.0',
        'sex': 'male',
        'scope': 'adult human male reference anatomy',
        'source': 'BodyParts3D',
        'license': 'CC BY 4.0',
        'attribution': ATTR,
        'parts': parts,
        'concepts': concepts,
        'chunks': chunks,
        'triangles': triangle_count,
        'bounds': body_bounds,
        'systemColors': SYS,
        'systemStats': dict(stats),
        'classification': {
            'system': 'Human Atlas heuristic v1; not an official BodyParts3D field',
            'region': 'Human Atlas geometric heuristic v1; not an official BodyParts3D field'
        }
    }
    (out / 'atlas.json').write_text(json.dumps(atlas, separators=(',', ':')), encoding='utf-8')
    (out / 'source.json').write_text(json.dumps({
        'dataset': 'BodyParts3D',
        'release': '4.0',
        'modelCount': len(parts),
        'archiveSha256': sha256(args.archive),
        'license': 'Creative Commons Attribution 4.0 International',
        'attribution': ATTR,
        'licensePage': 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',
        'downloadPage': 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html',
        'transform': 'millimetres/Z-up -> metres/Y-up; centered X/Z; grounded Y=0',
        'meshIdentityPolicy': 'id identifies an individual source OBJ; elementId preserves the BodyParts3D/FJ ontology lookup key',
        'duplicateElementIdCount': len(duplicate_elements),
        'duplicateElementIds': duplicate_elements
    }, indent=2), encoding='utf-8')

    print(json.dumps({
        'parts': len(parts),
        'uniqueMeshIds': len(used_mesh_ids),
        'duplicateElementIds': len(duplicate_elements),
        'triangles': triangle_count,
        'chunks': len(chunks),
        'bytes': sum(chunk['gzipBytes'] for chunk in chunks)
    }, indent=2))


if __name__ == '__main__':
    main()
