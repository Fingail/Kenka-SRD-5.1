#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Enable the optional native DiceCloud + copied DR map demo."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
subprocess.run(['python3', 'docker/dc-dr-demo/prepare.py'], cwd=ROOT, check=True)
# Refresh only ignored build patches; regular launcher preserves existing credentials/data.
subprocess.run(['python3', 'docker/dicecloud-demo/launch.py'], cwd=ROOT, check=True)
subprocess.run(['docker', 'compose', '-p', 'kenka-dicecloud-demo', '-f', 'compose.dicecloud-demo.yaml', '-f', 'compose.dc-dr-demo.yaml',
                'up', '-d', '--wait', '--wait-timeout', '180'], cwd=ROOT, check=True)
print('DiceCloud × DR: http://127.0.0.1:18084/dc-dr/')
print('Private player access: storage/app/dc-dr-demo/access.json')
