<?php

namespace App\Services;

use RuntimeException;

/** Offline lookup shared by manual import/export hooks for every rules category. */
class RulesTransferResolver
{
    public function name(string $name, string $category): string
    {
        $name = mb_strtolower(trim($name));
        $name = preg_replace('/\s*\(renovar\)\s*$/u', '', $name);
        $name = preg_replace('/[\s_–—-]+/u', ' ', $name);

        if ($category === 'race') {
            return app(RaceTransferResolver::class)->name($name);
        }

        return $name;
    }

    /**
     * Categories describe meaning, not the host's module: spell, feature, class,
     * race, equipment, magic-item, creature, plane, etc. Unknown categories must
     * be classified before matching. Feature names/aliases must include an owner.
     *
     * @param  array<string, mixed>  $source
     * @param  array<int, array<string, mixed>>  $destination
     * @return array<string, mixed>
     */
    public function resolve(array $source, array $destination, string $direction): array
    {
        if (! in_array($direction, ['import', 'export'], true)) {
            throw new RuntimeException('Direction must be import or export.');
        }
        foreach ([$source, ...$destination] as $row) {
            if (empty($row['category']) || empty($row['entity_id']) || empty($row['name'])) {
                throw new RuntimeException('Classify each resource and supply its entity_id and name.');
            }
        }
        $category = $source['category'];
        $names = array_map(fn ($n) => $this->name($n, $category), [$source['name'], ...($source['aliases'] ?? [])]);
        $matches = [];
        foreach ($destination as $row) {
            if (! empty($row['archived_at']) || ! empty($row['deleted_at']) || $row['category'] !== $category) {
                continue;
            }
            // Distinct owners, editions, variants and individual possessions never
            // collapse into a same-named rules template. Use an explicit reference.
            foreach (['owner_key', 'edition', 'variant_key', 'instance_key'] as $field) {
                if (($source[$field] ?? null) !== ($row[$field] ?? null)) {
                    continue 2;
                }
            }
            $sameKey = ! empty($source['srd_key']) && $source['srd_key'] === ($row['srd_key'] ?? null);
            $mapped = ! empty($source['destination_entity_id']) && (int) $source['destination_entity_id'] === (int) $row['entity_id'];
            $otherNames = array_map(fn ($n) => $this->name($n, $category), [$row['name'], ...($row['aliases'] ?? [])]);
            if ($sameKey || $mapped || array_intersect($names, $otherNames)) {
                $matches[] = ['row' => $row, 'rank' => $sameKey ? 0 : ($mapped ? 1 : 2)];
            }
        }
        $preferred = array_values(array_filter($matches, fn ($m) => $direction === 'import'
            ? ! empty($m['row']['srd_key']) : empty($m['row']['srd_key'])));
        $matches = $preferred ?: $matches;
        if ($matches) {
            $rank = min(array_column($matches, 'rank'));
            $matches = array_values(array_filter($matches, fn ($m) => $m['rank'] === $rank));
        }
        if (count($matches) > 1) {
            return ['action' => 'conflict', 'candidates' => array_column(array_column($matches, 'row'), 'entity_id')];
        }
        if ($matches) {
            return ['action' => 'reuse', 'entity_id' => $matches[0]['row']['entity_id'],
                'native_id' => $matches[0]['row']['native_id'] ?? null];
        }

        return ['action' => 'create', 'name' => $source['name'], 'category' => $category,
            'source_entity_id' => $source['entity_id'], 'srd_key' => $source['srd_key'] ?? null];
    }
}
