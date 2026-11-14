import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('converter', pathlib.Path(__file__).with_name('convert-library.py'))
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)


class ConversionTest(unittest.TestCase):
    def fixture(self):
        root = converter.MAIN
        return {'libraries': {root: {'name': 'SRD'}}, 'nodes': {
            'base': {'_id': 'base', 'type': 'folder', 'ancestors': [{'id': root}], 'parent': {'id': root}, 'order': 0},
            'stat': {'_id': 'stat', 'type': 'attribute', 'ancestors': [{'id': root}, {'id': 'base'}], 'parent': {'id': 'base'}, 'order': 1, 'baseValue': {'calculation': '#base.value + strength.modifier'}},
            'ref': {'_id': 'ref', 'type': 'reference', 'ancestors': [{'id': root}], 'parent': {'id': root}, 'order': 2, 'ref': {'collection': 'libraryNodes', 'id': 'stat'}},
        }}

    def test_reference_formula_parent_and_bounds(self):
        result = converter.convert(self.fixture(), 'local-owner')
        ids = result['idMap']; nodes = {n['_id']: n for n in result['nodes']}
        self.assertEqual(nodes[ids['ref']]['ref']['id'], ids['stat'])
        self.assertEqual(nodes[ids['stat']]['parentId'], ids['base'])
        self.assertEqual(nodes[ids['stat']]['baseValue']['calculation'], '#' + ids['base'] + '.value + strength.modifier')
        self.assertLess(nodes[ids['base']]['left'], nodes[ids['stat']]['left'])
        self.assertLess(nodes[ids['stat']]['right'], nodes[ids['base']]['right'])
        self.assertFalse(result['libraries'][0]['public'])
        self.assertEqual(result['libraries'][0]['owner'], 'local-owner')
        self.assertEqual(result, converter.convert(self.fixture(), 'local-owner'))

    def test_only_redundant_source_gates_are_removed(self):
        source = self.fixture()
        source['nodes']['base']['slotFillerCondition'] = 'showSRD'
        source['nodes']['stat']['slotFillerCondition'] = 'strength >= 13'
        result = converter.convert(source, 'owner')
        nodes = {n['_id']: n for n in result['nodes']}
        self.assertNotIn('slotFillerCondition', nodes[result['idMap']['base']])
        self.assertEqual(nodes[result['idMap']['stat']]['slotFillerCondition'], 'strength >= 13')

    def test_point_buy_rows_are_requested_and_preserved(self):
        source = self.fixture()
        rows = [{'name': 'Strength', 'variableName': 'unmodifiedStrength', 'value': 15}]
        source['nodes']['stat']['type'] = 'pointBuy'
        source['nodes']['stat']['values'] = rows
        result = converter.convert(source, 'owner')
        self.assertEqual(next(n for n in result['nodes'] if n['_id'] == result['idMap']['stat'])['values'], rows)
        import json
        fields = json.loads(pathlib.Path(__file__).with_name('library-fields.json').read_text())
        self.assertIn('values', fields)

    def test_missing_reference_refused(self):
        source = self.fixture(); source['nodes']['ref']['ref']['id'] = 'missing'
        with self.assertRaisesRegex(ValueError, 'unresolved'):
            converter.convert(source, 'owner')

    def test_vexus_import_is_isolated_and_preserves_source_prerequisites(self):
        source = self.fixture()
        source['nodes']['base']['slotFillerCondition'] = 'showSRD'
        old = converter.convert(source, 'owner')
        new = converter.convert(source, 'owner', namespace='vexus-2014-v1', label='Vexus 2014')
        self.assertFalse(set(old['idMap'].values()) & set(new['idMap'].values()))
        self.assertEqual(new['libraries'][0]['name'], 'Vexus 2014')
        self.assertEqual(next(n for n in new['nodes'] if n['_id'] == new['idMap']['base'])['slotFillerCondition'], 'showSRD')

    def test_cycle_refused(self):
        source = self.fixture(); source['nodes']['base']['parent']['id'] = 'stat'
        with self.assertRaisesRegex(ValueError, 'cycle'):
            converter.convert(source, 'owner')

    def test_v1_computed_value_refused(self):
        source = self.fixture(); source['nodes']['stat']['baseValue'] = 12
        with self.assertRaisesRegex(ValueError, 'pre-v2'):
            converter.convert(source, 'owner')


if __name__ == '__main__':
    unittest.main()
