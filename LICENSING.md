# Licensing

Kenka-SRD-5.1 combines components with separate licenses. Publishing this fork does not relicense Kanka, the SRD, icons, or container dependencies.

## Kanka application and fork changes

The upstream application is **source available**, licensed by Owlchester SNC under the exact terms in [LICENSE](LICENSE). That file is preserved verbatim from upstream tag `3.17`, commit `cf968d129247af92418e3ecb111904e5165464c0`.

The upstream license file includes the **Commons Clause License Condition v1.0**, including its restriction on selling the software as defined there. This repository does not replace that notice with an MIT, GPL, or other license. Newly authored application, configuration, and documentation changes in this fork are provided under those same upstream terms. Existing third-party notices remain applicable.

Upstream source: https://github.com/owlchester/kanka

## SRD 5.1 rules data — CC BY 4.0

The files in `data/srd5.1/` containing rules are derived from the official 2014 fifth-edition **System Reference Document 5.1**. The required attribution is:

> This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

Official source: https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf

License: https://creativecommons.org/licenses/by/4.0/legalcode

Changes from the PDF: extracted and reorganized into Kanka records, HTML paragraphs, searchable properties, relationships, and category groups. These are prepared reference records; they are not a facsimile of the PDF. Source PDF pages are retained on each record. `data/srd5.1/source.json` records the PDF checksum and batch checksums.

The rules text is licensed separately from the Kanka application. No Monster Manual (2014), proprietary adventure text, hosted campaign export, Wikidot material, or commissioned artwork is included in this SRD base. The names of products and their owners do not imply endorsement.

## Generic icons

**RPG Awesome 0.2.0**, by Daniela Howe, Ivan Montiel, and contributors:

- Source: https://github.com/nagoshiashumari/Rpg-Awesome
- The bundled README identifies the font as SIL Open Font License 1.1, CSS/Sass as MIT, and documentation as CC BY 3.0.
- Preserve the original notices in [data/licenses/RPG-Awesome-LICENSE.txt](data/licenses/RPG-Awesome-LICENSE.txt) and [data/licenses/RPG-Awesome-README.txt](data/licenses/RPG-Awesome-README.txt). The upstream package includes these notices; this fork retains them verbatim.
- The setup renders existing font glyphs into shared category PNGs. It does not include individually commissioned or AI-generated creature artwork.

**Font Awesome Free 6.0.0**, by Fonticons, Inc.:

- Icons: CC BY 4.0; fonts: SIL OFL 1.1; code: MIT.
- Exact license: [public/vendor/fontawesome/6.0.0/LICENSE.txt](public/vendor/fontawesome/6.0.0/LICENSE.txt).
- The compatibility stylesheet maps unavailable styles and names to bundled free glyphs. No Font Awesome Pro kit or paid assets are supplied.

## Dependencies and container images

The optional DiceCloud demo builds upstream GPL-3.0 code from a pinned source revision. Its upstream license is retained in the image; local Docker compatibility changes are included in this repository. The small Fighter evaluation library in `docker/dicecloud-demo/demo-data.mjs` derives its rules content from SRD 5.1 under CC BY 4.0 with the attribution above. It does not contain hosted/community DiceCloud libraries or private campaign characters. Private demo accounts and generated library state are excluded from Git. [DiceCloud source and license](https://github.com/ThaumRystra/DiceCloud).

The optional PCGen browser demo downloads an official pinned PCGen portable archive at launch. PCGen code carries LGPL-2.1-or-later notices, while its game datasets and runtime/dependencies have separate terms, including the SRD conversion's OGL notice. The demo uses a separate GPL-3.0 Webtop image. Preserve both projects' notices when distributing their images/binaries; no PCGen conversion data is assumed to be CC-BY simply because the original SRD is separately available under CC-BY. Downloaded binaries, character saves, credentials and browser-session data are excluded from this public repository. [PCGen source/license](https://github.com/PCGen/pcgen), [Webtop source/license](https://github.com/linuxserver/docker-webtop).

The optional OCF encounter handler uses `@opencharacter/engine` 0.4.0 under Apache-2.0 and `@opencharacter/5e-srd-5.1` 0.4.0 under CC-BY-4.0. Preserve their installed package notices and SRD attribution when distributing the handler. [Engine source and notices](https://github.com/pixelqueue/opencharacter), [SRD 5.1 pack](https://github.com/pixelqueue/opencharacter/tree/main/packs/5e/srd-5.1). Dependencies are pinned in `tools/ocf-handler/package-lock.json`; private configuration, generated upstream DR bundles, node_modules and campaign data are excluded from Git. The popup/launcher links to rules attribution. The adapter overlays the pinned ISC-licensed DR build; retain upstream source/license references when distributing modified bundles.

The optional Dungeon Revealer demo uses the official `dungeonrevealer/dungeon-revealer:v1.17.1` image, pinned by digest in `compose.dungeon-revealer-demo.yaml`. It is a separate ISC-licensed application: [source and license at the selected release](https://github.com/dungeon-revealer/dungeon-revealer/tree/v1.17.1). Its dependency notices remain applicable. Its original synthetic scene uses generated geometric shapes.

The optional standalone PlanarAlly demo uses the official `kruptein/planarally:v2026.2` image, pinned by digest in `compose.planarally-demo.yaml`. PlanarAlly is a separate MIT-licensed project: [source and license at the selected release](https://github.com/Kruptein/PlanarAlly/tree/v2026.2). Its license and bundled dependency notices remain applicable; Kanka's license does not replace them. Its original synthetic demonstration tokens use plain colors and letters.

The workstation also has user-requested private copies of Renovar's map and selected character artwork in both demos. Those assets retain their original rights and are excluded from this public repository, seeds and container images. Their presence in a private demo does not relicense them under the VTT or Kanka license.

PHP/JavaScript dependencies retain their own licenses and notices; see `composer.lock`, `yarn.lock`, and the installed distributions. In particular, the optional build compiles MinIO from its official source tag; MinIO is a separate AGPL-3.0 component ([license at the pinned release](https://github.com/minio/minio/blob/RELEASE.2025-10-15T17-29-55Z/LICENSE)). Its Docker build copies that license into the resulting image. The Dockerfile names the source repository and release; no relicensing is implied. MariaDB, Redis, Meilisearch, Thumbor, Nginx, Mailpit, PHP, Node, and Composer also retain their respective licenses.

Keep this document, the upstream LICENSE, rules attribution, and relevant third-party notices with redistributed copies.
