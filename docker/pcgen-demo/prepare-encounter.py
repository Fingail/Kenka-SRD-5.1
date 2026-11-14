#!/usr/bin/env python3
"""Export reusable encounter JSON and native PCGen reference snapshots locally."""
import argparse
from collections import Counter
import json
import os
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'storage/app/pcgen-demo/config'
SHEET_FIELDS = ('source', 'stats', 'attacks', 'saving_throws', 'skills',
                'proficiencies', 'features', 'damage_traits', 'advanced_actions',
                'review_notes')


def encode(value):
    entities = {'&': '&amp;', '\n': '&nl;', '\r': '&cr;', '\f': '&lf;',
                ':': '&colon;', '|': '&pipe;', '[': '&lbracket;', ']': '&rbracket;'}
    return ''.join(entities.get(c, c) for c in str(value))


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--encounter-id', default='kanka-2-quest-3536')
    parser.add_argument('--encounter-json', type=Path, help='Use an offline GM encounter export instead of HTTP GET.')
    parser.add_argument('--name', help='Optional directory slug; default is questname_####. Existing directories are preserved.')
    parser.add_argument('--subdirectory', help='Optional new profile subdirectory within the quest directory.')
    args = parser.parse_args()
    if args.name and not re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,100}', args.name):
        parser.error('Use a lowercase slug for --name.')
    if args.subdirectory and not re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,100}', args.subdirectory):
        parser.error('Use a lowercase slug for --subdirectory.')
    if args.encounter_json:
        encounter = json.loads(args.encounter_json.read_text())
    else:
        access = json.loads((ROOT / 'storage/app/dungeon-revealer-demo/access.json').read_text())
        request = urllib.request.Request('http://127.0.0.1:18083/ocf-api/encounters',
                                         headers={'Authorization': 'Bearer ' + access['dm_password']})
        with urllib.request.urlopen(request, timeout=30) as response:
            encounters = json.load(response)
        encounter = next((e for e in encounters if e['id'] == args.encounter_id), None)
        if encounter is None:
            parser.error('Prepared encounter not found.')
    os.umask(0o077)
    if not args.name:
        quest_id = re.search(r'quest-(\d+)$', encounter['id'])
        if not quest_id:
            parser.error('Provide --name for an export without a quest identity.')
        args.name = re.sub('[^a-z0-9]+', '_', encounter['name'].lower()).strip('_') + '_' + quest_id[1]
    output = CONFIG / 'Documents/PCGen/characters' / args.name
    if args.subdirectory:
        output /= args.subdirectory
    if output.exists():
        parser.error('Output exists; use a different --name to preserve reviewed files.')
    tokens = encounter['tokens']
    definitions = {}
    counts = Counter()
    for token in tokens:
        source = token['source']
        identity = (source['campaign_id'], source['entity_id'])
        sheet = {'schema': 'kanka-combat-sheet/1', 'edition': '5e-2014',
                 **{k: token[k] for k in SHEET_FIELDS if k in token}}
        # Individual HP/effects/death saves, demo potion supplies and token IDs
        # belong to encounter state, never to a reusable source definition.
        if identity in definitions and definitions[identity]['sheet'] != sheet:
            parser.error('Instances of one source have different definitions; review before exporting.')
        name = re.sub(r' \d+$', '', token['name']) if token.get('instance_count', 1) > 1 else token['name']
        slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
        slug = f'{slug}-{source["campaign_id"]}-{source["entity_id"]}'
        definitions[identity] = {'name': name, 'slug': slug, 'sheet': sheet, 'role': token['role']}
        counts[identity] += 1
    output.mkdir(parents=True)
    for folder in ['json', 'characters', 'homebrew', 'pcgen-preferences']:
        (output / folder).mkdir()
    campaign = 'Kanka Encounter Snapshots - ' + args.name + (' - ' + args.subdirectory if args.subdirectory else '')
    pcc = ['CAMPAIGN:' + campaign, 'KEY:' + campaign, 'GAMEMODE:5e',
           'TYPE:Homebrew.Encounter', 'BOOKTYPE:Supplement', 'SHOWINMENU:YES',
           'SOURCELONG:Local Kanka encounter snapshots', 'SOURCESHORT:Encounter',
           'RACE:snapshots_races.lst']
    (output / 'homebrew/snapshots.pcc').write_text('\n'.join(pcc) + '\n')
    races = []
    manifest = {'schema': 'kanka-encounter-library/1', 'encounter_id': encounter['id'],
                'name': encounter['name'], 'definitions': []}
    for entry in definitions.values():
        sheet, name, slug = entry['sheet'], entry['name'], entry['slug']
        stats = sheet['stats']
        for key in ('ac', 'hp_max', 'initiative', 'speed_ft'):
            if not isinstance(stats.get(key), int):
                raise ValueError('Missing integer basic stat: ' + key)
        abilities = stats['abilities']
        if any(not isinstance(abilities.get(k), int) for k in ('str', 'dex', 'con', 'int', 'wis', 'cha')):
            raise ValueError('Missing ability score.')
        write_json(output / 'json' / (slug + '.json'), {'name': name, **sheet})
        race = 'Encounter Snapshot - ' + args.name + '-' + (args.subdirectory or 'library') + '-' + slug
        dex = (abilities['dex'] - 10) // 2
        races.append('\t'.join([race, 'OUTPUTNAME:' + name + ' (combat snapshot)',
                                'SIZE:M', 'RACETYPE:Snapshot', 'MOVE:Walk,' + str(stats['speed_ft']),
                                'BONUS:HP|CURRENTMAX|' + str(stats['hp_max']),
                                'BONUS:COMBAT|AC|' + str(stats['ac'] - 10 - dex),
                                'BONUS:COMBAT|INITIATIVE|' + str(stats['initiative'] - dex)]))
        summary = [name + ' — encounter reference snapshot',
                   f'AC {stats["ac"]}; HP maximum {stats["hp_max"]}; initiative {stats["initiative"]:+}; speed {stats["speed_ft"]} ft.',
                   ' / '.join(k.upper() + ' ' + str(v) for k, v in abilities.items()),
                   'This is a fixed combat reference, not a reconstructed PCGen class/race build.',
                   'Attacks, skills, saves, traits and advanced actions below retain their recorded values.',
                   'The native race uses neutral Medium/Snapshot plumbing; original creature identity is in the source and JSON.',
                   '', json.dumps({'name': name, **sheet}, indent=2, ensure_ascii=False)]
        lines = ['PCGVERSION:2.0', 'CAMPAIGN:5e - System Reference Document',
                 'CAMPAIGN:' + campaign, 'VERSION:6.09.08', 'GAMEMODE:5e',
                 'ROLLMETHOD:0|EXPRESSION:0', 'PURCHASEPOINTS:N',
                 'CHARACTERTYPE:' + ('PC' if entry['role'] == 'pc' else 'Monster'),
                 'CHARACTERNAME:' + encode(name + ' (combat snapshot)'), 'TABNAME:' + encode(name + ' (snapshot)'),
                 *['STAT:' + k.upper() + '|SCORE:' + str(v) for k, v in abilities.items()],
                 'ALIGN:TN', 'RACE:' + race, 'EXPERIENCE:0',
                 'CHARACTERDESC:' + encode('\n'.join(summary)),
                 'NOTE:Encounter stat block|ID:1|PARENTID:-1|VALUE:' + encode('\n'.join(summary))]
        (output / 'characters' / (slug + '.pcg')).write_text('\n'.join(lines) + '\n')
        identity = (sheet['source']['campaign_id'], sheet['source']['entity_id'])
        manifest['definitions'].append({'name': name, 'source': sheet['source'],
                                        'quantity': counts[identity], 'pcgen_mode': 'reference-snapshot', 'advancement_ready': False,
                                        'json': 'json/' + slug + '.json',
                                        'pcgen': 'characters/' + slug + '.pcg'})
    (output / 'homebrew/snapshots_races.lst').write_text('\n'.join(races) + '\n')
    write_json(output / 'encounter.json', manifest)
    (output / 'encounter.pcp').write_text('VERSION:6.09.08\n' +
                                        ','.join(e['pcgen'] for e in manifest['definitions']) + '\n')
    # Isolate snapshot sources/preferences from the user's advancement session.
    container_path = '/config/' + output.relative_to(CONFIG).as_posix()
    preferences = ('pcgen.files.homebrewdataPath=' + container_path + '/homebrew\n'
                   'pcgen.files.characters=' + container_path + '/characters\n')
    (output / 'pcgen-preferences/options.ini').write_text(preferences)
    shortcut = ('[Desktop Entry]\nType=Application\nName=Encounter snapshots — ' + args.name + (' / ' + args.subdirectory if args.subdirectory else '') +
                '\nExec=/usr/local/bin/pcgen-demo -s ' + container_path + '/pcgen-preferences -c ' +
                container_path + '/' + manifest['definitions'][0]['pcgen'] + '\nIcon=applications-games\nTerminal=false\n')
    (output / 'open-encounter.desktop').write_text(shortcut)
    desktop = CONFIG / 'Desktop'
    desktop.mkdir(exist_ok=True)
    shortcut_path = desktop / ('encounter-' + args.name + ('-' + args.subdirectory if args.subdirectory else '') + '.desktop')
    shortcut_path.write_text(shortcut)
    shortcut_path.chmod(0o755)
    (output / 'README.txt').write_text(
        'One source definition per campaign/entity; quantities are in encounter.json.\n'
        'JSON is the reusable combat contract. PCGen opens characters/*.pcg, not JSON.\n'
        'Use the Encounter snapshots desktop shortcut to open the first definition\n'
        'with isolated source preferences. File > Party > Open encounter.pcp loads all.\n'
        'For another PCGen installation, configure homebrew/ as its homebrew data\n'
        'directory and load System Reference Document 5.1 plus ' + campaign + '.\n'
        'Read the complete stat block in Description/Notes. These are fixed reference\n'
        'snapshots with native base scores, AC, HP and walk speed, not leveled builds.\n'
        'Attacks, saves, skills and traits are reference text, not native PCGen mechanics.\n'
        'No live HP, effects, inventory consumption, token IDs or demo potions are exported.\n'
        'For PC advancement, maintain a separate native class/level/feature build under\n'
        'PCGen/characters. Never level up these snapshots or overwrite a reviewed build.\n'
        'Keep this directory private; it may contain campaign character material.\n')
    print(f'Created {len(definitions)} definitions for {len(tokens)} participants: {output}')


if __name__ == '__main__':
    main()
