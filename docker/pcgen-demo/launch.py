#!/usr/bin/env python3
"""Launch an optional private PCGen desktop demo; no Kanka credentials or imports."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
VERSION = '6.09.08.RC1-NIGHTLY.20261106'
URL = f'https://github.com/PCGen/pcgen/releases/download/v{VERSION}/pcgen-{VERSION}-linux-x64-portable.zip'
SHA256 = '9317ec3f0d5401eeea6d34f27335738c092eac24ba86fe7f74c5c6bceee1ec07'


def main():
    os.umask(0o077)
    directory = ROOT / 'storage/app/pcgen-demo'
    directory.mkdir(parents=True, exist_ok=True)
    archive = directory / 'pcgen-linux.zip'
    if not archive.exists():
        temporary = archive.with_suffix('.download')
        with urllib.request.urlopen(URL, timeout=60) as response, temporary.open('wb') as output:
            shutil.copyfileobj(response, output)
        temporary.replace(archive)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
        raise SystemExit('PCGen archive checksum mismatch; replace the archive before retrying.')
    dist = directory / 'dist'
    marker = dist / '.release.json'
    if not marker.exists():
        if dist.exists() and any(dist.iterdir()):
            raise SystemExit('Existing incomplete distribution; move it aside before retrying.')
        dist.mkdir(exist_ok=True)
        with zipfile.ZipFile(archive) as package:
            for entry in package.infolist():
                destination = dist / entry.filename
                if not destination.resolve().is_relative_to(dist.resolve()):
                    raise SystemExit('Unsafe path in PCGen archive.')
                package.extract(entry, dist)
                permissions = entry.external_attr >> 16 & 0o777
                destination.chmod(permissions or (0o755 if entry.is_dir() else 0o644))
        marker.write_text(json.dumps({'version': VERSION, 'url': URL, 'sha256': SHA256}) + '\n')
    elif json.loads(marker.read_text()).get('sha256') != SHA256:
        raise SystemExit('Installed PCGen version differs; preserve existing files and prepare a new distribution.')
    for relative in ['PcGen/bin/PcGen', 'PcGen/lib/runtime/lib/jspawnhelper']:
        executable = dist / relative
        if executable.exists():
            executable.chmod(0o755)
    for executable in (dist / 'PcGen/lib/runtime/bin').glob('*'):
        if executable.is_file():
            executable.chmod(0o755)
    access_path = directory / 'access.json'
    if access_path.exists():
        access = json.loads(access_path.read_text())
    else:
        access = {'url': 'https://127.0.0.1:18084', 'username': 'pcgen-demo', 'password': secrets.token_urlsafe(24)}
        access_path.write_text(json.dumps(access, indent=2) + '\n')
    access_path.chmod(0o600)
    environment = directory / 'demo.env'
    environment.write_text(f"PUID={os.getuid()}\nPGID={os.getgid()}\nCUSTOM_USER={access['username']}\nPASSWORD={access['password']}\n")
    environment.chmod(0o600)
    for relative in ['config/.config/autostart', 'config/Desktop', 'config/.pcgen', 'config/Documents/PCGen/characters', 'config/Documents/PCGen/exports']:
        (directory / relative).mkdir(parents=True, exist_ok=True)
    for relative in ['config/.config/autostart/pcgen.desktop', 'config/Desktop/pcgen.desktop']:
        shutil.copyfile(ROOT / 'docker/pcgen-demo/pcgen.desktop', directory / relative)
        (directory / relative).chmod(0o755)
    (ROOT / 'docker/pcgen-demo/pcgen-demo.sh').chmod(0o755)
    subprocess.run(['docker', 'compose', '-p', 'kenka-pcgen-demo', '-f', 'compose.pcgen-demo.yaml', 'up', '-d'], cwd=ROOT, check=True)
    print('PCGen demo: https://127.0.0.1:18084 (local self-signed certificate)')
    print('Private login:', access_path)


if __name__ == '__main__':
    main()
