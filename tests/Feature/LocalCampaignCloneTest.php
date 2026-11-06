<?php

use App\Models\Campaign;
use App\Models\Entity;
use App\Models\EntityAbility;
use App\Services\LocalCampaignCloneService;
use App\Services\LocalSrdImporter;

it('copies a rules library with distinct native IDs and leaves the source intact', function () {
    $this->asUser()->withCampaign();
    config(['selfhost.advanced_features' => true]);
    $source = Campaign::firstOrFail();
    $importer = app(LocalSrdImporter::class);
    $user = auth()->user();
    $race = $importer->importRecord($source, $user, ['key' => 'srd5.1:race:Example', 'module' => 'race', 'kind' => 'Race', 'name' => 'Example', 'entry' => '<p>Rules.</p>', 'properties' => []]);
    $ability = $importer->importRecord($source, $user, ['key' => 'srd5.1:feature:Example', 'module' => 'ability', 'kind' => 'Feature', 'name' => 'Trait', 'entry' => '[entity:' . $race['entity_id'] . ']', 'properties' => []]);
    $originalAbility = Entity::findOrFail($ability['entity_id']);
    EntityAbility::create(['entity_id' => $race['entity_id'], 'ability_id' => $originalAbility->child->id, 'visibility_id' => 1]);
    $result = app(LocalCampaignCloneService::class)->copy($source, $user, 'Working world');
    $newRace = Entity::findOrFail($result['entities'][$race['entity_id']]);
    $newAbility = Entity::findOrFail($result['entities'][$ability['entity_id']]);

    expect($newRace->campaign_id)->toBe($result['campaign_id'])
        ->and($newRace->child->id)->not->toBe(Entity::findOrFail($race['entity_id'])->child->id)
        ->and($newRace->abilities->first()->ability_id)->toBe($newAbility->child->id)
        ->and($newAbility->entry)->toBe('[entity:' . $newRace->id . ']')
        ->and($originalAbility->fresh()->entry)->toBe('[entity:' . $race['entity_id'] . ']')
        ->and(Entity::where('campaign_id', $source->id)->count())->toBe(2);
});
