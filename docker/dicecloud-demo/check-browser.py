#!/usr/bin/env python3
"""Create/reuse a private DiceCloud demo account and verify the starter workflow."""
import json
import os
from pathlib import Path
import secrets
import subprocess

ROOT = Path(__file__).resolve().parents[2]
os.umask(0o077)
directory = ROOT / 'storage/app/dicecloud-demo'
directory.mkdir(parents=True, exist_ok=True)
access = directory / 'access.json'
if not access.exists():
    access.write_text(json.dumps({'url': 'http://127.0.0.1:18084', 'username': 'demo-gm',
                                 'email': 'gm@dicecloud.test', 'password': secrets.token_urlsafe(24),
                                 'account_created': False}, indent=2) + '\n')
access.chmod(0o600)
subprocess.run(['docker', 'run', '--rm', '--user', f'{os.getuid()}:{os.getgid()}', '--network', 'host', '--ipc', 'host',
                '-v', str(ROOT / 'tools/ocf-handler') + ':/work:ro',
                '-v', str(ROOT / 'docker/dicecloud-demo') + ':/demo-tools:ro',
                '-v', str(directory) + ':/demo-data',
                'mcr.microsoft.com/playwright:v1.65.0-noble', 'node', '/demo-tools/check-browser.mjs'], cwd=ROOT, check=True)
print('Private demo login:', access)
