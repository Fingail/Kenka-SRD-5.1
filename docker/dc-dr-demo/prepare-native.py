#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Configure a native DiceCloud tabletop using the reviewed encounter inputs."""
from pathlib import Path
import json
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
print('Native DiceCloud tabletop configuration ready; custom combat runtime disabled.')
