#!/usr/bin/env python3
"""Pull a Kanka definition read-only and export battle JSON plus PCGen files."""
import argparse
import html
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'storage/app/pcgen-demo/config'
DIST = ROOT / 'storage/app/pcgen-demo/dist/PcGen/lib/app'
spec = importlib.util.spec_from_file_location('pcgen_snapshot', ROOT / 'docker/pcgen-demo/prepare-encounter.py')
snapshot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snapshot)


def plain(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]*>', ' ', value or ''))).strip()


def lst(value):
    return plain(str(value)).replace('|', '/').replace('\t', ' ')


def dump(path, value):
    snapshot.write_json(path, value)


class Kanka:
    def __init__(self, settings):
        self.base = settings['kanka_public'] + '/api/1.0'
        self.token = settings['kanka_token']

    def read(self, path):
        if not re.fullmatch(r'/campaigns/2/(?:entities/\d+(?:/(?:attributes|posts|inventory|entity_abilities))?|(?:items|abilities|races)/\d+)', path):
            raise ValueError('Source path not allowed.')
        url = self.base + path
        rows = []
        for page in range(1, 101):
            request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + self.token, 'Accept': 'application/json'})
            with urllib.request.urlopen(request, timeout=30) as response:
                result = json.load(response)
            if not isinstance(result['data'], list):
                return result['data']
            rows.extend(result['data'])
            if len(rows) > 2000:
                raise ValueError('Source collection exceeds authoring limit.')
            next_url = result.get('links', {}).get('next')
            if not next_url:
                return rows
            parsed = urllib.parse.urlparse(next_url)
            expected = urllib.parse.urlparse(self.base + path)
            query = urllib.parse.parse_qs(parsed.query)
            if (parsed.scheme, parsed.netloc, parsed.path) != (expected.scheme, expected.netloc, expected.path) or query != {'page': [str(page + 1)]}:
                raise ValueError('Unexpected pagination URL.')
            url = next_url
        raise ValueError('Too many source pages.')


