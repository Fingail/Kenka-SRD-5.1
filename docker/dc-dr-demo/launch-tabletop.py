#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Launch the new tabletop using the already built native DiceCloud image."""
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[2]
subprocess.run(['python3','docker/dc-dr-demo/prepare-tabletop.py'],cwd=ROOT,check=True)
subprocess.run(['docker','compose','-p','kenka-dicecloud-demo','-f','compose.dicecloud-demo.yaml','-f','compose.dc-dr-demo.yaml','-f','compose.kanka-tabletop.yaml','up','-d','--wait','--wait-timeout','180'],cwd=ROOT,check=True)
print('Renovar — Kanka tabletop: http://127.0.0.1:18084/kanka-tabletop/')
