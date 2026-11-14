#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Prepare a private scene copy and native DiceCloud integration inputs."""
import importlib.util
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'storage/app/dc-dr-demo'


def run(*args, **kwargs):
    return subprocess.run(args, cwd=ROOT, check=True, **kwargs)


def main():
    os.umask(0o077)
    DATA.mkdir(mode=0o700, exist_ok=True)
    if (DATA / 'config.json').exists():
        print('Existing private integration configuration preserved.')
        return
    dc = json.loads((ROOT / 'storage/app/dicecloud-demo/access.json').read_text())
    lux = json.loads((ROOT / 'storage/app/dicecloud-demo/lux/dicecloud-state.json').read_text())
    old_access = json.loads((ROOT / 'storage/app/dungeon-revealer-demo/access.json').read_text())
    req = urllib.request.Request('http://127.0.0.1:18083/api/active-map', headers={'Authorization': 'Bearer ' + old_access['dm_password']})
    with urllib.request.urlopen(req) as response:
        scene = json.load(response)['data']['activeMap']
    spec = importlib.util.spec_from_file_location('export', ROOT / 'tools/ocf-handler/export-kanka.py')
    export = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(export)
    settings = json.loads((ROOT / 'storage/app/ocf-authoring/handler-config.json').read_text())
    client = export.Kanka(settings)
    templates = {}
    for entity_id in [2174, 2041, 2096]:
        path = '/campaigns/2/entities/' + str(entity_id)
        source = {'entity': client.read(path), 'attributes': client.read(path + '/attributes')}
        result = run('docker', 'compose', '-p', 'kenka-dungeon-revealer-demo', '-f', 'compose.dungeon-revealer-demo.yaml', 'exec', '-T', 'ocf-handler', 'node', 'compile-export.mjs', input=json.dumps(source), text=True, capture_output=True)
        templates[entity_id] = json.loads(result.stdout)
    reference = json.loads((ROOT / 'storage/app/ocf-authoring/expanded-quest-check.json').read_text())
    profiles = []
    for item in reference['tokens']:
        token = next((t for t in scene['tokens'] if t['id'] == item['token_id']), None)
        if token is None:
            token = next((t for t in scene['tokens'] if t['label'] == item['name']), None)
        if token is None:
            raise SystemExit('Existing scene does not match prepared roster; no source is changed.')
        profiles.append({'tokenId': token['id'], 'name': item['name'], 'kind': 'pc' if item['role'] == 'pc' else 'npc', 'x': token['x'], 'y': token['y'], 'visible': token.get('isVisibleForPlayers', True), 'template': templates.get(item['entity_id'])})
    config = {'instance': 'dc-dr-demo-v1', 'gmUserId': json.loads((ROOT / 'storage/app/dicecloud-demo/local-owner.json').read_text())['id'],
              'sourceLuxId': lux['characterId'], 'player': {'username': 'dc-dr-player', 'email': 'player@dc-dr.test', 'password': secrets.token_urlsafe(24)},
              'drBase': 'http://dc-dr-map:3000', 'drPublic': 'http://127.0.0.1:18085', 'dcPublic': dc['url'],
              'drGMPassword': secrets.token_urlsafe(24), 'drPlayerPassword': secrets.token_urlsafe(24),
              'mapId': scene['id'], 'profiles': profiles}
    # Copy the scene volume once. Never mount the existing scene writable.
    inspected = json.loads(subprocess.check_output(['docker', 'inspect', 'kenka-dungeon-revealer-demo-dungeon-revealer-1']))[0]
    source_volume = next(m['Name'] for m in inspected['Mounts'] if m['Destination'] == '/usr/src/app/data')
    destination = 'kenka-dicecloud-demo_dc-dr-data'
    run('docker', 'volume', 'create', destination, stdout=subprocess.DEVNULL)
    run('docker', 'run', '--rm', '-v', source_volume + ':/source:ro', '-v', destination + ':/destination', 'node:14.21.3-bullseye', 'sh', '-c', 'test -z "$(ls -A /destination)" && cp -a /source/. /destination/')
    overlay = DATA / 'overlay'
    overlay.mkdir()
    for name in ['index.html', 'dm-area.ba8ac6e2.js', 'is-dungeon-master-context.7308d038.js', 'map-view.5707b3e0.js']:
        shutil.copyfile(ROOT / 'storage/app/dungeon-revealer-demo/overlay' / name, overlay / name)
    html = (overlay / 'index.html').read_text().replace('/ocf-bridge.js', '/dc-dr-map-bridge.js')
    (overlay / 'index.html').write_text(html)
    (DATA / 'config.json').write_text(json.dumps(config, indent=2))
    (DATA / 'dr.env').write_text('DM_PASSWORD=' + config['drGMPassword'] + '\nPC_PASSWORD=' + config['drPlayerPassword'] + '\n')
    (DATA / 'access.json').write_text(json.dumps({'url': dc['url'] + '/dc-dr/', 'map_url': config['drPublic'], 'gm_access_file': str(ROOT / 'storage/app/dicecloud-demo/access.json'), 'player': config['player']}, indent=2))
    (DATA / 'source-scene.json').write_text(json.dumps(scene))
    for name in ['config.json', 'dr.env', 'access.json', 'source-scene.json']:
        (DATA / name).chmod(0o600)
    print('Private scene copy and native DiceCloud roster prepared; existing demos unchanged.')


if __name__ == '__main__':
    main()