def native_build(output, source, sheet):
    entity, attributes = source['entity'], source['attributes']
    fields = {a['name']: a['value'] for a in attributes}
    name, level = entity['name'], int(fields.get('Level', '0'))
    if fields.get('Class') != 'Ranger' or not 1 <= level <= 20:
        raise ValueError('Native advancement builds currently support single-class Ranger 1–20. Use encounter snapshots for other profiles.')
    stats = sheet['stats']
    abilities = stats['abilities']
    race_name = source['races'][0]['name'] if len(source['races']) == 1 else 'Kanka ancestry — review required'
    campaign = 'Kanka Character - ' + str(entity['id'])
    native = output / 'homebrew'
    native.mkdir()
    pcc = ['CAMPAIGN:' + campaign, 'KEY:' + campaign, 'GAMEMODE:5e', 'TYPE:Homebrew.Character',
           'BOOKTYPE:Supplement', 'SHOWINMENU:YES', 'RACE:ancestry.lst',
           'ABILITY:choices.lst', 'CLASS:replacements.lst', 'EQUIPMENT:inventory.lst',
           'TEMPLATE:imported.lst', 'SOURCELONG:Private Kanka character definitions', 'SOURCESHORT:Kanka']
    (native / 'character.pcc').write_text('\n'.join(pcc) + '\n')
    race_key = 'Kanka Ancestry ' + str(entity['id'])
    race_type = 'Fey' if race_name.lower() == 'satyr' else 'Humanoid'
    (native / 'ancestry.lst').write_text('\t'.join([race_key, 'OUTPUTNAME:' + lst(race_name),
        'SIZE:M', 'RACETYPE:' + race_type, 'MOVE:Walk,' + str(stats['speed_ft'])]) + '\n')
    # Recorded scores are the current totals. Do not apply racial/ASI bonuses again.
    review = [
        {'id': 'known-spells', 'status': 'review-required', 'message': 'Known spell selections are unconfirmed. Reference spell links are not selected spells.'},
        {'id': 'canny', 'status': 'review-required', 'message': 'Canny skill is unconfirmed. Keep recorded Perception total in battle JSON; do not infer an expertise choice.'},
        {'id': 'performance', 'status': 'review-required', 'message': 'Keep printed Performance total in battle JSON; reconcile with Reveler proficiency before changing it.'},
        {'id': 'historical-hp', 'status': 'review-required', 'message': 'Historical per-level HP allocations are unrecorded. Zero HP placeholders plus a labeled import adjustment preserve the recorded maximum. Replace the placeholders and remove the adjustment together after review.'},
        {'id': 'historical-asi', 'status': 'review-required', 'message': 'Current ability scores already include past choices. Historical ASI/feat timing is unconfirmed; do not spend an outstanding past-level pool twice.'},
        {'id': 'equipment', 'status': 'review-required', 'message': 'Preserve Kanka equipment flags. Choose an equipped weapon in PCGen; glove attunement is unconfirmed.'},
    ]
    choice_lines = []
    private_keys = []
    replacements = {'Favored Foe': (1, 'Ranger ~ Favored Enemy'),
                    'Deft Explorer': (1, 'Ranger ~ Natural Explorer'),
                    'Primal Awareness': (3, 'Ranger ~ Primeval Awareness')}
    class_lines = ['CLASS:Ranger.MOD']
    for ability in source['abilities']:
        if re.match(r'Reference\b', ability.get('assignment_note', ''), re.I) or ability.get('type') == 'Spell':
            continue
        label = re.sub(r'^Ranger\s*[—–-]\s*', '', ability['name'])
        if label in ('Archery', 'Fighting Style', 'Spellcasting', 'Colossus Slayer'):
            continue
        key = 'Kanka Ability ' + str(ability['entity_id'])
        choice_lines.append('\t'.join([lst(label), 'KEY:' + key, 'CATEGORY:Special Ability',
                                      'TYPE:KankaImported', 'DESC:' + lst(ability.get('entry'))]))
        private_keys.append(key)
        if label in replacements:
            at_level, old = replacements[label]
            class_lines.append(str(at_level) + '\tABILITY:Ranger Class Feature|AUTOMATIC|.CLEAR.' + old)
    (native / 'replacements.lst').write_text('\n'.join(class_lines) + '\n')
    choice_lines.append('Review required\tKEY:Kanka Review Required\tCATEGORY:Special Ability\tTYPE:KankaImported\tDESC:Review spell choices, Canny, Performance, historical HP allocations and ASI/feat timing before advancement. See review.json and Notes.')
    (native / 'choices.lst').write_text('\n'.join(choice_lines) + '\n')
    # PCGen ignores CON on zero/unallocated historical HD. Preserve the known
    # aggregate and retroactive CON changes without inventing historical rolls.
    hp_adjustment = f'{stats["hp_max"]}+{level}*(CON-{(abilities["con"] - 10) // 2})'
    template = ['Kanka Imported Choices', 'VISIBLE:YES',
                'ABILITY:Special Ability|AUTOMATIC|' + '|'.join(private_keys + ['Kanka Review Required']),
                'BONUS:HP|CURRENTMAX|' + str(hp_adjustment)]
    (native / 'imported.lst').write_text('\t'.join(template) + '\n')
    # Match existing PCGen equipment by canonical name; special armor gets an
    # explicit modifier. Unknown gear remains a private reference item.
    equipment = {}
    normalize = lambda value: re.sub('[^a-z0-9]', '', value.lower())
    for path in (DIST / 'data/5e').rglob('*equip*.lst'):
        for line in path.read_text(errors='replace').splitlines():
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            key = next((p[4:] for p in parts if p.startswith('KEY:')), parts[0])
            if not any(x in key for x in ('.MOD', '.COPY', '.FORGET')):
                equipment[normalize(key)] = key
    aliases = {'potionofhealing': 'Potion Of Healing (Healing)', 'shortsword': 'Shortsword',
               'studdedleatherarmor': 'Studded Leather', 'arrows20': 'Arrows (20)',
               'glovesofmissilesnaring': 'Gloves Of Missile Snaring'}
    equipment_lines, owned, sets = [], [], ['EQUIPSET:Kanka loadout|ID:0.1']
    for row in source['inventory']:
        if row.get('position') == 'Reference documents':
            continue
        item = row['item']; item_name = row.get('name') or item['name']
        key = 'Kanka Item ' + str(item['id'])
        norm = normalize(item_name)
        magic_armor = 'studdedleather' in norm and ('+1' in item_name or 'plus1' in norm)
        base = 'Studded Leather' if magic_armor else aliases.get(norm) or equipment.get(norm)
        if base:
            tokens = [base + '.COPY=' + key, 'OUTPUTNAME:' + lst(item_name)]
            if magic_armor:
                tokens.append('EQMOD:PLUS1A')
        else:
            tokens = [key, 'OUTPUTNAME:' + lst(item_name), 'TYPE:Goods.KankaReference', 'WT:0', 'COST:0']
        tokens.append('SPROP:' + lst(row.get('description', '')))
        equipment_lines.append('\t'.join(tokens))
        amount = row['amount']
        # Arrows (20) already has BASEQTY:20 in PCGen; keep three bundles as three.
        owned.append('EQUIPNAME:' + key + '|OUTPUTORDER:' + str(len(owned) + 1) + '|QTY:' + str(amount))
        position = 'Equipped' if row.get('is_equipped') else 'Carried'
        sets.append('EQUIPSET:' + position + '|ID:0.1.' + str(len(owned)).zfill(2) + '|VALUE:' + key + '|QUANTITY:' + str(amount))
    (native / 'inventory.lst').write_text('\n'.join(equipment_lines) + '\n')
    enc = snapshot.encode
    lines = ['PCGVERSION:2.0', 'CAMPAIGN:5e - System Reference Document', 'CAMPAIGN:' + campaign,
             'VERSION:6.09.08', 'GAMEMODE:5e', 'ROLLMETHOD:0|EXPRESSION:0', 'PURCHASEPOINTS:N',
             'CHARACTERTYPE:PC', 'CHARACTERNAME:' + enc(name), 'TABNAME:' + enc(name + ' — Kanka build'),
             *['STAT:' + k.upper() + '|SCORE:' + str(v) for k, v in abilities.items()],
             'ALIGN:CG' if fields.get('Alignment') == 'Chaotic Good' else 'ALIGN:TN',
             'RACE:' + race_key, 'CLASS:Ranger|LEVEL:' + str(level) + '|SKILLPOOL:0|SPELLBASE:WIS',
             *['CLASSABILITIESLEVEL:Ranger=' + str(i) + '|HITPOINTS:0|SKILLSGAINED:0|SKILLSREMAINING:0' for i in range(1, level + 1)],
             'EXPERIENCE:' + str(int(fields.get('Experience points', '0'))),
             'TEMPLATESAPPLIED:[NAME:Ranger]', 'TEMPLATESAPPLIED:[NAME:Kanka Imported Choices]']
    for category, key in [('Ranger Fighting Style', 'Fighting Style ~ Archery'),
                          ('Ranger Archetype', 'Ranger Archetype ~ Hunter'),
                          ("Hunter's Prey Selection", "Hunter's Prey ~ Colossus Slayer")]:
        if category == 'Ranger Fighting Style' and fields.get('Fighting style') != 'Archery':
            continue
        if category != 'Ranger Fighting Style' and fields.get('Subclass') != 'Hunter':
            continue
        lines.append('ABILITY:' + category + '|TYPE:NORMAL|CATEGORY:Special Ability|KEY:' + key)
    # Confirmed skill proficiencies scale normally. An unconfirmed Canny choice
    # is deliberately absent; its recorded numeric total remains in battle JSON.
    for skill in sheet.get('skills', []):
        if skill.get('proficient'):
            lines.append('ABILITY:Skill Proficiency|TYPE:VIRTUAL|CATEGORY:Skill|KEY:' + skill['name'])
    lines += owned + sets
    lines.append('CALCEQUIPSET:0.1')
    descriptions = [plain(entity['child'].get('entry', '')),
                    'Current ability scores imported as totals; do not reapply racial increases or earlier ASIs.',
                    'REVIEW REQUIRED: ' + '; '.join(r['message'] for r in review)]
    lines.append('CHARACTERDESC:' + enc('\n\n'.join(descriptions)))
    for i, post in enumerate(source['posts'], 1):
        if post['name'] in ('Combat, skills, and proficiencies', 'Source review and unresolved selections'):
            lines.append('NOTE:' + enc(post['name']) + '|ID:' + str(i) + '|PARENTID:-1|VALUE:' + enc(plain(post['entry'])))
    lines.append('NOTE:Review placeholders|ID:100|PARENTID:-1|VALUE:' + enc(json.dumps(review, indent=2)))
    (output / 'character.pcg').write_text('\n'.join(lines) + '\n')
    dump(output / 'review.json', review)
    authoring = {'schema': 'kanka-pcgen-character/1', 'edition': '5e-2014',
                 'name': name, 'source': sheet['source'], 'class': fields['Class'],
                 'level': level, 'subclass': fields.get('Subclass'), 'race': race_name,
                 'alignment': fields.get('Alignment'), 'experience_points': int(fields.get('Experience points', '0')),
                 'stats': stats, 'choices': {'fighting_style': fields.get('Fighting style'),
                 'ranger_options': fields.get('Ranger options', '').split('; '),
                 'known_spells': None, 'canny_skill': None, 'performance_resolution': None,
                 'historical_hp_rolls': None, 'historical_asi_choices': None},
                 'inventory': source['inventory'], 'abilities': source['abilities'],
                 'review': review, 'native': {'character_file': 'character.pcg',
                 'data_pack': 'homebrew/character.pcc', 'status': 'review-required'}}
    dump(output / 'character-sheet.json', authoring)
    (output / 'README.txt').write_text(
        'Open character.pcg in PCGen using the desktop shortcut to load its private sources.\n'
        'character-sheet.json is the OCF authoring interchange; PCGen itself does not import JSON.\n'
        'battle-ready.json is the validated kanka-combat-sheet/1 definition for the encounter handler.\n'
        'Review review.json before advancement. Unknown source selections are null placeholders.\n'
        'Historical HP rolls are zero placeholders with a labeled aggregate HP adjustment.\n'
        'Keep this folder private. Rerun exports with a new name; reviewed builds are never overwritten.\n')
    path = '/config/' + output.relative_to(CONFIG).as_posix()
    prefs = output / 'pcgen-preferences'; prefs.mkdir()
    (prefs / 'options.ini').write_text('pcgen.files.homebrewdataPath=' + path + '/homebrew\npcgen.files.characters=' + path + '\n')
    shortcut = ('[Desktop Entry]\nType=Application\nName=' + lst(name) + ' — Kanka build\nExec=/usr/local/bin/pcgen-demo -s ' + path + '/pcgen-preferences -c ' + path + '/character.pcg\nIcon=applications-games\nTerminal=false\n')
    (output / 'open-character.desktop').write_text(shortcut)
    desktop = CONFIG / 'Desktop'; desktop.mkdir(exist_ok=True)
    target = desktop / (output.name + '.desktop'); target.write_text(shortcut); target.chmod(0o755)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--entity-url', required=True)
    parser.add_argument('--quest-url', required=True, help='Quest used to name the PCGen character directory.')
    parser.add_argument('--name', required=True, help='New output directory slug; existing builds are never overwritten.')
    args = parser.parse_args()
    if not re.fullmatch('[a-z0-9][a-z0-9-]{0,63}', args.name):
        parser.error('Use a lowercase directory slug.')
    settings = json.loads((ROOT / 'storage/app/ocf-authoring/handler-config.json').read_text())
    url = urllib.parse.urlparse(args.entity_url)
    base = urllib.parse.urlparse(settings['kanka_public'])
    match = re.fullmatch(r'/w/2/entities/(\d+)/?', url.path)
    if (url.scheme, url.netloc) != (base.scheme, base.netloc) or not match:
        parser.error('Use a character/creature URL from configured local campaign 2.')
    quest_url = urllib.parse.urlparse(args.quest_url)
    quest_match = re.fullmatch(r'/w/2/entities/(\d+)/?', quest_url.path)
    if (quest_url.scheme, quest_url.netloc) != (base.scheme, base.netloc) or not quest_match:
        parser.error('Use a quest entity URL from configured local campaign 2.')
    client = Kanka(settings)
    quest = client.read('/campaigns/2/entities/' + quest_match[1])
    if quest['type'] != 'quest':
        parser.error('The selected quest URL is not a quest.')
    quest_directory = re.sub('[^a-z0-9]+', '_', quest['name'].lower()).strip('_') + '_' + str(quest['id'])
    output = CONFIG / 'Documents/PCGen/characters' / quest_directory / args.name
    if output.exists():
        parser.error('Output exists; use a new --name to preserve reviewed character builds.')
    os.umask(0o077)
    path = '/campaigns/2/entities/' + match[1]
    source = {'entity': client.read(path), 'attributes': client.read(path + '/attributes'),
              'posts': client.read(path + '/posts'), 'inventory': client.read(path + '/inventory')}
    source['posts'] = [p for p in source['posts'] if p['name'] in ('Combat, skills, and proficiencies', 'Source review and unresolved selections')]
    source['abilities'] = []
    for row in client.read(path + '/entity_abilities'):
        ability = client.read('/campaigns/2/abilities/' + str(row['ability_id']))
        source['abilities'].append({**ability, 'assignment_note': row.get('note', '')})
    for row in source['inventory']:
        row['item'] = client.read('/campaigns/2/items/' + str(row['item_id']))
    source['races'] = [client.read('/campaigns/2/races/' + str(r)) for r in source['entity']['child'].get('races', [])]
    result = subprocess.run(['docker', 'compose', '-p', 'kenka-dungeon-revealer-demo', '-f', 'compose.dungeon-revealer-demo.yaml',
                             'exec', '-T', 'ocf-handler', 'node', 'compile-export.mjs'], cwd=ROOT,
                            input=json.dumps(source), text=True, capture_output=True)
    if result.returncode:
        raise SystemExit('OCF validation failed:\n' + result.stderr)
    sheet = json.loads(result.stdout)
    if source['entity']['type'] == 'character':
        output.mkdir(parents=True)
        native_build(output, source, sheet)
    else:
        # Reuse the same deduplicated snapshot converter for NPCs.
        with tempfile.TemporaryDirectory() as temporary:
            snapshot_input = Path(temporary) / 'encounter-source.json'
            dump(snapshot_input, {'id': 'export-' + match[1], 'name': source['entity']['name'],
                                 'tokens': [{'name': source['entity']['name'], 'role': 'enemy', **sheet}]})
            subprocess.run(['python3', str(ROOT / 'docker/pcgen-demo/prepare-encounter.py'),
                            '--encounter-json', str(snapshot_input), '--name', quest_directory,
                            '--subdirectory', args.name], cwd=ROOT, check=True)
    dump(output / 'kanka-source.json', source)
    dump(output / 'battle-ready.json', sheet)
    with (output.parent / '.exports.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        manifest_path = output.parent / 'encounter.json'
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text())
            for entry in manifest['definitions']:
                if entry['source'] == sheet['source']:
                    entry['json'] = output.name + '/battle-ready.json'
                    if source['entity']['type'] == 'character':
                        entry['pcgen'] = output.name + '/character.pcg'
                        entry['pcgen_mode'] = 'native-build-review-required'
                        entry['advancement_ready'] = 'review-required'
                    else:
                        snapshot_manifest = json.loads((output / 'encounter.json').read_text())
                        entry['pcgen'] = output.name + '/' + snapshot_manifest['definitions'][0]['pcgen']
            dump(manifest_path, manifest)
            (output.parent / 'encounter.pcp').write_text('VERSION:6.09.08\n' + ','.join(e['pcgen'] for e in manifest['definitions']) + '\n')
    print('Exported fresh Kanka definition to', output)
    print('Battle JSON: battle-ready.json; native PCGen files are in the same directory. Review flagged choices before advancement.')


if __name__ == '__main__':
    main()
