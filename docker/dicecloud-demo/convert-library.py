#!/usr/bin/env python3
"""Convert a resolved legacy DiceCloud library graph without publishing source data."""
import hashlib
import json
import pathlib
import re

BASE = pathlib.Path(__file__).resolve().parents[2] / 'storage/app/dicecloud-demo'
MAIN = 'hAQmc87ty6DbWwZ42'


def convert(source, owner):
    nodes = source['nodes']
    missing = [n['_id'] for n in nodes.values() if n['type'] == 'reference'
               and n.get('ref', {}).get('collection') == 'libraryNodes'
               and n['ref'].get('id') not in nodes]
    if missing:
        raise ValueError(f'{len(missing)} unresolved references; refusing import')
    roots = {n.get('root', {}).get('id') or n['ancestors'][0]['id'] for n in nodes.values()}
    ids = {k: 'srd' + hashlib.sha256(('dicecloud-srd-v1:' + k).encode()).hexdigest()[:20]
           for k in set(nodes) | roots}
    if len(set(ids.values())) != len(ids):
        raise ValueError('ID collision')

    def remap(value):
        if isinstance(value, dict):
            return {k: remap(v) for k, v in value.items()}
        if isinstance(value, list):
            return [remap(v) for v in value]
        if isinstance(value, str):
            if value in ids:
                return ids[value]
            return re.sub(r'#([A-Za-z0-9_]+)', lambda m: '#' + ids.get(m[1], m[1]), value)
        return value

    converted = []
    children = {}
    for old_id, original in nodes.items():
        n = remap(original)
        root = original.get('root', {}).get('id') or original['ancestors'][0]['id']
        parent = original.get('parentId') or original.get('parent', {}).get('id')
        n['root'] = {'collection': 'libraries', 'id': ids[root]}
        # This wrapper is a single-source SRD selection. Remove only redundant sourcebook gates.
        if root == MAIN and n.get('slotFillerCondition') in ['showSRD', '!showPHB']:
            n.pop('slotFillerCondition', None)
            n.pop('slotFillerConditionNote', None)
        if parent in nodes:
            if (nodes[parent].get('root', {}).get('id') or nodes[parent]['ancestors'][0]['id']) != root:
                raise ValueError('Parent crosses libraries')
            n['parentId'] = ids[parent]
        else:
            n.pop('parentId', None)
        for key in ['ancestors', 'parent', 'order', 'left', 'right', 'deactivatedByAncestor', 'inactive']:
            n.pop(key, None)
        # These snapshots already use v2 computed values; applying dbv1 again corrupts them.
        for key in ['baseValue', 'amount', 'quantityExpected', 'condition', 'attackRoll', 'dc']:
            if key in n and not isinstance(n[key], dict):
                raise ValueError(f'Unexpected pre-v2 {key} on {old_id}')
        converted.append(n)
        children.setdefault((ids[root], n.get('parentId')), []).append((original.get('order', original.get('left', 0)), n))
    visited = set()
    for root in roots:
        count = 0
        active = set()

        def walk(parent):
            nonlocal count
            for _, node in sorted(children.get((ids[root], parent), []), key=lambda x: (x[0], x[1]['_id'])):
                if node['_id'] in active or node['_id'] in visited:
                    raise ValueError('Cycle or repeated child')
                active.add(node['_id'])
                node['left'] = count
                count += 1
                walk(node['_id'])
                node['right'] = count
                count += 1
                active.remove(node['_id'])
                visited.add(node['_id'])
        walk(None)
    if len(visited) != len(converted):
        raise ValueError('Unreachable nodes / parenting cycle')
    libraries = []
    for root in sorted(roots):
        original = source['libraries'][root]
        libraries.append({'_id': ids[root], 'name': '2014 SRD — resolved test library' if root == MAIN else 'SRD dependency — ' + original['name'],
                          'description': 'Private local test conversion from public DiceCloud library ' + root + '. Built and maintained by the Libraries of Vexus community. Underlying SRD 5.1 by Wizards of the Coast LLC: https://creativecommons.org/licenses/by/4.0/ . Source: https://dicecloud.com/library/' + root,
                          'owner': owner, 'public': False, 'readers': [], 'writers': []})
    return {'mainLibraryId': ids[MAIN], 'libraries': libraries, 'nodes': converted, 'idMap': ids}


if __name__ == '__main__':
    source = json.loads((BASE / 'resolved-srd-library.json').read_text())
    # Owner is supplied from the authenticated local account, never copied from hosted data.
    owner = json.loads((BASE / 'local-owner.json').read_text())['id']
    result = convert(source, owner)
    path = BASE / 'converted-srd-library.json'
    path.write_text(json.dumps(result))
    path.chmod(0o600)
    print(json.dumps({'libraries': len(result['libraries']), 'nodes': len(result['nodes']), 'mainLibraryId': result['mainLibraryId']}))
