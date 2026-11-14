#!/usr/bin/env python3
"""Read a local Kanka character and save private DiceCloud import inputs (no writes to Kanka)."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.parse

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--entity-url', required=True)
    parser.add_argument('--output', required=True, help='New private directory under storage/app/dicecloud-demo.')
    args = parser.parse_args()
    output = Path(args.output).resolve()
    private_root = (ROOT / 'storage/app/dicecloud-demo').resolve()
    if private_root not in output.parents:
        parser.error('Output must be below ignored storage/app/dicecloud-demo.')
    if output.exists():
        parser.error('Use a new output directory to preserve reviewed inputs and advancement state.')
    settings = json.loads((ROOT / 'storage/app/ocf-authoring/handler-config.json').read_text())
    url, base = urllib.parse.urlparse(args.entity_url), urllib.parse.urlparse(settings['kanka_public'])
    match = re.fullmatch(r'/w/2/entities/(\d+)/?', url.path)
    if (url.scheme, url.netloc) != (base.scheme, base.netloc) or not match or url.query or url.fragment:
        parser.error('Use the configured local campaign-2 character URL.')
    spec = importlib.util.spec_from_file_location('kanka_export', ROOT / 'tools/ocf-handler/export-kanka.py')
    export = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(export)
    client = export.Kanka(settings)
    path = '/campaigns/2/entities/' + match[1]
    source = {'entity': client.read(path), 'attributes': client.read(path + '/attributes'),
              'posts': client.read(path + '/posts'), 'inventory': client.read(path + '/inventory'), 'abilities': []}
    if source['entity']['type'] != 'character':
        parser.error('Select a player character.')
    source['posts'] = [p for p in source['posts'] if p['name'] in ('Combat, skills, and proficiencies', 'Source review and unresolved selections')]
    for row in client.read(path + '/entity_abilities'):
        source['abilities'].append({**client.read('/campaigns/2/abilities/' + str(row['ability_id'])), 'assignment_note': row.get('note', '')})
    for row in source['inventory']:
        row['item'] = client.read('/campaigns/2/items/' + str(row['item_id']))
    source['races'] = [client.read('/campaigns/2/races/' + str(r)) for r in source['entity']['child'].get('races', [])]
    result = subprocess.run(['docker', 'compose', '-p', 'kenka-dungeon-revealer-demo', '-f', 'compose.dungeon-revealer-demo.yaml',
                             'exec', '-T', 'ocf-handler', 'node', 'compile-export.mjs'], cwd=ROOT,
                            input=json.dumps(source), text=True, capture_output=True)
    if result.returncode:
        raise SystemExit('Source validation failed; no import files written.')
    sheet = json.loads(result.stdout)
    os.umask(0o077)
    output.mkdir(parents=True, mode=0o700)
    for filename, value in [('kanka-source.json', source), ('battle-ready.json', sheet)]:
        destination = output / filename
        destination.write_text(json.dumps(value, indent=2) + '\n')
        destination.chmod(0o600)
    print('Saved private read-only Kanka snapshot to', output)


if __name__ == '__main__':
    main()
