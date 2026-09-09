#!/usr/bin/env python3
import argparse
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

ATTR = 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--models', type=Path, default=Path('public/models'))
    parser.add_argument('--expected-parts', type=int, default=2234)
    args = parser.parse_args()

    atlas = json.loads((args.models / 'atlas.json').read_text())
    source = json.loads((args.models / 'source.json').read_text())

    assert atlas['version'] == 'BodyParts3D 4.0'
    assert atlas['license'] == 'CC BY 4.0'
    assert atlas['attribution'] == ATTR
    assert source['attribution'] == ATTR
    assert len(atlas['parts']) == args.expected_parts

    mesh_ids = [part['id'] for part in atlas['parts']]
    assert len(mesh_ids) == len(set(mesh_ids)), 'mesh ids must be unique even when element ids repeat'

    source_files = [part.get('sourceFile') for part in atlas['parts']]
    assert all(source_files) and len(source_files) == len(set(source_files)), 'every source OBJ must be represented exactly once'

    invalid = [
        {
            'id': part.get('id'),
            'elementId': part.get('elementId'),
            'sourceFile': part.get('sourceFile'),
            'name': part.get('name'),
            'conceptId': part.get('conceptId'),
            'vertexCount': part.get('vertexCount'),
            'indexCount': part.get('indexCount'),
            'chunk': part.get('chunk')
        }
        for part in atlas['parts']
        if not (
            part.get('name')
            and part.get('elementId')
            and part.get('vertexCount', 0) > 0
            and part.get('indexCount', 0) >= 3
            and part.get('indexCount', 0) % 3 == 0
        )
    ]
    if invalid:
        print(json.dumps({'invalidGeometryCount': len(invalid), 'invalidGeometry': invalid[:100]}, indent=2))
        raise AssertionError(f'{len(invalid)} source OBJ entries failed the renderable geometry gate')

    chunk_sizes = {}
    for index, chunk in enumerate(atlas['chunks']):
        filename = args.models / Path(chunk['url']).name
        assert filename.exists()
        assert hashlib.sha256(filename.read_bytes()).hexdigest() == chunk['sha256']
        raw = gzip.decompress(filename.read_bytes())
        assert len(raw) == chunk['bytes']
        chunk_sizes[index] = len(raw)

    for part in atlas['parts']:
        size = chunk_sizes[part['chunk']]
        assert part['positions'] + part['vertexCount'] * 12 <= size
        assert part['normals'] + part['vertexCount'] * 6 <= size
        assert part['indices'] + part['indexCount'] * 4 <= size

    concept_coverage = sum(bool(part.get('conceptId')) for part in atlas['parts']) / len(atlas['parts'])
    element_counts = Counter(part['elementId'] for part in atlas['parts'])
    duplicate_elements = {key: value for key, value in element_counts.items() if value > 1}

    assert concept_coverage >= .9, concept_coverage
    assert atlas['triangles'] > 100000
    assert source.get('meshIdentityPolicy')

    result = {
        'verified': True,
        'parts': len(atlas['parts']),
        'uniqueMeshIds': len(set(mesh_ids)),
        'uniqueSourceFiles': len(set(source_files)),
        'uniqueElementIds': len(element_counts),
        'repeatedElementIds': len(duplicate_elements),
        'conceptCoverage': round(concept_coverage, 4),
        'triangles': atlas['triangles'],
        'chunks': len(atlas['chunks'])
    }
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
