<?php

namespace App\Services;

use RuntimeException;

/** Shared race lookup for manual Codex import/export hooks; performs no API writes. */
class RaceTransferResolver
{
    public function name(string $name): string
    {
        $name = mb_strtolower(trim($name));
        $name = preg_replace('/\s*\(renovar\)\s*$/u', '', $name);
        $name = preg_replace('/[\s_–—-]+/u', ' ', $name);

        return ['elves' => 'elf', 'dwarves' => 'dwarf', 'gnomes' => 'gnome',
            'halflings' => 'halfling', 'goliaths' => 'goliath'][$name] ?? $name;
    }

    /**
     * Rows use global entity_id and native race_id separately. Destination must be
     * a complete, permission-readable race inventory for one campaign.
     *
     * @param  array<string, mixed>  $source
     * @param  array<int, array<string, mixed>>  $destination
     * @return array<string, mixed>
     */
    public function resolve(array $source, array $destination, string $direction): array
    {
        if (! in_array($direction, ['import', 'export'], true)) {
            throw new RuntimeException('Race direction must be import or export.');
        }
        $names = array_map($this->name(...), [$source['name'], ...($source['aliases'] ?? [])]);
        $matches = [];
        foreach ($destination as $row) {
            if (! empty($row['archived_at'])) {
                continue;
            }
            $sameKey = ! empty($source['srd_key']) && ($source['srd_key'] === ($row['srd_key'] ?? null));
            $otherNames = array_map($this->name(...), [$row['name'], ...($row['aliases'] ?? [])]);
            if ($sameKey || array_intersect($names, $otherNames)) {
                $matches[] = $row;
            }
        }
        // On download, prefer the installed rules race to any campaign duplicate.
        // On upload, prefer the existing campaign race to a parallel rules entry.
        $preferred = array_values(array_filter($matches, fn ($r) => $direction === 'import'
            ? ! empty($r['srd_key']) : empty($r['srd_key'])));
        $matches = $preferred ?: $matches;
        if (count($matches) > 1) {
            return ['action' => 'conflict', 'candidates' => array_column($matches, 'entity_id')];
        }
        if ($matches) {
            $match = $matches[0];
            if (empty($match['entity_id']) || empty($match['race_id'])) {
                throw new RuntimeException('Matched race requires both entity_id and native race_id.');
            }

            return ['action' => 'reuse', 'entity_id' => $match['entity_id'], 'race_id' => $match['race_id']];
        }

        // No base-race fallback: Drow, Wood Elf and variant Human keep their identity.
        return ['action' => 'create', 'name' => $source['name'], 'source_entity_id' => $source['entity_id'],
            'source_race_id' => $source['race_id'], 'srd_key' => $source['srd_key'] ?? null];
    }
}
