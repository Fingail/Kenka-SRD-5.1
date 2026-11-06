<?php

use App\Models\Campaign;
use App\Models\Entity;
use App\Services\LocalSrdImporter;

beforeEach(function () {
    $this->asUser()->withCampaign();
    $this->record = [
        'key' => 'srd5.1:spell:Test Spell', 'name' => 'Test Spell',
        'module' => 'ability', 'kind' => 'Spell',
        'entry' => '<p>Test rules text.</p>',
        'properties' => ['level' => 1, 'concentration' => false],
    ];
});

it('resumes a source record without duplicating its native child or properties', function () {
    $importer = app(LocalSrdImporter::class);
    $campaign = Campaign::firstOrFail();
    $first = $importer->importRecord($campaign, auth()->user(), $this->record);
    $again = $importer->importRecord($campaign, auth()->user(), $this->record);
    $entity = Entity::findOrFail($first['entity_id']);

    expect($again['entity_id'])->toBe($first['entity_id'])
        ->and($again['action'])->toBe('unchanged')
        ->and($entity->child)->not->toBeNull()
        ->and($entity->attributes()->where('name', 'concentration')->value('value'))->toBe('0')
        ->and(Entity::where('source', 'local-srd')->count())->toBe(1);
});

it('preserves a manually edited destination when a source record is resumed', function () {
    $importer = app(LocalSrdImporter::class);
    $campaign = Campaign::firstOrFail();
    $first = $importer->importRecord($campaign, auth()->user(), $this->record);
    Entity::findOrFail($first['entity_id'])->forceFill(['entry' => '<p>Local edit.</p>'])->saveQuietly();

    expect(fn () => $importer->importRecord($campaign, auth()->user(), $this->record))
        ->toThrow(RuntimeException::class, 'Changed source or edited destination');
    expect(Entity::findOrFail($first['entity_id'])->entry)->toBe('<p>Local edit.</p>');
});
