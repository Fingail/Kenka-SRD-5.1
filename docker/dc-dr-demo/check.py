#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import subprocess
import sys
root=Path(__file__).resolve().parents[2]
script='check-native-log.mjs' if '--native-log' in sys.argv else 'check-native-lucky.mjs' if '--native-lucky' in sys.argv else 'check-native-dragon-targets.mjs' if '--native-dragon-targets' in sys.argv else 'check-native-radius.mjs' if '--native-radius' in sys.argv else 'check-native-heal-all.mjs' if '--native-heal-all' in sys.argv else 'check-native-breath.mjs' if '--native-breath' in sys.argv else 'check-native-vectors.mjs' if '--vectors' in sys.argv else 'check-native-workshop.mjs' if '--workshop' in sys.argv else 'check-native-saves.mjs' if '--native-saves' in sys.argv else 'check-native-sheet.mjs' if '--native-sheet' in sys.argv else 'check-native-layout.mjs' if '--native-layout' in sys.argv else 'check-native-combat.mjs' if '--native-combat' in sys.argv else 'check-live-layout.mjs' if '--live-layout' in sys.argv else 'check-native.mjs' if '--native' in sys.argv else 'check-browser.mjs' if '--browser' in sys.argv else 'check-api.mjs'
subprocess.run(['docker','run','--rm','--user','1000:1000','--network','host','--ipc','host',
 '-v',str(root/'tools/ocf-handler')+':/work:ro',
 '-v',str(root/'docker/dc-dr-demo')+':/demo-tools:ro',
 '-v',str(root/('storage/app/kanka-tabletop' if '--native-log' in sys.argv or '--native-lucky' in sys.argv or '--native-dragon-targets' in sys.argv or '--native-radius' in sys.argv or '--native-heal-all' in sys.argv or '--native-breath' in sys.argv or '--vectors' in sys.argv or '--workshop' in sys.argv or '--tabletop' in sys.argv or '--native' in sys.argv or '--live-layout' in sys.argv or '--native-combat' in sys.argv or '--native-layout' in sys.argv or '--native-sheet' in sys.argv or '--native-saves' in sys.argv else 'storage/app/dc-dr-demo'))+':/test-data',
 '-v',str(root/'storage/app/dicecloud-demo/access.json')+':/gm-access.json:ro',
 'mcr.microsoft.com/playwright:v1.65.0-noble','node','/demo-tools/'+script],check=True)
