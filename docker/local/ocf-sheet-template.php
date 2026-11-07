<?php

use App\Enums\AttributeType;
use App\Http\Resources\AttributeResource;
use App\Models\Attribute;
use App\Models\Entity;
use App\Models\Inventory;
use App\Services\LocalOwner;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

require __DIR__ . '/bootstrap.php';

// This is an explicit local authoring helper, not the read-only runtime handler.
$entityId = filter_var($argv[1] ?? '', FILTER_VALIDATE_INT);
if (! $entityId) {
    throw new RuntimeException('Usage: sail php docker/local/ocf-sheet-template.php ENTITY_ID [--actions-file=PATH] [--apply]');
}
$apply = in_array('--apply', $argv, true);
$actionsFile = null;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--actions-file=')) {
        $actionsFile = substr($arg, strlen('--actions-file='));
    }
}

$entity = Entity::with('attributes')->findOrFail($entityId);
if ($entity->campaign_id === 1 || ! in_array($entity->entityType->code, ['character', 'creature'], true)) {
    throw new RuntimeException('Select a character or creature outside the clean SRD campaign.');
}
$name = 'OCF Combat Sheet v1';
$key = 'ocf_combat_v1';
$existing = $entity->attributes->filter(fn (Attribute $attribute) => $attribute->name === $name || $attribute->api_key === $key);
if ($existing->count() > 1) {
    throw new RuntimeException('Ambiguous OCF sheet attributes; resolve duplicates before generating.');
}
$source = $entity->attributes->reject(fn (Attribute $attribute) => $attribute->name === $name || $attribute->api_key === $key);
$number = function (array $aliases) use ($source): ?int {
    $matches = $source->filter(fn (Attribute $attribute) => in_array(mb_strtolower($attribute->name), array_map('mb_strtolower', $aliases), true));
    if ($matches->count() > 1) {
        throw new RuntimeException('Ambiguous source field: ' . $aliases[0]);
    }
    $value = $matches->first()?->value;
    if ($value === null || $value === '') {
        return null;
    }
    if (! preg_match('/^\s*([+-]?\d+)/', $value, $match)) {
        throw new RuntimeException('Non-numeric source field: ' . $aliases[0]);
    }

    return (int) $match[1];
};
$sheet = json_decode(file_get_contents(base_path('data/ocf/combat-sheet.v1.template.json')), true, 512, JSON_THROW_ON_ERROR);
$sheet['source'] = ['campaign_id' => $entity->campaign_id, 'entity_id' => $entity->id];
foreach ([
    'ac' => ['Armor class', 'armor_class'],
    'hp_max' => ['HP maximum', 'hit_points'],
    'initiative' => ['Initiative'],
    'speed_ft' => ['Speed'],
    'proficiency_bonus' => ['Proficiency bonus'],
] as $field => $aliases) {
    $sheet['stats'][$field] = $number($aliases);
}
foreach (['str' => 'Strength', 'dex' => 'Dexterity', 'con' => 'Constitution', 'int' => 'Intelligence', 'wis' => 'Wisdom', 'cha' => 'Charisma'] as $field => $label) {
    $sheet['stats']['abilities'][$field] = $number([$label, strtoupper($field)]);
}
if ($sheet['stats']['initiative'] === null && $entity->entityType->code === 'creature') {
    $sheet['stats']['initiative'] = $number(['DEX modifier']);
}
$speed = $source->first(fn (Attribute $attribute) => mb_strtolower($attribute->name) === 'speed')?->value;
if ($speed && preg_match('/climb\s+(\d+)\s*ft/i', $speed, $match)) {
    $sheet['stats']['climb_speed_ft'] = (int) $match[1];
}
if ($actionsFile) {
    $fixture = json_decode(file_get_contents($actionsFile), true, 512, JSON_THROW_ON_ERROR);
    if (($fixture['source']['entity_id'] ?? null) !== $entity->id || ($fixture['source']['campaign_id'] ?? null) !== $entity->campaign_id) {
        throw new RuntimeException('The action fixture belongs to another source entity.');
    }
    foreach ($fixture['actions'] ?? [] as $action) {
        if (! isset($action['attack_bonus'], $action['damage_roll'], $action['damage_type'])) {
            continue;
        }
        $attack = [
            'id' => $action['key'],
            'name' => $action['name'],
            'attack_bonus' => $action['attack_bonus'],
            'damage' => $action['damage_roll'],
            'damage_type' => $action['damage_type'],
        ];
        if (isset($action['inventory_entry_id'])) {
            $inventory = Inventory::where('entity_id', $entity->id)->findOrFail($action['inventory_entry_id']);
            $attack['inventory_entry_id'] = $inventory->id;
            $attack['is_equipped'] = (bool) $inventory->is_equipped;
            $attack['selected_for_basic_test'] = (bool) ($action['test_selection_override'] ?? false);
        }
        $sheet['attacks'][] = $attack;
    }
}
$json = json_encode($sheet, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
$directory = storage_path('app/ocf-authoring/' . $entity->id);
if (! is_dir($directory)) {
    mkdir($directory, 0700, true);
}
file_put_contents($directory . '/generated-sheet.json', $json . PHP_EOL);
$attribute = $existing->first();
if ($attribute && json_decode($attribute->value, true, 512, JSON_THROW_ON_ERROR) !== $sheet) {
    throw new RuntimeException('An authored sheet already exists. Preview generated-sheet.json; existing GM edits will not be overwritten.');
}
if ($apply && ! $attribute) {
    $user = app(LocalOwner::class)->user();
    Auth::login($user);
    file_put_contents($directory . '/before.json', json_encode($source->values()->map->getAttributes(), JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
    DB::transaction(function () use ($entity, $source, $name, $key, $json, &$attribute): void {
        Entity::whereKey($entity->id)->lockForUpdate()->firstOrFail();
        if (Attribute::where('entity_id', $entity->id)->where(fn ($query) => $query->where('name', $name)->orWhere('api_key', $key))->exists()) {
            throw new RuntimeException('The OCF attribute was created concurrently; reload before retrying.');
        }
        $attribute = Attribute::create([
            'entity_id' => $entity->id,
            'name' => $name,
            'api_key' => $key,
            'value' => $json,
            'type_id' => AttributeType::Block,
            'default_order' => ((int) $source->max('default_order')) + 1,
            'is_private' => false,
            'is_hidden' => false,
            'is_pinned' => false,
        ]);
    });
}
if ($attribute) {
    $resource = (new AttributeResource($attribute->fresh()))->resolve();
    if (json_decode($resource['value'], true, 512, JSON_THROW_ON_ERROR) !== $sheet || $resource['api_key'] !== $key) {
        throw new RuntimeException('The API resource did not preserve the generated sheet.');
    }
}
echo json_encode([
    'mode' => $apply ? 'applied-or-already-present' : 'preview',
    'entity_id' => $entity->id,
    'attribute_id' => $attribute?->id,
    'name' => $name,
    'api_key' => $key,
    'generated_file' => $directory . '/generated-sheet.json',
    'stats' => $sheet['stats'],
    'attack_count' => count($sheet['attacks']),
], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . PHP_EOL;
