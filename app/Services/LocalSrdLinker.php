<?php

namespace App\Services;

use App\Models\Campaign;
use App\Models\Entity;
use App\Models\EntityAbility;
use App\Models\OrganisationMember;
use App\Models\Relation;
use RuntimeException;

class LocalSrdLinker
{
    /** @param array<string, mixed> $manifest
     * @return array<string, int>
     */
    public function link(Campaign $campaign, array $manifest): array
    {
        $entities = Entity::where('campaign_id', $campaign->id)->with(['attributes', 'entityType', 'child'])->get();
        $byKey = [];
        foreach ($entities as $entity) {
            $key = $entity->attributes->firstWhere('name', '_srd_key')?->value;
            if ($key) {
                $byKey[$key] = $entity;
            }
        }
        $counts = ['parents' => 0, 'attached_abilities' => 0, 'pantheon_members' => 0, 'references' => 0];
        foreach ($manifest['records'] as $record) {
            $entity = $byKey[$record['key']] ?? throw new RuntimeException('Missing imported source key');
            $links = $record['links'] ?? [];
            if (isset($links['parent_key'])) {
                $parent = $byKey[$links['parent_key']] ?? throw new RuntimeException('Missing parent source key');
                if ($entity->type_id === $parent->type_id) {
                    if ($entity->parent_id && $entity->parent_id !== $parent->id) {
                        throw new RuntimeException('Conflicting destination parent');
                    }
                    $entity->parent_id = $parent->id;
                    $entity->saveQuietly();
                    $counts['parents']++;
                } else {
                    $this->reference($campaign, $entity, $parent, 'Subclass of');
                    $counts['references']++;
                }
            }
            if (isset($links['owner_key'])) {
                $owner = $byKey[$links['owner_key']] ?? throw new RuntimeException('Missing feature owner');
                $this->ability($owner, $entity, 'SRD feature');
                $this->reference($campaign, $entity, $owner, 'Feature of');
                $counts['attached_abilities']++;
            }
            if (isset($links['pantheon_key'])) {
                $pantheon = $byKey[$links['pantheon_key']] ?? throw new RuntimeException('Missing pantheon');
                if (! $entity->child || ! $pantheon->child) {
                    throw new RuntimeException('Missing native deity or pantheon child');
                }
                OrganisationMember::firstOrCreate([
                    'character_id' => $entity->child->id,
                    'organisation_id' => $pantheon->child->id,
                ], ['role' => 'Deity', 'is_private' => false, 'status_id' => 0]);
                $counts['pantheon_members']++;
            }
            foreach ($links['related_keys'] ?? [] as $key) {
                $target = $byKey[$key] ?? throw new RuntimeException('Missing reference source key');
                $this->reference($campaign, $entity, $target, 'Source');
                $counts['references']++;
            }
        }
        foreach ($manifest['external_links'] ?? [] as $link) {
            $owner = $byKey[$link['owner_key']] ?? throw new RuntimeException('Missing external link owner');
            $target = $byKey[$link['target_key']] ?? throw new RuntimeException('Missing external link target');
            if ($link['kind'] === 'ability') {
                $this->ability($owner, $target, $link['label']);
                $counts['attached_abilities']++;
            } else {
                $this->reference($campaign, $owner, $target, $link['label']);
                $counts['references']++;
            }
        }
        foreach ($manifest['records'] as $record) {
            $entity = $byKey[$record['key']];
            if ($entity->type_id !== config('entities.ids.race') || ! isset($record['links']['parent_key'])) {
                continue;
            }
            $parent = $byKey[$record['links']['parent_key']];
            foreach ($parent->abilities()->get() as $inherited) {
                EntityAbility::firstOrCreate([
                    'entity_id' => $entity->id, 'ability_id' => $inherited->ability_id,
                ], ['visibility_id' => 1, 'charges' => 0, 'position' => 1, 'note' => 'Inherited racial trait']);
                $counts['attached_abilities']++;
            }
        }

        return $counts;
    }

    private function ability(Entity $owner, Entity $ability, string $note): void
    {
        if ($ability->type_id !== config('entities.ids.ability') || ! $ability->child) {
            throw new RuntimeException('A linked ability has no native Ability child');
        }
        EntityAbility::firstOrCreate([
            'entity_id' => $owner->id, 'ability_id' => $ability->child->id,
        ], ['visibility_id' => 1, 'charges' => 0, 'position' => 1, 'note' => $note]);
    }

    private function reference(Campaign $campaign, Entity $owner, Entity $target, string $label): void
    {
        Relation::firstOrCreate([
            'campaign_id' => $campaign->id, 'owner_id' => $owner->id,
            'target_id' => $target->id, 'relation' => $label,
        ], ['visibility_id' => 1, 'attitude' => 0, 'is_pinned' => false]);
    }
}
