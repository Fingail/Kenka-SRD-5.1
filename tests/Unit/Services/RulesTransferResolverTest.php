<?php

use App\Services\RulesTransferResolver;

function rulesRow(int $id, string $name, string $category, array $extra = []): array
{
    return $extra + ['entity_id' => $id, 'native_id' => $id + 100, 'name' => $name, 'category' => $category];
}

it('uses the rules library on import and campaign resources on export across categories', function () {
    $resolver = new RulesTransferResolver;
    foreach (['class', 'subclass', 'background', 'feat', 'feature', 'equipment', 'magic-item', 'creature', 'condition', 'hazard', 'disease', 'language', 'plane', 'pantheon', 'deity', 'spell', 'rule'] as $category) {
        $rules = rulesRow(1, 'Example', $category, ['srd_key' => 'srd5.1:' . $category . ':Example']);
        $campaign = rulesRow(2, 'Example', $category);
        expect($resolver->resolve($campaign, [$campaign, $rules], 'import')['entity_id'])->toBe(1)
            ->and($resolver->resolve($rules, [$campaign, $rules], 'export')['entity_id'])->toBe(2);
    }
});

it('separates spells senses editions owners and unique possessions', function () {
    $resolver = new RulesTransferResolver;
    expect($resolver->resolve(rulesRow(1, 'Darkvision', 'sense'), [rulesRow(2, 'Darkvision', 'spell')], 'import')['action'])->toBe('create');
    foreach (['edition', 'owner_key', 'variant_key', 'instance_key'] as $field) {
        expect($resolver->resolve(rulesRow(1, 'Example', 'feature', [$field => 'different']), [rulesRow(2, 'Example', 'feature')], 'import')['action'])->toBe('create');
    }
});

it('uses stable identity before names and refuses ambiguous names', function () {
    $resolver = new RulesTransferResolver;
    $source = rulesRow(1, 'Example', 'feat', ['srd_key' => 'srd5.1:feat:Example']);
    $rows = [rulesRow(2, 'Example', 'feat', ['srd_key' => 'other']), rulesRow(3, 'Renamed', 'feat', ['srd_key' => $source['srd_key']])];
    expect($resolver->resolve($source, $rows, 'import')['entity_id'])->toBe(3)
        ->and($resolver->resolve(rulesRow(1, 'Example', 'feat'), [rulesRow(2, 'Example', 'feat'), rulesRow(3, 'Example', 'feat')], 'import')['action'])->toBe('conflict');
});

it('allows custom modules without native IDs and skips deleted records', function () {
    $resolver = new RulesTransferResolver;
    $source = rulesRow(1, 'Ranger', 'class');
    $target = rulesRow(2, 'Ranger', 'class', ['native_id' => null]);
    expect($resolver->resolve($source, [$target], 'import'))->toBe(['action' => 'reuse', 'entity_id' => 2, 'native_id' => null]);
    $target['deleted_at'] = '2026-11-06';
    expect($resolver->resolve($source, [$target], 'import')['action'])->toBe('create');
});
