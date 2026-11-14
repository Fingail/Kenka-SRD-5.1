#!/usr/bin/env python3
"""Activate the evaluated private Vexus pack and test native Workshop creation."""
import json
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'storage/app/dicecloud-vexus'
BASE = 'http://127.0.0.1:18084'


def main():
    access = json.loads((ROOT / 'storage/app/dicecloud-demo/access.json').read_text())
    payload = json.loads((DATA / 'converted-vexus-library.json').read_text())
    request = urllib.request.Request(BASE + '/api/login', data=json.dumps({k: access[k] for k in ['username', 'password']}).encode(), headers={'Content-Type': 'application/json'})
    token = json.load(urllib.request.urlopen(request))['token']

    def api(op, body=None):
        request = urllib.request.Request(BASE + '/kanka-tabletop/api/workshop/' + op, data=json.dumps(body or {}).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token})
        return json.load(urllib.request.urlopen(request, timeout=180))

    home = api('home')
    original = {c['id']: c['summary'] for c in home['characters'] if c['inTabletop'] or c['id'] == home['sourceLuxId']}
    if set(home['policy']['packs']) != set(payload['selectedLibraryIds']):
        backup = DATA / 'previous-workshop-policy.json'
        if not backup.exists():
            backup.write_text(json.dumps(home['policy'])); backup.chmod(0o600)
        api('policy', {**home['policy'], 'packs': payload['selectedLibraryIds']})
    draft = api('start', {'name': 'Vexus 2014 — Human Fighter test ' + str(int(time.time()))})
    assert draft['summary']['stats'], '2014 base inserted automatically'
    selected = []

    def choose(slot_name, name):
        nonlocal draft
        slot = next(s for s in draft['slots'] if s['name'] == slot_name and s['remaining'] != 0)
        options = api('options', {'draftId': draft['id'], 'slotId': slot['id'], 'search': name, 'limit': 100})
        option = next((c for c in options['choices'] if c['name'].casefold() == name.casefold() and c['eligible']), None)
        assert option, (slot_name, name, options)
        draft = api('choose', {'draftId': draft['id'], 'revision': draft['revision'], 'slotId': slot['id'], 'nodeId': option['id']})
        selected.append(name)
        print('Selected:', slot_name, name, flush=True)

    background_slot = next(s for s in draft['slots'] if s['name'] == 'Background')
    backgrounds = []
    for name in ['Acolyte', 'Criminal', 'Folk Hero', 'Noble', 'Sage', 'Soldier', 'Entertainer', 'Custom Background']:
        options = api('options', {'draftId': draft['id'], 'slotId': background_slot['id'], 'search': name, 'limit': 100})
        assert any(c['name'] == name and c['eligible'] for c in options['choices']), (name, options)
        backgrounds.append(name)
    print('Background availability verified:', ', '.join(backgrounds), flush=True)
    blocked = api('options', {'draftId': draft['id'], 'slotId': background_slot['id'], 'search': 'Sailor', 'limit': 100})
    assert any(c['name'] == 'Sailor' and not c['eligible'] and 'dependency' in c.get('reason', '') for c in blocked['choices'])
    source_slot = next(s for s in draft['slots'] if s['name'] == 'Sources')
    assert any('Core Sourcebooks' in c['name'] for c in source_slot['selected'])
    choose('Race', 'Human')
    if any(s['name'] == 'Human Type' for s in draft['slots']):
        choose('Human Type', 'Human (Default)')
    choose('Background', 'Criminal')
    choose('Starting Class', 'Fighter')
    draft = api('scores', {'draftId': draft['id'], 'revision': draft['revision'], 'method': 'array', 'scores': dict(strength=15, dexterity=14, constitution=13, intelligence=12, wisdom=10, charisma=8)})
    choose('Fighting Style', 'Archery')
    for _ in range(45):
        pending = next((s for s in draft['slots'] if s['required'] and s['remaining'] > 0), None)
        if not pending:
            break
        options = api('options', {'draftId': draft['id'], 'slotId': pending['id'], 'limit': 100})
        eligible = [c for c in options['choices'] if c['eligible']]
        assert eligible, (pending['name'], options)
        picked = next((c for c in eligible if 'Starting Equipment' in c['name']), eligible[0])
        draft = api('choose', {'draftId': draft['id'], 'revision': draft['revision'], 'slotId': pending['id'], 'nodeId': picked['id']})
        print('Completed:', pending['name'], picked['name'], flush=True)
    assert not [s for s in draft['slots'] if s['required'] and s['remaining'] > 0]
    assert draft['summary']['classes'][0]['level'] == 1
    assert draft['summary']['stats']['strength']['value'] == 16
    assert draft['summary']['stats']['hitPoints']['total'] == 12
    draft = api('commit', {'draftId': draft['id'], 'revision': draft['revision'], 'acknowledgeReviews': True})
    current = {c['id']: c['summary'] for c in api('home')['characters'] if c['id'] in original}
    assert current == original, 'Original and encounter characters unchanged'
    result = {'passed': True, 'backgrounds_verified': backgrounds, 'required_choices_complete': True, 'skill_prerequisites_verified': True,
              'characterId': draft['publishedId'], 'draftId': draft['id'], 'character_url': BASE + '/character/' + draft['publishedId'],
              'original_and_live_characters_unchanged': True, 'classes': draft['summary']['classes'], 'stats': draft['summary']['stats']}
    path = DATA / 'workshop-test-result.json'; path.write_text(json.dumps(result, indent=2)); path.chmod(0o600)
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
