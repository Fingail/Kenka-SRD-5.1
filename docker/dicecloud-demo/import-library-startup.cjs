// One-shot administrator import, evaluated inside the pinned Meteor server bundle.
// No HTTP/DDP import endpoint is installed. Remove the startup hook after execution.
Meteor.startup(function () {
  const fs = Npm.require('fs');
  const reportPath = '/tmp/srd-import-report.json';
  const report = { passed: false, stage: 'validation', errors: [], cleanedFields: {} };
  try {
    const input = JSON.parse(fs.readFileSync('/tmp/converted-srd-library.json', 'utf8'));
    const Libraries = require('/imports/api/library/Libraries').default;
    const Nodes = require('/imports/api/library/LibraryNodes.ts').default;
    if (!Meteor.users.findOne(input.libraries[0].owner)) throw Error('Local owner not found');
    for (const lib of input.libraries) {
      if (Libraries.findOne(lib._id)) throw Error('Library already exists: ' + lib._id);
      const fields = Object.assign({}, lib); delete fields._id;
      Libraries.simpleSchema().validate(fields);
    }
    const nodeIds = new Set(input.nodes.map(n => n._id));
    const valid = [];
    for (const raw of input.nodes) {
      if (Nodes.findOne(raw._id)) throw Error('Node already exists: ' + raw._id);
      const schema = Nodes.simpleSchema({ type: raw.type });
      const node = schema.clean(raw, { mutate: false, filter: true });
      for (const k of Object.keys(raw)) if (!(k in node)) report.cleanedFields[k] = (report.cleanedFields[k] || 0) + 1;
      try { schema.validate(node); }
      catch (e) { report.errors.push({ id: node._id, type: node.type, name: node.name, message: e.message, details: e.details }); }
      if (node.type === 'reference' && node.ref.collection === 'libraryNodes' && !nodeIds.has(node.ref.id)) throw Error('Unresolved reference');
      valid.push(node);
    }
    report.nodes = valid.length; report.libraries = input.libraries.length;
    fs.writeFileSync('/tmp/srd-cleaned-nodes.json', JSON.stringify(valid), { mode: 0o600 });
    if (report.errors.length) throw Error('Schema validation failed for ' + report.errors.length + ' nodes');
    report.stage = 'import';
    // Validate the complete graph before any writes. Roll back only this new import on failure.
    const insertedLibraries = []; const insertedNodes = [];
    try {
      input.libraries.forEach(lib => { Libraries.insert(lib); insertedLibraries.push(lib._id); });
      valid.forEach(node => { Nodes.insert(node); insertedNodes.push(node._id); });
    } catch (e) {
      insertedNodes.forEach(id => Nodes.remove(id));
      insertedLibraries.forEach(id => Libraries.remove(id));
      throw e;
    }
    report.mainLibraryId = input.mainLibraryId; report.stage = 'complete'; report.passed = true;
  } catch (e) { report.error = String(e.message || e); }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log('SRD local import:', report.passed ? 'complete' : 'failed; inspect private report');
});
