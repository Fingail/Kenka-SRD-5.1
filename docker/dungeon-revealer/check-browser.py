#!/usr/bin/env python3
"""Run browser combat tests on disposable combatants, cleaning up afterward."""
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
compose = ['docker', 'compose', '-p', 'kenka-dungeon-revealer-demo', '-f', 'compose.dungeon-revealer-demo.yaml']
fixture = json.loads(subprocess.check_output(compose + ['exec', '-T', 'ocf-handler', 'node', 'browser-fixture.mjs', 'create'], cwd=root, text=True))
private = root / 'storage/app/dungeon-revealer-demo'
(private / 'ocf-browser-fixture.json').write_text(json.dumps(fixture, indent=2) + '\n')
artifacts = root / 'storage/app/ocf-authoring/browser'
artifacts.mkdir(exist_ok=True)
try:
    subprocess.run(['docker', 'run', '--rm', '--network', 'host', '--ipc', 'host',
                    '-v', str(root / 'tools/ocf-handler') + ':/work:ro',
                    '-v', str(private) + ':/test-secrets:ro',
                    '-v', str(artifacts) + ':/artifacts',
                    'mcr.microsoft.com/playwright:v1.65.0-noble', 'node', '/work/browser-check.mjs'], cwd=root, check=True)
finally:
    subprocess.run(compose + ['exec', '-T', 'ocf-handler', 'node', 'browser-fixture.mjs', 'cleanup', fixture['encounter_id']], cwd=root, check=True)
