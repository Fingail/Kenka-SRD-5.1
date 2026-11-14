#!/usr/bin/env python3
"""Exercise the running private demo without displaying credentials."""
import hashlib
import json
from pathlib import Path
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]
ACCESS = json.loads((ROOT / 'storage/app/dungeon-revealer-demo/access.json').read_text())
KANKA = json.loads((ROOT / 'storage/app/local-access.json').read_text())


def request(path, password=None, data=None, base='http://127.0.0.1:18083'):
    headers = {'Accept': 'application/json'}
    if password:
        headers['Authorization'] = 'Bearer ' + password
    if data is not None:
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(base + path, headers=headers, data=None if data is None else json.dumps(data).encode())
    with urllib.request.urlopen(req, timeout=120) as response:
        return json.load(response)


def denied(status, *args, **kwargs):
    try:
        request(*args, **kwargs)
    except urllib.error.HTTPError as error:
        assert error.code == status, (status, error.code, error.read().decode())
    else:
        raise AssertionError('Unauthorized request unexpectedly succeeded')


def source_hash():
    # Kanka adds a per-response `sync` timestamp; it is not source content.
    data = [request(f'/api/1.0/campaigns/2/entities/{entity}/attributes', KANKA['api_token'], base='http://127.0.0.1:18081')['data'] for entity in [3536, 3463, 2174, 3431, 2096, 2041]]
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def main():
    before = source_hash()
    gm, pc = ACCESS['dm_password'], ACCESS['player_password']
    payload = {'quest_url': 'http://127.0.0.1:18081/w/2/entities/3536', 'map_entity_id': 3431}
    first = request('/ocf-api/prepare', gm, payload)
    second = request('/ocf-api/prepare', gm, payload)
    assert first['status'] == 'ready'
    assert first['map']['id'] == second['map']['id']
    assert [x['token_id'] for x in first['tokens']] == [x['token_id'] for x in second['tokens']]
    lux = next(t for t in first['tokens'] if t['entity_id'] == 3463)
    bear = next(t for t in first['tokens'] if t['entity_id'] == 2174)
    assert lux['stats']['ac'] == 17 and lux['stats']['hp_max'] == 36
    assert bear['stats']['ac'] == 11 and bear['stats']['hp_max'] == 19
    assert [x['hp_current'] for x in first['tokens']] == [x['hp_current'] for x in second['tokens']]
    assert lux['attacks'][0]['attack_bonus'] == 8
    assert [x['attack_bonus'] for x in bear['attacks']] == [3, 3]
    assert len(request('/ocf-api/tokens/' + lux['token_id'], pc)['attacks']) >= 1
    secret = request('/ocf-api/tokens/' + bear['token_id'], pc)
    assert secret['restricted'] and 'stats' not in secret and 'attacks' not in secret
    denied(401, '/ocf-api/encounters')
    denied(403, '/ocf-api/prepare', pc, payload)
    denied(400, '/ocf-api/prepare', gm, {**payload, 'quest_url': 'http://example.com/w/2/entities/3536'})
    denied(403, '/ocf-api/tokens/' + bear['token_id'] + '/rolls', pc, {'kind': 'attack', 'action_id': 'bite', 'request_id': str(uuid.uuid4())})
    path = '/ocf-api/tokens/' + lux['token_id'] + '/rolls'
    roll_input = {'kind': 'attack', 'action_id': 'longbow', 'request_id': str(uuid.uuid4())}
    roll = request(path, pc, roll_input)
    assert 9 <= roll['total'] <= 28 and roll['modifier'] == 8
    assert request(path, pc, roll_input) == roll
    denied(409, path, pc, {**roll_input, 'kind': 'damage'})
    denied(400, path, pc, {**roll_input, 'request_id': str(uuid.uuid4()), 'total': 99})
    npc_roll = request('/ocf-api/tokens/' + bear['token_id'] + '/rolls', gm, {'kind': 'damage', 'action_id': 'claws', 'request_id': str(uuid.uuid4())})
    assert 4 <= npc_roll['total'] <= 10
    assert npc_roll['id'] not in [x['id'] for x in request('/ocf-api/history', pc)]
    assert npc_roll['id'] in [x['id'] for x in request('/ocf-api/history', gm)]
    launch = request('/ocf-api/launch/' + first['id'], gm, {})
    active = request('/api/active-map', pc)['data']['activeMap']
    assert launch['map_id'] == active['id'] and len(active['tokens']) == len(first['tokens'])
    assert before == source_hash(), 'Kanka source properties changed'
    output = {'encounter_id': first['id'], 'map_id': active['id'], 'token_ids': [lux['token_id'], bear['token_id']], 'replay_input': roll_input, 'replay_result': roll, 'source_hash': before, 'checks': 'prepare/retry, source integrity, role filtering, roll limits, forged result rejection, history visibility, launch'}
    (ROOT / 'storage/app/ocf-authoring/integration-check.json').write_text(json.dumps(output, indent=2) + '\n')
    print('Live integration checks passed; private report saved.')


if __name__ == '__main__':
    main()
