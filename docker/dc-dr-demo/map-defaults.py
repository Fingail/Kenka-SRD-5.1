#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""One-time map/grid defaults using existing read-only Kanka size attributes."""
from pathlib import Path
import importlib.util
import json
import os
import re
import sys
import urllib.request

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'storage/app/kanka-tabletop'
PLAN=DATA/'map-defaults-50.json'
SQUARES={'Tiny':0.5,'Small':1,'Medium':1,'Large':2,'Huge':3,'Gargantuan':4}

def size_name(value):
    match=re.search(r'\b(Tiny|Small|Medium|Large|Huge|Gargantuan)\b',str(value),re.I)
    return match.group(1).title() if match else 'Medium'

def prepare():
    if PLAN.exists():return
    os.umask(0o077)
    cfg=json.loads((DATA/'native-config.json').read_text())
    spec=importlib.util.spec_from_file_location('export',ROOT/'tools/ocf-handler/export-kanka.py')
    helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
    client=helper.Kanka(json.loads((ROOT/'storage/app/ocf-authoring/handler-config.json').read_text()))
    cache={};sizes=[]
    for p in cfg['profiles']:
        eid=(p.get('template') or {}).get('source',{}).get('entity_id')
        if not eid:
            match=re.search(r'/entities/(\d+)',p.get('sourceUrl',''));eid=int(match.group(1)) if match else None
        category='Medium'
        if eid:
            if eid not in cache:
                data=client.read('/campaigns/2/entities/'+str(eid)+'/attributes')
                rows=data.get('data',[]) if isinstance(data,dict) else data
                values=[r.get('value','') for r in rows if str(r.get('name','')).lower()=='size']
                cache[eid]=size_name(values[0]) if values else 'Medium'
            category=cache[eid]
        p['size_category']=category
        sizes.append({'tokenId':p['tokenId'],'name':p['name'],'size':category,'diameter':50*SQUARES[category],'radius':25*SQUARES[category]})
    (DATA/'native-config.json').write_text(json.dumps(cfg,indent=2))
    PLAN.write_text(json.dumps({'version':1,'grid_pixels':50,'tokens':sizes,'applied':False},indent=2))

def apply():
    plan=json.loads(PLAN.read_text())
    if plan['applied']:return
    cfg=json.loads((DATA/'native-config.json').read_text())
    def request(path,data=None):
        headers={'Authorization':'Bearer '+cfg['drGMPassword'],'Content-Type':'application/json'}
        req=urllib.request.Request(cfg['drPublic']+path,headers=headers,data=None if data is None else json.dumps(data).encode(),method='GET' if data is None else 'PATCH')
        with urllib.request.urlopen(req,timeout=15) as response:return json.load(response)
    path='/api/map/'+cfg['mapId'];scene=request(path)['data'];grid=scene.get('grid') or {'offsetX':0,'offsetY':0,'color':'rgba(0, 0, 0, 0.25)'}
    grid.update(columnWidth=50,columnHeight=50)
    request(path,{'grid':grid,'showGrid':True,'showGridToPlayers':True})
    tokens={t['id']:t for t in scene['tokens']}
    for p in plan['tokens']:
        if p['tokenId'] in tokens and tokens[p['tokenId']].get('radius')!=p['radius']:
            request(path+'/token/'+p['tokenId'],{'radius':p['radius']})
    plan['applied']=True;PLAN.write_text(json.dumps(plan,indent=2))
    print('50px grid enabled for GM/players; creature tokens sized from Kanka categories.')

if __name__=='__main__':
    if '--apply' in sys.argv:apply()
    else:prepare()
