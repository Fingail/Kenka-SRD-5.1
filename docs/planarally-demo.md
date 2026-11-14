# PlanarAlly encounter demo

This optional comparison runs at <http://127.0.0.1:18082>. It remains separate from the implemented [DR/OCF integration](ocf-dr-integration-demo.md) and has no Kanka combat adapter. Fresh installations contain no prepared campaign, maps, portraits or user accounts.

The existing workstation has a private comparison room and manually copied media, plus a synthetic sample scene. Those assets, source mappings and access details stay under ignored storage; they are not public seeds or container-image content. Authenticated protocol checks previously covered shared sessions, hidden trackers, player ownership and persistence. Use separate GM/player accounts to compare native controls.

Workstation access details, when present, are in ignored `storage/app/planarally-demo/access.json`. PlanarAlly's internal Socket.IO interface is version-specific. Its [earlier integration plan](planarally-combat-integration-plan.md) is background research; current encounter work is in DR.

## Start and stop this workstation

Run from the application directory:

```bash
docker compose -p kenka-planarally-demo -f compose.planarally-demo.yaml up -d
docker compose -p kenka-planarally-demo -f compose.planarally-demo.yaml ps
docker compose -p kenka-planarally-demo -f compose.planarally-demo.yaml stop
```

The explicit project name prevents the Kanka `.env` project setting from combining deployments. Port 18082 binds to loopback. Three named volumes persist the database, assets and mods. Do not remove these volumes during routine shutdown. Only one additional container runs; no remote desktop or Kanka services are required by this demo.

## Prepare a fresh workstation

```bash
install -d -m 700 storage/app/planarally-demo
cp docker/planarally/config.example.toml storage/app/planarally-demo/config.toml
docker compose -p kenka-planarally-demo -f compose.planarally-demo.yaml run --rm --no-deps --user 0 --entrypoint /bin/sh planarally -c 'chown 9000:9000 /planarally/data /planarally/static/assets /planarally/static/mods'
docker compose -p kenka-planarally-demo -f compose.planarally-demo.yaml up -d
```

Register `demo-gm` and a separate player account in the browser, choose fresh passwords, create a room and invite the player. Set `allow_signups = false` in the private config and restart the service after account creation. The first account name must match `admin_user`. The prepared encounter and workstation credentials are private runtime state, not repository seeds.

The official image is pinned to v2026.2 and its immutable digest. Upstream source and notices: [PlanarAlly](https://github.com/Kruptein/PlanarAlly/tree/v2026.2). This is an evaluation deployment; broader network access and Kanka integration need separate configuration.
