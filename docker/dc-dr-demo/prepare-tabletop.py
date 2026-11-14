#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Create the independent Renovar tabletop using existing read-only fixtures."""
from pathlib import Path
import importlib.util
import json
import os
import secrets
import shutil
import subprocess

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'storage/app/kanka-tabletop'
BASE=ROOT/'storage/app/dc-dr-demo'

def main():
    os.umask(0o077)
    DATA.mkdir(mode=0o700,exist_ok=True)
    if (DATA/'config.json').exists():
        print('Existing Kanka tabletop configuration preserved.')
        return
    cfg=json.loads((BASE/'config.json').read_text())
    reference=json.loads((ROOT/'storage/app/ocf-authoring/expanded-quest-check.json').read_text())
    spec=importlib.util.spec_from_file_location('export',ROOT/'tools/ocf-handler/export-kanka.py')
    helper=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    client=helper.Kanka(json.loads((ROOT/'storage/app/ocf-authoring/handler-config.json').read_text()))
    quest=client.read('/campaigns/2/entities/3536')
    templates={}
    for profile in cfg['profiles']:
        source=next(t for t in reference['tokens'] if t['token_id']==profile['tokenId'] or t['name']==profile['name'])
        profile['sourceUrl']='http://127.0.0.1:18081/w/2/entities/'+str(source['entity_id'])
        if profile['kind']=='npc':
            eid=source['entity_id']
            if eid not in templates:
                path='/campaigns/2/entities/'+str(eid)
                payload={'entity':client.read(path),'attributes':client.read(path+'/attributes')}
                result=subprocess.run(['docker','compose','-p','kenka-dungeon-revealer-demo','-f','compose.dungeon-revealer-demo.yaml','exec','-T','ocf-handler','node','compile-export.mjs'],cwd=ROOT,input=json.dumps(payload),capture_output=True,text=True,check=True)
                templates[eid]=json.loads(result.stdout)
            profile['template']=templates[eid]
    cfg.update(instance='kanka-renovar-tabletop-v1',name='Renovar — Kanka tabletop',route='/kanka-tabletop',mode='tabletop',characterSuffix=' — Kanka tabletop',drBase='http://kanka-tabletop-map:3000',drPublic='http://127.0.0.1:18086',kanka={'questUrl':'http://127.0.0.1:18081/w/2/entities/3536','label':'Renovar · Kanka quest'},drGMPassword=secrets.token_urlsafe(24),drPlayerPassword=secrets.token_urlsafe(24))
    cfg.pop('additionalConfigs',None)
    destination='kenka-dicecloud-demo_kanka-tabletop-data'
    subprocess.run(['docker','volume','create',destination],check=True,stdout=subprocess.DEVNULL)
    inspected=json.loads(subprocess.check_output(['docker','inspect','kenka-dungeon-revealer-demo-dungeon-revealer-1']))[0]
    source_volume=next(m['Name'] for m in inspected['Mounts'] if m['Destination']=='/usr/src/app/data')
    subprocess.run(['docker','run','--rm','-v',source_volume+':/source:ro','-v',destination+':/destination','node:14.21.3-bullseye','sh','-c','test -z "$(ls -A /destination)" && cp -a /source/. /destination/'],check=True)
    shutil.copytree(BASE/'overlay',DATA/'overlay')
    # Pinned map-only presentation: native chat/sidebar and token stat editor are
    # replaced by the parent DiceCloud battle controls. DR retains map/fog tools.
    html=DATA/'overlay/index.html'
    html.write_text(html.read_text().replace('</head>','<style>.eb0pk9g0,.eb0pk9g1{display:none!important}</style></head>'))
    bundle=DATA/'overlay/dm-area.ba8ac6e2.js'
    text=bundle.read_text()
    marker='wh=e=>{const t=n.exports.useContext(fo)'
    if text.count(marker)!=1:
        raise SystemExit('Pinned DR token editor changed; review before patching.')
    bundle.write_text(text.replace(marker,'wh=e=>{return null;const t=n.exports.useContext(fo)'))

    (DATA/'config.json').write_text(json.dumps(cfg,indent=2))
    (DATA/'quest-source.json').write_text(json.dumps(quest,indent=2))
    (DATA/'dr.env').write_text('DM_PASSWORD='+cfg['drGMPassword']+'\nPC_PASSWORD='+cfg['drPlayerPassword']+'\n')
    (DATA/'access.json').write_text(json.dumps({'url':cfg['dcPublic']+cfg['route']+'/','gm_access_file':str(ROOT/'storage/app/dicecloud-demo/access.json'),'player_access_file':str(BASE/'access.json')},indent=2))
    primary=json.loads((BASE/'config.json').read_text())
    primary['additionalConfigs']=list(dict.fromkeys(primary.get('additionalConfigs',[])+['/run/secrets/kanka-tabletop.json']))
    (BASE/'config.json').write_text(json.dumps(primary,indent=2))
    print('Separate Renovar tabletop prepared with read-only Kanka sources.')

if __name__=='__main__':
    main()
