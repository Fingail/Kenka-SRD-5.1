#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Read Kanka art and update only native tabletop portraits; map tokens stay intact."""
from pathlib import Path
import importlib.util
import json
import os
import re
import subprocess
import urllib.parse
import urllib.request

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'storage/app/kanka-tabletop'

def main():
    os.umask(0o077)
    cfg=json.loads((DATA/'native-config.json').read_text())
    spec=importlib.util.spec_from_file_location('export',ROOT/'tools/ocf-handler/export-kanka.py')
    helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
    client=helper.Kanka(json.loads((ROOT/'storage/app/ocf-authoring/handler-config.json').read_text()))
    entities={};races={};checked={};plan=[]
    def image(record):
        if not (record.get('has_custom_image') or record.get('image') or record.get('image_uuid')):return None
        for url in dict.fromkeys([record.get('image_full'),record.get('image_thumb')]):
            if not url:continue
            parsed=urllib.parse.urlparse(url)
            if parsed.scheme not in ['http','https'] or parsed.hostname not in ['127.0.0.1','localhost']:continue
            if url not in checked:
                try:
                    with urllib.request.urlopen(url,timeout=20) as response:
                        mime=response.headers.get_content_type();data=response.read(12_000_001)
                    checked[url]=bool(mime.startswith('image/') and 0<len(data)<=12_000_000)
                except Exception:checked[url]=False
            if checked[url]:return url
        return None
    for profile in cfg['profiles']:
        match=re.search(r'/w/2/entities/(\d+)(?:$|[/?#])',profile.get('sourceUrl',''))
        if not match:continue
        eid=int(match.group(1))
        if eid not in entities:entities[eid]=client.read('/campaigns/2/entities/'+str(eid))
        entity=entities[eid];child=entity.get('child') or {};url=image(child);origin='character' if entity.get('type')=='character' else 'creature'
        if not url:
            for rid in child.get('races',[]):
                rid=int(rid)
                if rid not in races:races[rid]=client.read('/campaigns/2/races/'+str(rid))
                url=image(races[rid])
                if url:origin='race';break
        if url:plan.append({'tokenId':profile['tokenId'],'name':profile['name'],'entityId':eid,'picture':url,'avatarPicture':url,'artworkSource':origin})
        else:print(profile['name']+': no usable character/race artwork; existing portrait retained.')
    (DATA/'portrait-plan.json').write_text(json.dumps(plan,indent=2))
    subprocess.run(['docker','run','--rm','--user','1000:1000','--network','host','--ipc','host',
        '-v',str(ROOT/'tools/ocf-handler')+':/work:ro','-v',str(ROOT/'docker/dc-dr-demo')+':/demo-tools:ro',
        '-v',str(DATA)+':/test-data','-v',str(ROOT/'storage/app/dicecloud-demo/access.json')+':/gm-access.json:ro',
        'mcr.microsoft.com/playwright:v1.65.0-noble','node','/demo-tools/sync-native-portraits.mjs'],cwd=ROOT,check=True)

if __name__=='__main__':main()
