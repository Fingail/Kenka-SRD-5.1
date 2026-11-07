#!/usr/bin/env python3
"""Launch the isolated DiceCloud browser demo; preserve existing demo data."""
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
REVISION = '88fc9c8321796437017e60e84b9582b5aac44cf1'


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


def main():
    os.umask(0o077)
    directory = ROOT / 'storage/app/dicecloud-demo'
    directory.mkdir(parents=True, exist_ok=True)
    source = directory / 'source'
    if not source.exists():
        run('git', 'clone', 'https://github.com/ThaumRystra/DiceCloud.git', str(source))
        run('git', '-C', str(source), 'checkout', '--detach', REVISION)
    actual = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    if actual != REVISION:
        raise SystemExit('DiceCloud source differs from the tested pin; preserve it and review before rebuilding.')
    patches = source / '.demo-patches'
    patches.mkdir(exist_ok=True)
    shutil.copyfile(ROOT / 'docker/dicecloud-demo/patch-library-copy.cjs', patches / 'patch-library-copy.cjs')
    if not (directory / 'mongo.env').exists():
        database_password = secrets.token_urlsafe(32)
        (directory / 'mongo.env').write_text('MONGO_INITDB_ROOT_USERNAME=dicecloud\nMONGO_INITDB_ROOT_PASSWORD=' + database_password + '\n')
        (directory / 'app.env').write_text(
            'ROOT_URL=http://127.0.0.1:18084\nMONGO_URL=mongodb://dicecloud:' + database_password + '@mongo:27017/dicecloud?authSource=admin\n'
            'METEOR_SETTINGS=' + json.dumps({'public': {'environment': 'production', 'disablePatreon': True, 'disallowCreatureApiImport': False}}) + '\n'
            'MAIL_URL=smtp://mailpit:1025\nNODE_OPTIONS=--max-old-space-size=1536\n')
    if not (directory / 'app.env').exists():
        raise SystemExit('Existing database configuration has no app.env. Restore the matching configuration before starting.')
    mongo_file = directory / 'mongo.env'
    if 'MONGO_REPLICA_KEY=' not in mongo_file.read_text():
        with mongo_file.open('a') as stream:
            stream.write('MONGO_REPLICA_KEY=' + secrets.token_hex(48) + '\n')
    app_file = directory / 'app.env'
    lines = app_file.read_text().splitlines()
    database_url = next(line.split('=', 1)[1] for line in lines if line.startswith('MONGO_URL='))
    if 'replicaSet=' not in database_url:
        database_url += '&replicaSet=dicecloud'
    lines = [line for line in lines if not line.startswith(('MONGO_URL=', 'MONGO_OPLOG_URL=', 'CONTAINER_VERSION='))]
    lines += ['MONGO_URL=' + database_url, 'MONGO_OPLOG_URL=' + database_url.replace('/dicecloud?', '/local?'), 'CONTAINER_VERSION=' + REVISION]
    app_file.write_text('\n'.join(lines) + '\n')
    for filename in ['mongo.env', 'app.env']:
        (directory / filename).chmod(0o600)
    compose = ['docker', 'compose', '-p', 'kenka-dicecloud-demo', '-f', 'compose.dicecloud-demo.yaml']
    run(*compose, 'up', '-d', '--wait', '--wait-timeout', '60', 'mongo')
    run(*compose, 'exec', '-T', 'mongo', 'mongosh', '--quiet', '--eval',
        'const uri="mongodb://"+encodeURIComponent(process.env.MONGO_INITDB_ROOT_USERNAME)+":"+encodeURIComponent(process.env.MONGO_INITDB_ROOT_PASSWORD)+"@127.0.0.1:27017/admin";'
        'const c=new Mongo(uri); const a=c.getDB("admin");'
        'try { a.runCommand({replSetGetStatus:1}); } catch(e) { if(e.code===94)a.runCommand({replSetInitiate:{_id:"dicecloud",members:[{_id:0,host:"mongo:27017"}]}});else throw e; }'
        'for(let n=0;n<60;n++){if(a.runCommand({hello:1}).isWritablePrimary)quit(0);sleep(500);}quit(1);')
    run(*compose, 'up', '-d', '--build', '--wait', '--wait-timeout', '120')
    # Reuse local captured mail for account messages without starting another mail service.
    mail = subprocess.run(['docker', 'inspect', '--format', '{{json .NetworkSettings.Networks}}', 'kenka-local-mailpit-1'], text=True, capture_output=True)
    if mail.returncode == 0 and 'kenka-dicecloud-demo_default' not in json.loads(mail.stdout):
        run('docker', 'network', 'connect', '--alias', 'mailpit', 'kenka-dicecloud-demo_default', 'kenka-local-mailpit-1')
    print('DiceCloud: http://127.0.0.1:18084')
    if (directory / 'access.json').exists():
        print('Private demo login:', directory / 'access.json')


if __name__ == '__main__':
    main()
