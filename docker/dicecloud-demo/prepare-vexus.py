#!/usr/bin/env python3
"""Prepare an isolated private Vexus 2014 import; refuse unreviewed references."""
import argparse
import copy
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'storage/app/dicecloud-vexus'
spec = importlib.util.spec_from_file_location('converter', Path(__file__).with_name('convert-library.py'))
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)

ALL_BOOKS_NAME = '# Bundle: All installed 2014 books'
ALL_BOOKS_DESCRIPTION = ('Enables the installed 2014 core books, core supplements, setting supplements, '
                         'adventures, additional character options, Adventurer\'s League sources and '
                         'Acquisitions Incorporated. The retired Planeshift Anthology bundle is unavailable '
                         'and is omitted. Homebrew remains a separate source choice. Individual incomplete '
                         'character options remain unavailable until repaired.')


def repair_all_books(nodes):
    """Replace the retired catch-all with the reviewed installed-book selection."""
    bundle = nodes['cAZhwQLtavsPARHxF']
    if bundle.get('name') not in ['# Bundle: All', ALL_BOOKS_NAME]:
        raise ValueError('Upstream All bundle changed; review before patching')
    removed = []
    for ident, target in [('PMmKr92HaBnQ8rpNt', 'DG9B9j8iduKpo7Lws'),
                          ('ttrHQhYYMNh8k9Kvo', 'DKHKJS5mnyny8xkQC')]:
        node = nodes.get(ident)
        if not node:
            continue
        if node.get('ref', {}).get('id') != target or node.get('parent', {}).get('id') != bundle['_id']:
            raise ValueError('Upstream All member changed; review before patching')
        del nodes[ident]
        removed.append(ident)
    bundle['name'] = ALL_BOOKS_NAME
    bundle['description'] = {'text': ALL_BOOKS_DESCRIPTION}
    return {'bundle': bundle['_id'], 'name': ALL_BOOKS_NAME, 'omittedReferences': removed}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--quarantine-unavailable', action='store_true')
    args = parser.parse_args()
    source = json.loads((DATA / 'collection-staging.json').read_text())
    source = copy.deepcopy(source)
    nodes = source['nodes']
    book_bundle_repair = repair_all_books(nodes)
    root_of = lambda n: n.get('root', {}).get('id') or n['ancestors'][0]['id']
    main_root = 'hYPp44b6DvkgZkL2o'
    repairs = json.loads((DATA / 'reviewed-repairs.json').read_text())
    repaired, unavailable, blocked = [], [], set()
    for node in list(nodes.values()):
        if node['type'] != 'reference' or node.get('ref', {}).get('collection') != 'libraryNodes' or node['ref']['id'] in nodes:
            continue
        old = node['ref']['id']
        target = repairs.get(old)
        if target:
            if target not in nodes:
                raise ValueError('Reviewed replacement unavailable: ' + target)
            node['ref']['id'] = target
            repaired.append({'node': node['_id'], 'old': old, 'new': target})
            continue
        if not args.quarantine_unavailable:
            raise ValueError('Unreviewed dependency: ' + old)
        cached = node.get('cache', {}).get('node', {})
        name = cached.get('name') or 'retired dependency'
        ancestors = [nodes[a['id']] for a in node.get('ancestors', [])[1:] if a['id'] in nodes]
        choice = next((a for a in reversed(ancestors) if a.get('libraryTags') and 'base' not in a['libraryTags']), None)
        tutorial = any(a.get('name') == 'Tutorial' for a in ancestors)
        informational = cached.get('type') == 'note' and name.lower() == 'race info'
        if choice and not informational:
            blocked.add(choice['_id'])
        elif not (tutorial or informational):
            raise ValueError('Unavailable core dependency cannot be quarantined: ' + old)
        unavailable.append({'node': node['_id'], 'target': old, 'name': name,
                            'choice': choice and choice.get('name'), 'informational': informational or tutorial})
        # A visible note replaces a missing reference, never invented mechanics.
        note = {k: copy.deepcopy(node[k]) for k in ['_id', 'ancestors', 'parent', 'parentId', 'root', 'order', 'left', 'right'] if k in node}
        note.update(type='note', name='Library review — ' + name,
                    description={'text': 'The upstream public library references a retired or unavailable dependency (' + old + '). This component needs review; no replacement mechanics have been inferred.'})
        nodes[node['_id']] = note
    # Background equipment is part of the background, not a separate optional
    # choice. Propagate an incomplete equipment subtree to that background.
    for ident in list(blocked):
        for ancestor in nodes[ident].get('ancestors', [])[1:]:
            candidate = nodes.get(ancestor['id'], {})
            if 'background' in candidate.get('libraryTags', []):
                blocked.add(candidate['_id'])
    # Block incomplete choices and every direct wrapper pointing at them.
    for node in nodes.values():
        if node['_id'] in blocked or node.get('ref', {}).get('id') in blocked:
            node['slotFillerCondition'] = 'false'
            node['slotFillerConditionNote'] = 'Unavailable upstream dependency; this option needs library repair.'
    owner = json.loads((ROOT / 'storage/app/dicecloud-demo/local-owner.json').read_text())['id']
    result = converter.convert(source, owner, main=main_root, namespace='vexus-2014-v1', label='Vexus 2014 — Character Creation')
    # Source libraries include a few 2024 implementations needed by shared refs;
    # only 2014 component roots are exposed as selectable content packs.
    selected = [result['idMap'][i] for i in source['collection']['libraries']]
    result['collection'] = {'_id': 'vexus2014LocalCore', 'name': 'Libraries of Vexus — 2014 (local core)',
                            'description': 'Private snapshot of public 2014 Vexus core components. Hosted collection membership could not be verified without login. Includes locally reviewed repairs; incomplete choices are disabled. Do not redistribute downloaded content.',
                            'owner': owner, 'public': False, 'readers': [], 'writers': [], 'libraries': selected}
    result['selectedLibraryIds'] = selected
    path = DATA / 'converted-vexus-library.json'
    path.write_text(json.dumps(result)); path.chmod(0o600)
    report = {'libraries': len(result['libraries']), 'nodes': len(result['nodes']), 'repairedReferences': len(repaired),
              'unavailableReferences': unavailable, 'blockedChoices': [nodes[i].get('name', i) for i in sorted(blocked)],
              'mainLibraryId': result['mainLibraryId'], 'collectionId': result['collection']['_id'], 'repairs': repaired,
              'bookBundleRepair': book_bundle_repair}
    path = DATA / 'preparation-report.json'; path.write_text(json.dumps(report, indent=2)); path.chmod(0o600)
    print(json.dumps({k: v for k, v in report.items() if k not in ['repairs', 'unavailableReferences']}))


if __name__ == '__main__':
    main()
