#!/usr/bin/env python3
"""Start the private basic OCF/DR integration against an already running Kanka."""
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
os.chdir(ROOT)
os.umask(0o077)


def run(*command):
    subprocess.run(command, check=True)


run(sys.executable, 'docker/dungeon-revealer/prepare-demo.py')
if not (ROOT / 'tools/ocf-handler/node_modules/@opencharacter/engine').is_dir():
    run('vendor/bin/sail', 'npm', '--prefix', 'tools/ocf-handler', 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund')
access = json.loads((ROOT / 'storage/app/local-access.json').read_text())
directory = ROOT / 'storage/app/ocf-authoring'
directory.mkdir(exist_ok=True, mode=0o700)
configuration = directory / 'handler-config.json'
if not configuration.exists():
    token=os.environ.get('OCF_KANKA_TOKEN') or access.get('api_token')
    if not token:
        raise SystemExit('Create a view-only local Kanka API token and pass it in OCF_KANKA_TOKEN, then rerun. Never commit the token.')
    configuration.write_text(json.dumps({
        'kanka_public': 'http://127.0.0.1:18081',
        'kanka_internal': 'http://kanka-source:8080',
        'kanka_token': token,
        'dr_public': 'http://127.0.0.1:18083',
        'asset_origins': {
            'http://127.0.0.1:18081': 'http://kanka-source:8080',
            'http://127.0.0.1:19000': 'http://kanka-media:9000',
        },
    }, indent=2) + '\n')
configuration.chmod(0o600)
run(sys.executable, 'docker/dungeon-revealer/prepare-overlay.py')
run('docker', 'compose', '-p', 'kenka-dungeon-revealer-demo', '-f', 'compose.dungeon-revealer-demo.yaml', 'up', '-d', '--wait', '--wait-timeout', '60')
for container, alias in [('kenka-local-laravel.test-1', 'kanka-source'), ('kenka-local-minio-1', 'kanka-media')]:
    networks = json.loads(subprocess.check_output(['docker', 'inspect', '--format', '{{json .NetworkSettings.Networks}}', container], text=True))
    if 'kenka-ocf-sources' not in networks:
        run('docker', 'network', 'connect', '--alias', alias, 'kenka-ocf-sources', container)
print('Dungeon Revealer: http://127.0.0.1:18083/dm')
print('Quest launcher: http://127.0.0.1:18083/ocf-api/ui')
