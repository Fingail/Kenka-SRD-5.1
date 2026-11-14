# PCGen browser demonstration

This is the full PCGen desktop displayed through an isolated Webtop browser session. It is an optional authoring/export evaluation. The read-only [Kanka export helper](pcgen-character-export.md) generates local native builds/reference snapshots and battle JSON; no automatic PCGen-to-Kanka or combat-state sync is enabled.

## Launch and access

```bash
python3 docker/pcgen-demo/launch.py
```

Open <https://127.0.0.1:18084>, accept the local self-signed certificate, and use the generated login in `storage/app/pcgen-demo/access.json`. Do not publish this file or `demo.env`. The browser desktop includes application/terminal access inside its container, so its port is bound only to loopback. No Docker socket, host display, GPU, Kanka API token or Kanka data is mounted.

The launcher downloads the official x64 Linux portable release `6.09.08.RC1-NIGHTLY.20261106`, checks SHA-256 `9317ec3f0d5401eeea6d34f27335738c092eac24ba86fe7f74c5c6bceee1ec07` against the release asset digest, and extracts its bundled Java runtime. No host Java installation is required. The nightly is pinned for repeatability and is not a production-stability claim. Webtop's Ubuntu/XFCE image is pinned in `compose.pcgen-demo.yaml`.

## Demo walkthrough

1. In PCGen's source selector choose game mode **5e** and **System Reference Document 5.1**. The source is marked beta upstream.
2. Load the source and create a disposable SRD character. Start with a simple fighter; evaluate classes, equipment, skills, saves and level progression.
3. Save `.pcg` files under `/config/Documents/PCGen/characters` and exports under `/config/Documents/PCGen/exports`. Quest libraries use `/config/Documents/PCGen/characters/{questname_####}/`.
4. Try the 5e character-sheet/XML exports. Those exports need a separate validated adapter before the encounter handler can consume them.

Full non-SRD builds can require additional licensed/homebrew data. Do not assume PCGen's bundled SRD covers campaign-specific choices or replacement class features. The included source datasets retain their own notices and licenses.

## Persistent files and operations

All downloaded binaries, credentials, certificates, character files, exports and session data are ignored by Git under `storage/app/pcgen-demo/`:

| Path | Purpose |
| --- | --- |
| `dist/PcGen/` | Verified upstream application/runtime, mounted read-only |
| `config/.pcgen/` | PCGen preferences and source selections |
| `config/Documents/PCGen/characters/` | Character saves and quest export libraries |
| `config/Documents/PCGen/exports/` | Suggested export directory |
| `access.json`, `demo.env` | Private browser login and container environment |

```bash
docker compose -p kenka-pcgen-demo -f compose.pcgen-demo.yaml up -d
docker compose -p kenka-pcgen-demo -f compose.pcgen-demo.yaml stop
```

The launcher preserves existing credentials/configuration and verifies the distribution pin on rerun. Starting/stopping PCGen does not restart Kanka, DR, or PlanarAlly. Back up `config/` while PCGen is stopped. Do not remove it during normal shutdown. The Compose definition allows two CPUs, 3 GiB memory and 1 GiB shared memory; actual usage depends on loaded sources and desktop resolution.

## Licensing and next integration step

PCGen code uses LGPL-2.1-or-later notices; data packs, runtime and dependencies retain separate terms, including the bundled SRD conversion's OGL notice. Webtop is separate GPL-3.0 software with its own dependency notices. No downloaded application/data binaries are committed to this repository or relicensed as part of Kanka.

The authoring helper exports fresh Kanka data to the existing `kanka-combat-sheet/1` contract and native PCGen files. It does not change live encounter HP, effects, initiative or resources. Importing reviewed PCGen advancement back into Kanka or the handler remains a separate future adapter.

Sources: [PCGen release](https://github.com/PCGen/pcgen/releases/tag/v6.09.08.RC1-NIGHTLY.20261106), [PCGen source/license](https://github.com/PCGen/pcgen), [Webtop documentation](https://docs.linuxserver.io/images/docker-webtop/), [Webtop source/license](https://github.com/linuxserver/docker-webtop).
