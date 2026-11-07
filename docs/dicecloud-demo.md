# DiceCloud local demo

DiceCloud replaces the retired PCGen desktop demo on **http://127.0.0.1:18084**. It is a browser application with its own local accounts. Existing Kanka, OCF, DR and PlanarAlly services remain separate.

```bash
python3 docker/dicecloud-demo/launch.py
```

The launcher clones/validates upstream commit `88fc9c8321796437017e60e84b9582b5aac44cf1`, builds the app and starts the dedicated `kenka-dicecloud-demo` Compose project. Existing database configuration is reused. The site binds only to loopback; MongoDB has no host port. The configured `disablePatreon` option unlocks the self-hosted app's paid restrictions without external account integration. Account email is captured by the existing local Mailpit service.

Read the locally generated demo login from ignored `storage/app/dicecloud-demo/access.json`. Browser verification creates the account; a fresh launch without that step can use normal registration. Passwords, database secrets, source checkout, screenshots and seed state stay under ignored `storage/app/dicecloud-demo/`.

## Starter library

Fresh self-hosted DiceCloud starts empty. The included browser setup creates a private **2014 SRD — local evaluation** library and a synthetic **SRD Fighter — Demo** character. It demonstrates Fighter levels 1–5, six ability scores/saves, calculated proficiency/HP/AC/initiative, fighting-style choices, Champion, Second Wind, Action Surge, a limited ASI choice and Extra Attack.

This is a small evaluation library, not a complete SRD conversion. HP uses the fixed average after first level. ASI choices cover +2 to one ability; +1 to two abilities and feats are omitted. Most situational features are references rather than fully automated actions. Library descriptions flag these limits. No Renovar character or private campaign is migrated by starting the demo.

The setup/check runs through DiceCloud's normal account and validated Meteor methods:

```bash
python3 docker/dicecloud-demo/check-browser.py
```

The browser setup needs the existing Playwright dependency under `tools/ocf-handler/node_modules`. It creates/reuses private `access.json`, records created IDs in `seed-state.json`, and preserves those resources on rerun. The workflow verifies native advancement to Fighter 2, leaving the synthetic character ready for further level-up testing.

## Runtime and persistence

| Component | Purpose |
| --- | --- |
| `dicecloud` | Pinned app build, 2 GiB memory limit |
| `mongo` | Pinned MongoDB 6.0.26, authenticated single-node replica set with oplog updates, 1 GiB memory limit, internal access only |
| `dicecloud-db` volume | Characters, accounts, libraries and other database records |
| `dicecloud-files` volume | Uploaded images and archived character files |

```bash
docker compose -p kenka-dicecloud-demo -f compose.dicecloud-demo.yaml stop
docker compose -p kenka-dicecloud-demo -f compose.dicecloud-demo.yaml up -d
```

Back up both volumes and matching private environment files before changing the database configuration. Do not use `down -v` for normal shutdown. Before removing the demo network, disconnect the reused Mailpit container from `kenka-dicecloud-demo_default`.

Upstream pins Meteor 2.16/Node 14. The Docker build keeps Sharp at 0.32.6 and the server's encoding dependency at 0.1.13 to match that runtime. These are compatibility adjustments for a local evaluation, not a production maintenance commitment. Upload/archive paths are linked into the persistent data volume. Keep the old-runtime demo on loopback until a separately reviewed runtime upgrade and hosting setup is prepared.

The pinned upstream server library-copy method fails to assign the destination creature root/parent when copying a library node. `patch-library-copy.cjs` applies an exact-match server-bundle fix during the image build. It can also be applied to the upstream source module; its layout guard rejects an unknown revision. The browser test verifies that copied attributes populate and native advancement updates the same character. The MongoDB replica set supplies immediate reactive updates.

DiceCloud is GPL-3.0 software; its upstream license is copied into the image. The small demo library derives from SRD 5.1 under CC BY 4.0, with attribution in the library and [LICENSING.md](../LICENSING.md). Hosted/community DiceCloud libraries are not copied automatically. A Kanka/OCF adapter and a complete progression library require separate work after evaluating the demo.

## Retired PCGen data

PCGen's container/network, Webtop image and downloaded application/runtime were removed. Character files remain under `storage/app/pcgen-demo/config/Documents/PCGen/characters/`; a character/settings backup is under `storage/app/pcgen-demo/preserved/`. The historical launcher/export code remains available, but PCGen must be reinstalled before using its native build exporter. Its former HTTPS endpoint is replaced by DiceCloud's HTTP endpoint on the same port.
