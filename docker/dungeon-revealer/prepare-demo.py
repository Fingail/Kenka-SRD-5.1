#!/usr/bin/env python3
"""Prepare private credentials for the optional, isolated Dungeon Revealer demo."""

import json
import os
from pathlib import Path
import secrets


def main():
    os.umask(0o077)
    root = Path(__file__).resolve().parents[2]
    directory = root / "storage/app/dungeon-revealer-demo"
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    directory.chmod(0o700)
    access_path = directory / "access.json"
    if access_path.exists():
        access = json.loads(access_path.read_text())
    else:
        access = {
            "dm_url": "http://127.0.0.1:18083/dm",
            "player_url": "http://127.0.0.1:18083",
            "dm_password": secrets.token_urlsafe(18),
            "player_password": secrets.token_urlsafe(18),
            "integration_enabled": False,
        }
        access_path.write_text(json.dumps(access, indent=2) + "\n")
    access_path.chmod(0o600)
    environment = directory / "demo.env"
    environment.write_text(
        f"DM_PASSWORD={access['dm_password']}\n"
        f"PC_PASSWORD={access['player_password']}\n"
    )
    environment.chmod(0o600)
    print(f"Demo access details: {access_path}")
    print("Dungeon Revealer: http://127.0.0.1:18083/dm")


if __name__ == "__main__":
    main()
