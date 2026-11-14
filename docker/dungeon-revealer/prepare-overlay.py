#!/usr/bin/env python3
"""Patch pinned native selection to open the matching OCF character sheet."""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
target = root / 'storage/app/dungeon-revealer-demo/overlay'
target.mkdir(parents=True, exist_ok=True)
container = 'kenka-dungeon-revealer-demo-dungeon-revealer-1'
bundle = 'dm-area.ba8ac6e2.js'
shared = 'is-dungeon-master-context.7308d038.js'
mapview = 'map-view.5707b3e0.js'
temporary = None
if subprocess.run(['docker', 'container', 'inspect', container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
    temporary = subprocess.check_output(['docker', 'create', 'dungeonrevealer/dungeon-revealer:v1.17.1@sha256:234c13f650e977f6f3a344d9265eef979da59da8a572629db88b5cb448417797'], text=True).strip()
    container = temporary
try:
    for source, name in [('build/index.html', 'index.html'), ('build/assets/' + bundle, bundle), ('build/assets/' + shared, shared), ('build/assets/' + mapview, mapview)]:
        destination = target / name
        if destination.is_dir():
            raise RuntimeError(f'{destination} must be a file; prepare overlays before Compose startup.')
        if not destination.exists():
            subprocess.run(['docker', 'cp', f'{container}:/usr/src/app/{source}', str(destination)], check=True)
finally:
    if temporary:
        subprocess.run(['docker', 'rm', temporary], check=True, stdout=subprocess.DEVNULL)
html = (target / 'index.html').read_text()
import json
import re
mapping = {"imports": {"/assets/" + name: "/assets/" + name + "?ocf=labels-9" for name in [bundle, shared, mapview]}}
tag = '<script type="importmap">' + json.dumps(mapping, separators=(',', ':')) + '</script>'
if '<script type="importmap">' in html:
    html = re.sub(r'<script type="importmap">.*?</script>', lambda _: tag, html)
else:
    html = html.replace('<head>', '<head>' + tag)
if '/ocf-bridge.js' not in html:
    html = html.replace('</head>', '<script src="/ocf-bridge.js" defer></script></head>')
(target / 'index.html').write_text(html)
text = (target / bundle).read_text()
marker = 'ocf:token'
old = '$h=e=>{const t=e.store.useStore(Eh),[a,r]=Cr();return n.exports.createElement(n.exports.Fragment,null,'
new = '$h=e=>{const t=e.store.useStore(Eh),[a,r]=Cr(),[ocfSelection]=Tt();return n.exports.createElement(n.exports.Fragment,null,n.exports.createElement("button",{type:"button",className:"ocf-token-button",onClick:()=>window.dispatchEvent(new CustomEvent("ocf:token",{detail:{tokenId:Array.from(ocfSelection.keys())[0]}}))},"Stats & rolls"),'
# Remove the previous explicit button; native token selection now opens the sheet.
if new in text:
    text = text.replace(new, old)
if text.count(old) != 1:
    raise RuntimeError('Pinned DR bundle changed; refusing to patch an unknown version.')
(target / bundle).write_text(text)
text = (target / shared).read_text()
old_toggle = 'r.has(t)?r.delete(t):r.set(t,i),n({selectedItems:r})'
new_toggle = 'r.has(t)?r.delete(t):r.set(t,i),n({selectedItems:r}),r.has(t)&&queueMicrotask(()=>window.dispatchEvent(new CustomEvent("ocf:token",{detail:{tokenId:t}})))'
old_select = 'setSelectedItem:(t,i)=>{n({selectedItems:new Map([[t,i]])})}'
new_select = 'setSelectedItem:(t,i)=>{n({selectedItems:new Map([[t,i]])}),queueMicrotask(()=>window.dispatchEvent(new CustomEvent("ocf:token",{detail:{tokenId:t}})))}'
for original, patched in [(old_toggle,new_toggle),(old_select,new_select)]:
    if patched not in text:
        if text.count(original) != 1:
            raise RuntimeError('Pinned DR selection store changed; refusing an unknown patch.')
        text = text.replace(original, patched)
(target / shared).write_text(text)
text = (target / mapview).read_text()
original = 'const h=wt(()=>p.helper.size.fromImageToThree(Math.max(1,i.radius))),g=(k.exports.useContext(at)===!0||f.isMovableByPlayers===!0)&&f.isLocked===!1'
patched = 'const[ocfTurnVersion,ocfSetTurnVersion]=k.exports.useState(0);k.exports.useEffect(()=>{const update=()=>ocfSetTurnVersion(v=>v+1);window.addEventListener("ocf:turn",update);return()=>window.removeEventListener("ocf:turn",update)},[]);const h=wt(()=>p.helper.size.fromImageToThree(Math.max(1,i.radius))),g=(k.exports.useContext(at)===!0||(f.isMovableByPlayers===!0&&(window.ocfCanMoveToken?.(l.id)??false)))&&f.isLocked===!1'
if patched not in text:
    if text.count(original) != 1:
        raise RuntimeError('Pinned native drag controls changed; refusing an unknown patch.')
    text = text.replace(original, patched)
selection_original = 'b=yr(l.id),F=k.exports.useRef(null),I=Tt('
selection_patched = 'b=yr(l.id),ocfSelectEffect=k.exports.useEffect(()=>{const select=event=>{if(event.detail?.tokenId===l.id)b.setSelectedItem(l.id,u)};window.addEventListener("ocf:select-token",select);return()=>window.removeEventListener("ocf:select-token",select)},[l.id,u]),F=k.exports.useRef(null),I=Tt('
if 'ocfSelectEffect=' not in text:
    if text.count(selection_original) != 1:
        raise RuntimeError('Pinned native selection controls changed; refusing an unknown patch.')
    text = text.replace(selection_original, selection_patched)
ready_original = 'if(event.detail?.tokenId===l.id)b.setSelectedItem(l.id,u)'
ready_patched = 'if(event.detail?.tokenId===l.id){window.ocfPendingTokenSelection=null;b.setSelectedItem(l.id,u)}'
if ready_patched not in text:
    if text.count(ready_original) != 1:
        raise RuntimeError('Pinned native selection callback changed.')
    text = text.replace(ready_original,ready_patched)
mount_original = 'window.addEventListener("ocf:select-token",select);return()=>window.removeEventListener("ocf:select-token",select)'
mount_patched = 'window.addEventListener("ocf:select-token",select);if(window.ocfPendingTokenSelection===l.id)select({detail:{tokenId:l.id}});return()=>window.removeEventListener("ocf:select-token",select)'
if mount_patched not in text:
    if text.count(mount_original) != 1:
        raise RuntimeError('Pinned native selection mount changed.')
    text = text.replace(mount_original,mount_patched)
click_original = 'if(F.current=null,E.ctrlKey)b.toggleItem(l.id,u);'
click_patched = 'if(F.current=null,E.button===0&&!E.ctrlKey&&window.dispatchEvent(new CustomEvent("ocf:token",{detail:{tokenId:l.id}})),E.ctrlKey)b.toggleItem(l.id,u);'
if click_patched not in text:
    if text.count(click_original) != 1:
        raise RuntimeError('Pinned native token click handler changed.')
    text = text.replace(click_original,click_patched)
label_original = 'R=y&&g?Pr(.1,f.color):f.color,V=f.text;'
label_patched = 'R=y&&g?Pr(.1,f.color):f.color,V=f.text+((window.ocfTokenEffects?.(l.id)||[]).length?" ["+window.ocfTokenEffects(l.id).map(effect=>effect.name).join(", ")+"]":"");'
if 'V=f.text+' not in text and 'ocfTokenHealthStyle' not in text:
    if text.count(label_original) != 1:
        raise RuntimeError('Pinned native token labels changed; refusing an unknown patch.')
    text = text.replace(label_original,label_patched)
multiline_label = 'R=y&&g?Pr(.1,f.color):f.color,V=f.text+((window.ocfTokenEffects?.(l.id)||[]).length?"\\n"+window.ocfTokenEffects(l.id).map(effect=>effect.name).join(", "):"");'
if multiline_label not in text and 'ocfTokenHealthStyle' not in text:
    if text.count(label_patched) != 1:
        raise RuntimeError('Pinned effect-label text changed.')
    text = text.replace(label_patched,multiline_label)
label_props = 'k.exports.createElement(On,{text:V,position:void 0,backgroundColor:i.tokenImage?"#ffffff":null,fontSize:s*p.ratio/930})'
small_props = 'k.exports.createElement(On,{text:V,position:void 0,backgroundColor:"#ffffff",fontSize:s*p.ratio/1395,color:window.ocfTokenHealthColor?.(l.id)||"#172235",anchorY:"top",textAlign:"center"})'
label_position = '=>i.tokenImage?[A,W-.04-h*E,N]:[A,W,N]'
small_position = '=>[A,W-.04-h*E,N]'
color_original = 'fontSize:l.fontSize,color:"black",font:Gr('
color_patched = 'fontSize:l.fontSize,color:l.color||"black",font:Gr('
anchor_original = 'anchorX:"center",anchorY:"middle",position:l.position'
anchor_patched = 'anchorX:"center",anchorY:l.anchorY||"middle",textAlign:l.textAlign||"left",position:l.position'
background_original = 'k.exports.createElement("mesh",{renderOrder:3,position:l.position},'
background_patched = 'k.exports.createElement("mesh",{renderOrder:3,position:[(l.position?.[0]||0)+(i[0]+i[2])/2,(l.position?.[1]||0)+(i[1]+i[3])/2,l.position?.[2]||0]},'
for original,patched in [(label_props,small_props),(label_position,small_position),(color_original,color_patched),(anchor_original,anchor_patched),(background_original,background_patched)]:
    if patched not in text and not (original == label_props and 'ocfTokenHealthStyle' in text):
        if text.count(original) != 1:
            raise RuntimeError('Pinned token text rendering changed; refusing an unknown patch.')
        text = text.replace(original,patched)
styled_labels = 'k.exports.createElement(k.exports.Fragment,null,k.exports.createElement(On,{text:V,position:void 0,backgroundColor:window.ocfTokenHealthStyle?.(l.id).background||"#ffffff",fontSize:s*p.ratio/1395,color:window.ocfTokenHealthStyle?.(l.id).color||"#172235",anchorY:"top",textAlign:"center"}),(window.ocfTokenEffects?.(l.id)||[]).map((effect,index)=>k.exports.createElement(On,{key:effect.id,text:effect.name,position:[0,-(s*p.ratio/1395)*((V.split("\\n").length||1)*1.2+.1+index*.95),0],backgroundColor:window.ocfEffectStyle?.(effect.name).background||"#4c1d95",fontSize:s*p.ratio/1860,color:window.ocfEffectStyle?.(effect.name).color||"#ede9fe",anchorY:"top",textAlign:"center"})))'
if styled_labels not in text:
    if text.count(small_props) != 1 or text.count(multiline_label) != 1:
        raise RuntimeError('Pinned small token labels changed.')
    text = text.replace(small_props,styled_labels).replace(multiline_label,label_original)
(target / mapview).write_text(text)
print('Pinned token-selection and turn-movement overlay prepared.')
