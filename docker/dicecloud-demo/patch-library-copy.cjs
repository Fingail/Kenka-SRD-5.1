// Targeted fix for DiceCloud 88fc9c8: attach copied nodes to the target actor.
// Can patch either the upstream source module or its unminified server bundle.
const fs = require('fs');
const path = process.argv[2];
if (!path) throw new Error('Supply the library-copy source/bundle path.');
const source = fs.readFileSync(path, 'utf8');
const marker = '// Mark root node as dirty';
if (source.split(marker).length !== 2) throw new Error('Unknown library-copy layout; review the upstream revision.');
const patch = '// Local demo fix: copied properties belong to the destination creature.\n' +
  '  nodes.forEach(function (property) { property.root = { collection: root.collection, id: root.id }; });\n' +
  '  node.parentId = parentId;\n\n  ';
const referenceMarker = '// Reify the subtree as well with recursion';
if (source.split(referenceMarker).length !== 2) throw new Error('Unknown reference-copy layout; review the upstream revision.');
const referencePatch = '// Local demo fix: keep the replaced reference attachment.\n' +
  '    addedNodes[0].parentId = node.parentId;\n' +
  '    addedNodes[0].root = { collection: node.root.collection, id: node.root.id };\n\n    ';
const constantMarker = 'const ComputedOnlyConstantSchema = createPropertySchema({});';
const constantPatch = 'const ComputedOnlyConstantSchema = createPropertySchema({ value: { type: Object, blackbox: true, optional: true } });';
// The source copy module does not contain the constant schema; its bundle does.
let result = source.replace(marker, patch + marker).replace(referenceMarker, referencePatch + referenceMarker);
if (source.includes('require("/server/main.js")')) {
  if (source.split(constantMarker).length !== 2) throw new Error('Unknown constant schema layout; review the upstream revision.');
  result = result.replace(constantMarker, constantPatch);
}
fs.writeFileSync(path, result);
