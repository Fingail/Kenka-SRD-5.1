#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Configure a native DiceCloud tabletop using the reviewed encounter inputs."""
from pathlib import Path
import json
import hashlib
import os
import subprocess
ROOT=Path(__file__).resolve().parents[2]
subprocess.run(['python3','docker/dc-dr-demo/prepare-tabletop.py'],cwd=ROOT,check=True)
os.umask(0o077)
path=ROOT/'storage/app/kanka-tabletop/native-config.json'
if not path.exists():
    cfg=json.loads((path.parent/'config.json').read_text())
    cfg.update(instance='renovar-native-dice-tabletop-v1',name='Renovar — Native DiceCloud tabletop',mode='native',characterSuffix=' — native tabletop')
    cfg.pop('additionalConfigs',None)
    path.write_text(json.dumps(cfg,indent=2))
    path.chmod(0o600)
# The map adapter is mounted outside Meteor's compiled client bundle. Include
# it in the deployment version so existing tabs receive Meteor's reload notice.
client_hash=hashlib.sha256()
for name in ['native-ui.js','native-map-bridge.js','native-tabletop.cjs','dr-server.cjs','native-combat.cjs','native-combat-ui.js','patch-native-client.cjs','native-service-worker.js']:
    client_hash.update(name.encode()+b'\0'+(ROOT/'docker/dc-dr-demo'/name).read_bytes())
version_file=path.parent/'client-version.env'
version_file.write_text('AUTOUPDATE_VERSION=native-map-'+client_hash.hexdigest()[:20]+'\n')
version_file.chmod(0o600)
print('Native DiceCloud tabletop configuration ready; custom combat runtime disabled.')
