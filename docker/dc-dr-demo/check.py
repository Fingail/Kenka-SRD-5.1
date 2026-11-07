#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import subprocess
import sys
root=Path(__file__).resolve().parents[2]
script='check-live-layout.mjs' if '--live-layout' in sys.argv else 'check-native.mjs' if '--native' in sys.argv else 'check-browser.mjs' if '--browser' in sys.argv else 'check-api.mjs'
subprocess.run(['docker','run','--rm','--user','1000:1000','--network','host','--ipc','host',
 '-v',str(root/'tools/ocf-handler')+':/work:ro',
 '-v',str(root/'docker/dc-dr-demo')+':/demo-tools:ro',
 '-v',str(root/('storage/app/kanka-tabletop' if '--tabletop' in sys.argv or '--native' in sys.argv or '--live-layout' in sys.argv else 'storage/app/dc-dr-demo'))+':/test-data',
 '-v',str(root/'storage/app/dicecloud-demo/access.json')+':/gm-access.json:ro',
 'mcr.microsoft.com/playwright:v1.65.0-noble','node','/demo-tools/'+script],check=True)
