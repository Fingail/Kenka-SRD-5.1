<?php

namespace App\Services;

use App\Enums\AttributeType;
use App\Models\Attribute;
use App\Models\Campaign;
use App\Models\Entity;
use App\Models\EntityType;
use App\Models\User;
use App\Services\Entity\StandardEntityCreationService;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class LocalSrdImporter
{
    /** @param array<string, mixed> $record
     * @return array{entity_id: int, action: string}
     */
    public function importRecord(Campaign $campaign, User $user, array $record): array
    {
        $type = EntityType::query()->where(function ($query) use ($campaign): void {
            $query->whereNull('campaign_id')->orWhere('campaign_id', $campaign->id);
        })->where(function ($query) use ($record): void {
            $query->where('code', $record['module'])->orWhere('plural', $record['module']);
        })->firstOrFail();

        $hash = hash('sha256', json_encode($record, JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($campaign, $user, $record, $type, $hash): array {
            $matches = Entity::query()->where('campaign_id', $campaign->id)
                ->whereHas('attributes', function ($query) use ($record): void {
                    $query->where('name', '_srd_key')->where('value', $record['key']);
                })->get();
            if ($matches->count() > 1) {
                throw new RuntimeException('Duplicate source key: ' . $record['key']);
            }
            if ($existing = $matches->first()) {
                $stored = $existing->attributes()->where('name', '_srd_hash')->value('value');
                if ($stored !== $hash || $existing->entry !== $record['entry'] || $existing->name !== $record['name'] || $existing->type_id !== $type->id) {
                    throw new RuntimeException('Changed source or edited destination: ' . $record['key']);
                }

                return ['entity_id' => $existing->id, 'action' => 'unchanged'];
            }

            if ($type->isStandard()) {
                $entity = app(StandardEntityCreationService::class)
                    ->campaign($campaign)->entityType($type)->user($user)
                    ->create(['name' => $record['name'], 'is_private' => false])->entity;
            } else {
                $entity = new Entity;
                $entity->campaign_id = $campaign->id;
                $entity->type_id = $type->id;
                $entity->name = $record['name'];
                $entity->created_by = $user->id;
                $entity->is_private = false;
            }
            $entity->type = $record['kind'];
            $entity->entry = $record['entry'];
            $entity->source = 'local-srd';
            $entity->updated_by = $user->id;
            $entity->saveQuietly();

            $properties = ['_srd_key' => $record['key'], '_srd_hash' => $hash] + $record['properties'];
            $rows = [];
            $order = 1;
            foreach ($properties as $name => $value) {
                if ($value === null || $value === '') {
                    continue;
                }
                $valueType = is_bool($value) ? AttributeType::Checkbox : (is_numeric($value) ? AttributeType::Number : AttributeType::Standard);
                $rows[] = [
                    'entity_id' => $entity->id, 'name' => $name,
                    'value' => is_array($value) ? json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) : (is_bool($value) ? ($value ? '1' : '0') : (string) $value),
                    'type_id' => $valueType->value, 'default_order' => $order++,
                    'is_private' => false, 'is_pinned' => false,
                    'is_hidden' => str_starts_with($name, '_srd_'),
                    'created_at' => now(), 'updated_at' => now(),
                ];
            }
            Attribute::query()->insert($rows);
            app(EntityMappingService::class)->silent()->with($entity)->map();

            return ['entity_id' => $entity->id, 'action' => 'created'];
        });
    }
}
