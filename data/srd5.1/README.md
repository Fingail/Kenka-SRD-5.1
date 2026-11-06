# SRD 5.1 base

This directory contains 1,584 prepared reference records from the official 2014 SRD 5.1. See [licensing and exact attribution](../../LICENSING.md).

| Batch | Records | Contents |
| --- | ---: | --- |
| `import-batch.json` | 668 | 319 spells, 317 creatures, 15 conditions, 17 rules articles |
| `objects-import-batch.json` | 468 | 228 ordinary equipment records, 240 magic items |
| `remaining-import-batch.json` | 448 | Races, classes, subclasses, background, feat, features, hazards, diseases, languages, pantheons, deities and planes |

The last batch includes 13 race/subrace records, 12 classes, 12 subclasses, 1 background (Acolyte), 1 feat (Grappler), 277 features, 12 hazards, 9 diseases, 22 languages/dialects, 4 pantheons, 67 deities and 18 planar entries/categories. Counts reflect this SRD's contents, not every published fifth-edition option. Some planar entries share source paragraphs rather than separate detailed descriptions.

`icons-plan.json` maps reference records to 44 shared RPG Awesome glyphs and 37 category groups. It is display metadata, not additional rules. Three root tags make 40 browsing-group tags; two further tags distinguish Common and Unique objects.

Runtime imports must preserve order: base, objects, remaining. Source keys and hashes protect against duplicates and refuse overwritten local edits. Entity 1 is reserved for attribution and entity 2 for the rules overview. The supported base setup therefore starts with a fresh database and uses campaign 1. `prepare-import.php` copies manifests to ignored runtime storage and sets their origin to the configured local URL.

No database dumps, users, login credentials, access tokens, hosted campaign content, or remote entity IDs are required to reproduce the base.
