<?php

namespace App\Services;

use App\Facades\BookmarkCache;
use App\Facades\CampaignCache;
use App\Facades\CampaignLocalization;
use App\Facades\EntityCache;
use App\Facades\Mentions;
use App\Facades\Module;
use App\Models\Attribute;
use App\Models\Bookmark;
use App\Models\Campaign;
use App\Models\Entity;
use App\Models\EntityAbility;
use App\Models\EntityTag;
use App\Models\EntityType;
use App\Models\OrganisationMember;
use App\Models\Relation;
use App\Models\User;
use App\Services\Campaign\CreateService;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class LocalCampaignCloneService
{
    /** Clone the clean local rules library without changing its entities or IDs.
     * @return array<string, mixed>
     */
    public function copy(Campaign $source, User $user, string $name): array
    {
        if (! config('selfhost.advanced_features') || ! $user->can('admin', $source)) {
            throw new RuntimeException('An advanced local campaign administrator is required.');
        }
        Entity::disableSearchSyncing();
        try {
            return DB::transaction(function () use ($source, $user, $name): array {
                $destination = app(CreateService::class)->user($user)->data([
                    'name' => $name, 'locale' => $source->locale, 'visibility_id' => 1,
                    'description' => '<p>A local campaign with an independent copy of the SRD 5.1 reference library.</p>',
                ])->create();
                $types = [];
                foreach (EntityType::where('campaign_id', $source->id)->get() as $type) {
                    $copy = $type->replicate();
                    $copy->campaign_id = $destination->id;
                    $copy->saveQuietly();
                    $types[$type->id] = $copy->id;
                }
                CampaignCache::campaign($destination)->user($user);
                CampaignLocalization::forceCampaign($destination);
                EntityCache::campaign($destination);
                BookmarkCache::campaign($destination);
                Mentions::campaign($destination);
                Module::campaign($destination);
                $mapping = [];
                $children = [];
                $originals = Entity::where('campaign_id', $source->id)->with('child')->get();
                foreach ($originals as $entity) {
                    $copy = $entity->replicate(['id', 'entity_id', 'child_type', 'parent_id']);
                    $copy->setRelations([]);
                    $copy->campaign_id = $destination->id;
                    $copy->type_id = $types[$entity->type_id] ?? $entity->type_id;
                    $copy->created_by = $user->id;
                    $copy->updated_by = $user->id;
                    $copy->saveQuietly();
                    if ($entity->child) {
                        $child = $entity->child->replicate();
                        $child->setRelations([]);
                        $child->campaign_id = $destination->id;
                        $child->saveQuietly();
                        $copy->child()->associate($child);
                        $copy->saveQuietly();
                        $children[$child->getTable()][$entity->child->id] = $child->id;
                    }
                    $mapping[$entity->id] = $copy->id;
                }
                $rewrite = function (?string $value) use ($mapping, $types, $source, $destination): ?string {
                    if ($value === null) {
                        return null;
                    }
                    $value = preg_replace_callback('/\[([a-z_]+):(\d+)(\|[^\]]*)?\]/i', function ($match) use ($mapping) {
                        $id = $mapping[(int) $match[2]] ?? null;

                        return $id ? '[' . $match[1] . ':' . $id . ($match[3] ?? '') . ']' : $match[0];
                    }, $value);
                    $value = preg_replace_callback('~/w/' . $source->id . '/entities/(\d+)~', fn ($match) => isset($mapping[(int) $match[1]]) ? '/w/' . $destination->id . '/entities/' . $mapping[(int) $match[1]] : $match[0], $value);

                    return preg_replace_callback('~/w/' . $source->id . '/t/(\d+)~', fn ($match) => '/w/' . $destination->id . '/t/' . ($types[(int) $match[1]] ?? $match[1]), $value);
                };
                foreach ($originals as $entity) {
                    $copy = Entity::findOrFail($mapping[$entity->id]);
                    $copy->parent_id = $entity->parent_id ? ($mapping[$entity->parent_id] ?? null) : null;
                    $copy->entry = $rewrite($entity->entry);
                    $copy->tooltip = $rewrite($entity->tooltip);
                    $copy->saveQuietly();
                    foreach ($entity->attributes as $attribute) {
                        $new = $attribute->replicate();
                        $new->entity_id = $copy->id;
                        $new->value = $rewrite($attribute->value);
                        $new->saveQuietly();
                    }
                    foreach ($entity->posts as $post) {
                        $new = $post->replicate();
                        $new->entity_id = $copy->id;
                        $new->entry = $rewrite($post->entry);
                        $new->created_by = $user->id;
                        $new->saveQuietly();
                    }
                    app(EntityMappingService::class)->silent()->with($copy)->map();
                }
                foreach (EntityTag::whereIn('entity_id', array_keys($mapping))->get() as $tag) {
                    if (isset($children['tags'][$tag->tag_id])) {
                        EntityTag::create(['entity_id' => $mapping[$tag->entity_id], 'tag_id' => $children['tags'][$tag->tag_id]]);
                    }
                }
                foreach (EntityAbility::whereIn('entity_id', array_keys($mapping))->get() as $ability) {
                    $copy = $ability->replicate();
                    $copy->entity_id = $mapping[$ability->entity_id];
                    $copy->ability_id = $children['abilities'][$ability->ability_id] ?? throw new RuntimeException('An ability lies outside the source campaign.');
                    $copy->saveQuietly();
                }
                foreach (Relation::where('campaign_id', $source->id)->get() as $relation) {
                    $copy = $relation->replicate();
                    $copy->campaign_id = $destination->id;
                    $copy->owner_id = $mapping[$relation->owner_id] ?? throw new RuntimeException('An owner lies outside the source campaign.');
                    $copy->target_id = $mapping[$relation->target_id] ?? throw new RuntimeException('A target lies outside the source campaign.');
                    $copy->saveQuietly();
                }
                foreach (OrganisationMember::whereIn('character_id', array_keys($children['characters'] ?? []))->get() as $member) {
                    $copy = $member->replicate(['parent_id']);
                    $copy->character_id = $children['characters'][$member->character_id];
                    $copy->organisation_id = $children['organisations'][$member->organisation_id] ?? throw new RuntimeException('An organisation lies outside the source campaign.');
                    $copy->saveQuietly();
                }
                foreach (Bookmark::where('campaign_id', $source->id)->get() as $bookmark) {
                    $copy = $bookmark->replicate();
                    $copy->campaign_id = $destination->id;
                    $copy->entity_id = $bookmark->entity_id ? ($mapping[$bookmark->entity_id] ?? null) : null;
                    $copy->entity_type_id = $types[$bookmark->entity_type_id] ?? $bookmark->entity_type_id;
                    $copy->saveQuietly();
                }
                $destination->ui_settings = $source->ui_settings;
                $destination->settings = $source->settings;
                $destination->saveQuietly();
                CampaignCache::campaign($destination)->clear();

                return ['campaign_id' => $destination->id, 'entities' => $mapping, 'children' => $children, 'types' => $types,
                    'attributes' => Attribute::whereIn('entity_id', array_values($mapping))->count()];
            });
        } finally {
            Entity::enableSearchSyncing();
        }
    }
}
