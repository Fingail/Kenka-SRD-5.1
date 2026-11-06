<?php

use App\Models\Entity;
use App\Models\EntityAbility;
use App\Models\OrganisationMember;
use App\Models\Relation;

$app = require __DIR__ . '/bootstrap.php';
if (! $app->environment('local')) {
    throw new RuntimeException('Local only');
}
$manifest = json_decode(file_get_contents(storage_path('app/srd-remaining-batch.json')), true, 512, JSON_THROW_ON_ERROR);
$byKey = [];
$counts = [];
$failures = [];
$checked = 0;
foreach (Entity::where('campaign_id', 1)->where('source', 'local-srd')->with(['attributes', 'child'])->get() as $entity) {
    $byKey[$entity->attributes->firstWhere('name', '_srd_key')?->value] = $entity;
    $counts[$entity->type] = ($counts[$entity->type] ?? 0) + 1;
    if (! $entity->image_path && ! $entity->image_uuid) {
        $failures[] = 'Missing image: ' . $entity->name;
    }
}
$assert = function (bool $condition, string $label) use (&$failures, &$checked): void {
    $checked++;
    if (! $condition) {
        $failures[] = $label;
    }
};
$reference = function (Entity $owner, Entity $target, string $label): bool {
    return Relation::where('campaign_id', 1)->where('owner_id', $owner->id)->where('target_id', $target->id)->where('relation', $label)->exists();
};
foreach ($manifest['records'] as $record) {
    $entity = $byKey[$record['key']];
    $links = $record['links'] ?? [];
    if (isset($links['parent_key'])) {
        $parent = $byKey[$links['parent_key']];
        $assert($entity->type_id === $parent->type_id ? $entity->parent_id === $parent->id : $reference($entity, $parent, 'Subclass of'), 'Parent: ' . $entity->name);
        if ($entity->type_id === 9) {
            foreach ($parent->abilities as $ability) {
                $assert(EntityAbility::where('entity_id', $entity->id)->where('ability_id', $ability->ability_id)->exists(), 'Inherited feature: ' . $entity->name);
            }
        }
    }
    if (isset($links['owner_key'])) {
        $owner = $byKey[$links['owner_key']];
        $assert(EntityAbility::where('entity_id', $owner->id)->where('ability_id', $entity->child->id)->exists(), 'Feature: ' . $entity->name);
        $assert($reference($entity, $owner, 'Feature of'), 'Feature reference: ' . $entity->name);
    }
    if (isset($links['pantheon_key'])) {
        $pantheon = $byKey[$links['pantheon_key']];
        $assert(OrganisationMember::where('character_id', $entity->child->id)->where('organisation_id', $pantheon->child->id)->exists(), 'Pantheon: ' . $entity->name);
    }
    foreach ($links['related_keys'] ?? [] as $key) {
        $assert($reference($entity, $byKey[$key], 'Source'), 'Source reference: ' . $entity->name);
    }
}
foreach ($manifest['external_links'] as $link) {
    $owner = $byKey[$link['owner_key']];
    $target = $byKey[$link['target_key']];
    $valid = $link['kind'] === 'ability'
        ? EntityAbility::where('entity_id', $owner->id)->where('ability_id', $target->child->id)->exists()
        : $reference($owner, $target, $link['label']);
    $assert($valid, $link['label'] . ': ' . $owner->name);
}
ksort($counts);
echo json_encode(['srd_records' => count($byKey), 'by_kind' => $counts, 'relationship_checks' => $checked, 'failures' => $failures], JSON_PRETTY_PRINT) . PHP_EOL;
if ($failures) {
    exit(1);
}
