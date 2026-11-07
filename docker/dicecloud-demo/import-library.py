#!/usr/bin/env python3
"""Back up the local demo, run schema-validated import, and restore its clean bundle."""
import datetime
import json
import pathlib
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / 'storage/app/dicecloud-demo'
COMPOSE = ['docker', 'compose', '-p', 'kenka-dicecloud-demo', '-f', str(ROOT / 'compose.dicecloud-demo.yaml')]


def run(args, **kwargs):
    return subprocess.run(args, check=True, stdout=subprocess.PIPE, **kwargs).stdout


def main():
    payload = DATA / 'converted-srd-library.json'
    if not payload.exists():
        raise SystemExit('Run resolve-library.mjs and convert-library.py first.')
    container = run(COMPOSE + ['ps', '-q', 'dicecloud']).decode().strip()
    if not container:
        raise SystemExit('DiceCloud demo must be running.')
    timestamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    backup = DATA / f'before-srd-import-{timestamp}.archive.gz'
    with backup.open('wb') as output:
        backup.chmod(0o600)
        result = subprocess.run(COMPOSE + ['exec', '-T', 'mongo', 'sh', '-c',
            'mongodump --quiet --host 127.0.0.1 --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db dicecloud --archive --gzip'],
            stdout=output, stderr=subprocess.PIPE)
    if result.returncode:
        raise SystemExit('Database backup failed; import was not started.')
    print('Private backup created:', backup.name, flush=True)
    bundle = '/opt/dicecloud/programs/server/app/app.js'
    original = '/tmp/app-before-srd-import.js'
    run(['docker', 'exec', '-u', '0', container, 'cp', bundle, original])
    try:
        run(['docker', 'cp', str(payload), container + ':/tmp/converted-srd-library.json'])
        run(['docker', 'cp', str(ROOT / 'docker/dicecloud-demo/import-library-startup.cjs'), container + ':/tmp/import-library-startup.cjs'])
        run(['docker', 'exec', '-u', '0', container, 'node', '-e',
             'const fs=require("fs");const r="/tmp/srd-import-report.json";if(fs.existsSync(r))fs.unlinkSync(r);fs.appendFileSync("/opt/dicecloud/programs/server/app/app.js","\\n"+fs.readFileSync("/tmp/import-library-startup.cjs","utf8"));'])
        run(['docker', 'restart', container])
        deadline = time.monotonic() + 900
        while time.monotonic() < deadline:
            result = subprocess.run(['docker', 'exec', container, 'cat', '/tmp/srd-import-report.json'], capture_output=True)
            if not result.returncode:
                report = json.loads(result.stdout)
                path = DATA / 'import-report.json'
                path.write_bytes(result.stdout); path.chmod(0o600)
                print(json.dumps({k: v for k, v in report.items() if k != 'errors'}), flush=True)
                if not report['passed']:
                    raise SystemExit('Import failed. Inspect the private import-report.json; the original bundle is restored.')
                return
            time.sleep(1)
        raise SystemExit('Import timed out. Check the private database against its backup before retrying.')
    finally:
        run(['docker', 'exec', '-u', '0', container, 'cp', original, bundle])
        run(['docker', 'restart', container])
        print('Clean server bundle restored; no import endpoint remains.', flush=True)


if __name__ == '__main__':
    main()
