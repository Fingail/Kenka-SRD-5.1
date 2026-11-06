<?php

use App\Models\Campaign;
use App\Models\Entity;
use Meilisearch\Client;

$app = require __DIR__ . '/bootstrap.php';

$client = new Client(config('scout.meilisearch.host'), config('scout.meilisearch.key'));
$index = $client->index(config('scout.prefix') . 'entities');
$stats = $index->stats();
$hits = $index->search('Fireball', ['filter' => 'campaign_id = 1'])->getHits();
echo json_encode([
    'indexed_documents' => $stats['numberOfDocuments'],
    'fireball_found' => count(array_filter($hits, fn (array $hit): bool => $hit['name'] === 'Fireball')) > 0,
    'campaigns' => Campaign::count(),
    'imported_srd_records' => Entity::where('source', 'local-srd')->count(),
], JSON_PRETTY_PRINT) . PHP_EOL;
