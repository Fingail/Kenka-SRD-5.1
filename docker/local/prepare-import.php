<?php

$app = require __DIR__ . '/bootstrap.php';
if (! $app->environment('local')) {
    throw new RuntimeException('Local only');
}
foreach (['import-batch.json' => 'base', 'objects-import-batch.json' => 'objects', 'remaining-import-batch.json' => 'remaining'] as $file => $batch) {
    $manifest = json_decode(file_get_contents(base_path('data/srd5.1/' . $file)), true, 512, JSON_THROW_ON_ERROR);
    $manifest['origin'] = config('app.url');
    file_put_contents(storage_path('app/srd-' . $batch . '-batch.json'), json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
}
copy(base_path('data/srd5.1/icons-plan.json'), storage_path('app/srd-icons-plan.json'));
echo "Prepared runtime copies of the published SRD batches.\n";
