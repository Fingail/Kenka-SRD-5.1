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

The pinned upstream server library-copy method fails to assign the destination creature root/parent and loses the parent attachment when resolving references. `patch-library-copy.cjs` applies an exact-match server-bundle fix during the image build. It can also be applied to the upstream source module; its layout guard rejects an unknown revision. The browser test verifies that copied attributes populate and native advancement updates the same character. The MongoDB replica set supplies reactive updates. The bundle patch also adds the missing computed constant value schema: upstream calculates constants but otherwise omits their values from persistence, which hides source-gated advancement choices. This schema fix applies to the compiled server bundle; the copy-parent fixes also apply to the source copy module.

DiceCloud is GPL-3.0 software; its upstream license is copied into the image. The small demo library derives from SRD 5.1 under CC BY 4.0, with attribution in the library and [LICENSING.md](../LICENSING.md). Hosted/community DiceCloud libraries are not copied automatically. A Kanka/OCF adapter and a complete progression library require separate work after evaluating the demo.

## Retired PCGen data

PCGen's container/network, Webtop image and downloaded application/runtime were removed. Character files remain under `storage/app/pcgen-demo/config/Documents/PCGen/characters/`; a character/settings backup is under `storage/app/pcgen-demo/preserved/`. The historical launcher/export code remains available, but PCGen must be reinstalled before using its native build exporter. Its former HTTPS endpoint is replaced by DiceCloud's HTTP endpoint on the same port.

## Resolved hosted SRD test library

The local evaluation now also contains **2014 SRD — resolved test library**, converted from the public [DiceCloud 5th Edition SRD](https://dicecloud.com/library/hAQmc87ty6DbWwZ42). The private import contains 10,182 nodes across the main library and 20 dependency libraries. Dependencies contain only the referenced subtrees; choose the main library when creating characters. The original small Fighter library remains separate.

The conversion preserves the existing v2 calculation objects, replaces legacy ancestor/order trees with validated nested sets, remaps IDs and references, and replaces hosted ownership/sharing with the local demo owner and private access. Schema validation completed for every node before insertion. Only cached computation/source-ID fields were filtered. Community dependency libraries have evolved since the SRD wrapper was published; 36 retired target IDs needed reviewed replacements. The private repair manifest records each replacement. The fixed-source wrapper omits 1,298 redundant `showSRD`/`!showPHB` sourcebook visibility gates; other conditions and character prerequisites are retained. One legacy Mystic Arcanum Power Word Stun reference now uses the current canonical Stunned effect; check the spell's 150-HP threshold manually before applying it. Zero dangling references is a structural check, not a claim that every feature has been play-tested.

The main library provides the SRD races, twelve classes and advancement choices through level 20, their SRD subclass choices, Acolyte, Grappler, equipment, spells and supporting effects. Dependency libraries are partial implementation support, not additional complete rules sources. Only subscribe to/select the main library. Shared upstream implementation libraries contain edition switches; the test character explicitly selects the SRD source. Additional sourcebooks and a Kanka/OCF adapter are not enabled by this import.

Downloaded snapshots, reviewed repair mappings, converted data, backups and browser results stay under ignored `storage/app/dicecloud-demo/`, with private file permissions. Community library implementations are kept local; SRD licensing does not automatically license community code or unrelated sourcebook content for redistribution. Public repository files contain tools and documentation, not the downloaded libraries.

Maintenance tools:

- `resolve-library.mjs` anonymously reads public Meteor publications, checkpoints source data, selects the transitive referenced subtrees and applies an existing private reviewed repair manifest. It never logs into or changes hosted DiceCloud. Unresolved references cause an unsuccessful result.
- `convert-library.py` refuses dangling references, invalid legacy computed values, parent cycles or cross-library parents. It writes a private, deterministic import payload.
- `import-library.py` takes a compressed database backup, temporarily runs `import-library-startup.cjs` inside the pinned server, validates the entire payload against native schemas and inserts new libraries. It refuses ID collisions. Validation failures write no data; insertion failures roll back this new import. Its `finally` block restores the clean server bundle. There is no permanent import API endpoint. Avoid concurrent imports or restarting/recreating containers during the operation.
- `check-resolved-library.mjs` creates/reuses a separate synthetic Human Fighter, assigns a standard array through native property edits, and exercises native level-up. `--reset` deletes only its recorded disposable test actor; do not reset a character you have begun using.

Run the resolver/browser scripts with the same Playwright container and three mounts used by `check-browser.py`, selecting `node /demo-tools/resolve-library.mjs` or `node /demo-tools/check-resolved-library.mjs`. Convert/import from the repository root with `python3 docker/dicecloud-demo/convert-library.py` and `python3 docker/dicecloud-demo/import-library.py`. The converter needs private `local-owner.json` containing the authenticated local demo user's ID. An existing `import-report.json` with `passed: true` indicates this payload is already imported; do not re-import it. Preserve the private snapshots/repair manifest to reproduce this tested source version rather than assuming upstream library IDs/content remain unchanged.

Focused converter checks: `python3 -m unittest discover -s docker/dicecloud-demo -p test_conversion.py`.

During bulk build edits, the pinned REST character endpoint can return a stale loaded-character snapshot. The resolved-library browser check reads live published character properties and verifies final persisted stats separately; reload the character before relying on REST exports. Treat a DiceCloud-to-OCF export adapter as future work until that endpoint behavior is resolved.

The pinned upstream slot/level picker still treats asynchronous parser results synchronously for conditional options. The main SRD source gates are removed as redundant in this single-source import, allowing normal SRD level selection. Other conditional choices may require **Show All** and manual prerequisite review; automatic eligibility checking is not verified. This is an upstream UI compatibility limit, not a dangling library reference.

Verified local test: [SRD Human Fighter — Library Test](http://127.0.0.1:18084/character/jbk8Kkqp5ZSpwmcMM), Human (Default), Acolyte, Archery and a standard array, advanced through the native picker to Fighter 2. Saved and published stats agree: HP 20/20, STR 16, DEX 15, CON 14, AC 12 (unarmored), speed 30 and proficiency +2. Five focused conversion checks pass. All 10,182 imported nodes remain present and no reference target is missing. Language/skill/starting-equipment slots are intentionally available for further build testing; this is a synthetic character, not Lux. Private verification results and screenshot: `resolved-browser-result.json`, `resolved-library-test.png`.
