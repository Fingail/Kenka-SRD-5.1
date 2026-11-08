#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Copy supplied bear/dragon/kobold portraits into local DR media, without changing tokens."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import subprocess
import urllib.parse
import urllib.request
ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'storage/app/kanka-tabletop'

class Images:
    def __init__(self,cfg):self.base=cfg['drPublic'];self.password=cfg['drGMPassword'];self.route='/api/socket.io/?EIO=4&transport=polling';self.sequence=0;self.image_ids={}
    def request(self,path,body=None,method=None,mime='text/plain;charset=UTF-8',auth=True):
        headers={'Content-Type':mime}
        if auth:headers['Authorization']='Bearer '+self.password
        req=urllib.request.Request(self.base+path,data=body,method=method,headers=headers)
        with urllib.request.urlopen(req,timeout=30) as res:return res.read()
    def send(self,text):return self.request(self.route,text.encode(),'POST')
    def receive(self):
        result=[]
        for part in self.request(self.route).decode().split('\x1e'):
            if part=='2':self.send('3')
            elif part.startswith('42'):result.append(json.loads(part[2:]))
        return result
    def connect(self):
        self.route+='&sid='+json.loads(self.request(self.route).decode()[1:])['sid'];self.send('40');self.receive()
        self.send('42'+json.dumps(['authenticate',{'password':self.password,'desiredRole':'admin'}]))
        if not any(e[0]=='authenticated' for e in self.receive()):raise RuntimeError('DR media authentication failed.')
    def query(self,operation,variables):
        self.sequence+=1;self.send('42'+json.dumps(['@graphql/execute',{'id':self.sequence,'operation':operation,'variables':variables}]))
        for _ in range(5):
            for event,value in self.receive():
                if event=='@graphql/result' and value.get('id')==self.sequence:
                    if value.get('errors'):raise RuntimeError('DR image operation failed: '+str(value['errors']))
                    return value['data']
        raise RuntimeError('DR image operation timed out.')
    def image(self,path,title):
        data=path.read_bytes()
        if data.startswith(b'\x89PNG\r\n\x1a\n'):extension,mime='png','image/png'
        elif data.startswith(b'\xff\xd8\xff'):extension,mime='jpg','image/jpeg'
        else:raise ValueError('Expected PNG or JPEG artwork: '+path.name)
        digest=hashlib.sha256(data).hexdigest()
        response=self.query('mutation($i:RequestTokenImageUploadInput!){requestTokenImageUpload(input:$i){... on RequestTokenImageUploadDuplicate{tokenImage{id}} ... on RequestTokenImageUploadUrl{uploadUrl}}}',{'i':{'sha256':digest,'extension':extension}})['requestTokenImageUpload']
        image=response.get('tokenImage')
        if not image:
            upload=urllib.parse.urlparse(response['uploadUrl'])
            if not upload.path.startswith(('/files/token-image/','/api/files/token-image/')):raise ValueError('Unexpected DR media upload path.')
            self.request(upload.path,data,'PUT',mime)
            response=self.query('mutation($i:TokenImageCreateInput!){tokenImageCreate(input:$i){... on TokenImageCreateSuccess{createdTokenImage{id}} ... on TokenImageCreateError{reason}}}',{'i':{'title':title,'sha256':digest}})['tokenImageCreate']
            image=response.get('createdTokenImage')
            if not image:raise RuntimeError('DR did not create the portrait image.')
        info=self.query('query($id:ID!){node(id:$id){... on TokenImage{id url}}}',{'id':image['id']})['node'];url=urllib.parse.urlparse(info['url']);public=self.base+url.path+('?' + url.query if url.query else '')
        if self.request(url.path+('?' + url.query if url.query else ''),auth=False)!=data:raise RuntimeError('Public portrait bytes did not match the supplied image.')
        self.image_ids[public]=image['id'];return public
    def close(self):self.send('41')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('bear',type=Path);parser.add_argument('dragon',type=Path);parser.add_argument('kobold',type=Path);parser.add_argument('--bear-avatar',type=Path);parser.add_argument('--dragon-avatar',type=Path);parser.add_argument('--kobold-avatar',type=Path);parser.add_argument('--map-tokens',action='store_true');args=parser.parse_args();os.umask(0o077)
    cfg=json.loads((DATA/'native-config.json').read_text());client=Images(cfg);client.connect()
    try:
        urls={name:client.image(path,name+' portrait') for name,path in [('Black Bear',args.bear),('Adult Gold Dragon',args.dragon),('Kobold',args.kobold)]}
        avatars={name:client.image(path,name+' avatar') for name,path in [('Black Bear',args.bear_avatar),('Adult Gold Dragon',args.dragon_avatar),('Kobold',args.kobold_avatar)] if path}
        if args.map_tokens:
            before=json.loads(client.request('/api/map/'+cfg['mapId']))['data'];updates=[]
            for profile in cfg['profiles']:
                key='Kobold' if profile['name'].startswith('Kobold ') else profile['name']
                if key not in urls:continue
                image_id=client.image_ids[avatars.get(key) or urls[key]]
                client.query('mutation($i:MapTokenUpdateManyInput!){mapTokenUpdateMany(input:$i)}',{'i':{'mapId':cfg['mapId'],'tokenIds':[profile['tokenId']],'properties':{'tokenImageId':image_id}}})
                updates.append({'tokenId':profile['tokenId'],'name':profile['name'],'imageId':image_id})
            after=json.loads(client.request('/api/map/'+cfg['mapId']))['data'];old={t['id']:t for t in before['tokens']};current={t['id']:t for t in after['tokens']}
            assert set(old)==set(current),'Token roster changed during image update.'
            for token_id in old:
                for key in ['x','y','radius','rotation','label','color','isVisibleForPlayers','isMovableByPlayers','isLocked']:
                    assert old[token_id].get(key)==current[token_id].get(key),'Token geometry/flags changed during artwork update.'
            (DATA/'token-art-applied.json').write_text(json.dumps({'updates':updates,'before':before['tokens'],'after':after['tokens'],'geometry_preserved':True},indent=2))
            print('Updated '+str(len(updates))+' map token images; geometry and visibility preserved.')
    finally:client.close()
    overrides=json.loads((DATA/'portrait-overrides.json').read_text()) if (DATA/'portrait-overrides.json').exists() else {}
    plan=[]
    for profile in cfg['profiles']:
        key='Kobold' if profile['name'].startswith('Kobold ') else profile['name']
        if key not in urls:continue
        old=overrides.get(profile['tokenId']);avatar=avatars.get(key) or (old.get('avatarPicture') if isinstance(old,dict) else old) or urls[key]
        overrides[profile['tokenId']]={'picture':urls[key],'avatarPicture':avatar};plan.append({'tokenId':profile['tokenId'],'name':profile['name'],'picture':urls[key],'avatarPicture':avatar,'artworkSource':'local override'})
    (DATA/'portrait-overrides.json').write_text(json.dumps(overrides,indent=2));(DATA/'portrait-plan.json').write_text(json.dumps(plan,indent=2))
    subprocess.run(['docker','run','--rm','--user','1000:1000','--network','host','--ipc','host','-v',str(ROOT/'tools/ocf-handler')+':/work:ro','-v',str(ROOT/'docker/dc-dr-demo')+':/demo-tools:ro','-v',str(DATA)+':/test-data','-v',str(ROOT/'storage/app/dicecloud-demo/access.json')+':/gm-access.json:ro','mcr.microsoft.com/playwright:v1.65.0-noble','node','/demo-tools/sync-native-portraits.mjs'],cwd=ROOT,check=True)
if __name__=='__main__':main()
