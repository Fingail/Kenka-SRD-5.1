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
# Apply token defaults before native React reads its persisted tool state.
subprocess.run(['python3','docker/dc-dr-demo/map-defaults.py'],cwd=ROOT,check=True)
label_bundle=path.parent/'overlay/map-view.5707b3e0.js'
label_text=label_bundle.read_text()
# Older prepared overlays use 1395/1860 or 465/620; target compact labels for 50px tokens.
if not any(x in label_text for x in ['s*p.ratio/1395','s*p.ratio/465','s*p.ratio/700']):
    raise SystemExit('Pinned map label renderer changed; review before patching.')
label_text=label_text.replace('s*p.ratio/1395','s*p.ratio/700').replace('s*p.ratio/465','s*p.ratio/700').replace('s*p.ratio/1860','s*p.ratio/1000').replace('s*p.ratio/620','s*p.ratio/1000')
movement='g=(k.exports.useContext(at)===!0||(f.isMovableByPlayers===!0&&(window.ocfCanMoveToken?.(l.id)??false)))&&f.isLocked===!1'
if movement not in label_text:raise SystemExit('Pinned native token movement layout changed.')
if movement+'&&!window.diceNativeTargeting' not in label_text:label_text=label_text.replace(movement,movement+'&&!window.diceNativeTargeting')
label_bundle.write_text(label_text)
dm_bundle=path.parent/'overlay/dm-area.ba8ac6e2.js';dm_text=dm_bundle.read_text()
if 'tokenRadius:new ue({from:100})' not in dm_text and 'tokenRadius:new ue({from:25})' not in dm_text:raise SystemExit('Pinned native token defaults changed.')
dm_text=dm_text.replace('tokenRadius:new ue({from:100})','tokenRadius:new ue({from:25})').replace('t.state.columnWidth/2*s*.9','t.state.columnWidth/2*s')
dm_bundle.write_text(dm_text)
html_path=path.parent/'overlay/index.html';html=html_path.read_text()
import re
match=re.search(r'<script type="importmap">(.*?)</script>',html)
if not match:raise SystemExit('Pinned map import map missing.')
imports=json.loads(match.group(1));imports['imports']['/assets/map-view.5707b3e0.js']='/assets/map-view.5707b3e0.js?native-labels='+hashlib.sha256(label_text.encode()).hexdigest()[:12]
imports['imports']['/assets/dm-area.ba8ac6e2.js']='/assets/dm-area.ba8ac6e2.js?native-tools='+hashlib.sha256(dm_text.encode()).hexdigest()[:12]
html=html[:match.start(1)]+json.dumps(imports,separators=(',',':'))+html[match.end(1):]
defaults_script='''<script id="native-token-defaults">try{if(localStorage.getItem('native-token-50-v1')!=='1'){let old={};try{old=JSON.parse(localStorage.getItem('tokenMarkerMapToolSettings')||'{}')}catch{}localStorage.setItem('tokenMarkerMapToolSettings',JSON.stringify({tokenColor:'#000000',tokenText:'',includeTokenText:false,tokenCounter:1,includeTokenCounter:false,...old,tokenRadius:25}));localStorage.setItem('native-token-50-v1','1')}}catch{}</script>'''
html=re.sub(r'<script id="native-token-defaults">.*?</script>','',html)
html=html.replace('<head>','<head>'+defaults_script);html_path.write_text(html)
# The map adapter is mounted outside Meteor's compiled client bundle. Include
# it in the deployment version so existing tabs receive Meteor's reload notice.
client_hash=hashlib.sha256((label_text+dm_text+defaults_script).encode())
for name in ['native-ui.js','native-map-bridge.js','native-tabletop.cjs','dr-server.cjs','native-combat.cjs','native-server.cjs','native-private-logs.cjs','native-action-privacy.cjs','native-combat-ui.js','patch-native-client.cjs','native-service-worker.js','token-status.cjs','token-poses.cjs','native-effects.cjs','native-ammo.cjs','native-sheet-data.cjs','native-sheet-ui.js']:
    client_hash.update(name.encode()+b'\0'+(ROOT/'docker/dc-dr-demo'/name).read_bytes())
version_file=path.parent/'client-version.env'
version_file.write_text('AUTOUPDATE_VERSION=native-map-'+client_hash.hexdigest()[:20]+'\n')
version_file.chmod(0o600)
print('Native DiceCloud tabletop configuration ready; custom combat runtime disabled.')
