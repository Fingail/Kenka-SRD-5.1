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
fs.writeFileSync(path, source.replace(marker, patch + marker));
