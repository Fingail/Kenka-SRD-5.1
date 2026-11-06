<?php

use App\Facades\CampaignCache;
use App\Facades\CampaignLocalization;
use App\Facades\EntityCache;
use App\Facades\Module;
use App\Models\Campaign;
use App\Models\Entity;
use App\Models\EntityType;
use App\Models\Tag;
use App\Services\Entity\StandardEntityCreationService;
use App\Services\LocalOwner;
use Illuminate\Support\Facades\Auth;

$app = require __DIR__ . '/bootstrap.php';
if (! $app->environment('local')) {
    throw new RuntimeException('Local use only');
}
$campaign = Campaign::findOrFail(1);
$user = app(LocalOwner::class)->user();
Auth::login($user);
CampaignCache::campaign($campaign)->user($user);
CampaignLocalization::forceCampaign($campaign);
EntityCache::campaign($campaign);
Module::campaign($campaign);
Entity::disableSearchSyncing();
$groups = [];
foreach (['Common objects', 'Unique objects'] as $name) {
    $tag = Tag::where('campaign_id', 1)->whereHas('entity', fn ($query) => $query->where('name', $name))->first();
    if (! $tag) {
        $tag = app(StandardEntityCreationService::class)->campaign($campaign)->entityType(EntityType::findOrFail(12))->user($user)
            ->create(['name' => $name, 'is_private' => false]);
        $tag->entity->forceFill(['type' => 'Object group'])->saveQuietly();
    }
    $groups[$name] = $tag->id;
}
$counts = array_fill_keys(array_keys($groups), 0);
foreach (Entity::where('campaign_id', 1)->where('type_id', 5)->where('source', 'local-srd')->get() as $entity) {
    $group = $entity->attributes()->where('name', 'Object group')->value('value');
    if (! isset($groups[$group])) {
        throw new RuntimeException('Missing object group: ' . $entity->name);
    }
    $entity->tags()->syncWithoutDetaching([$groups[$group]]);
    $counts[$group]++;
}
CampaignCache::campaign($campaign)->clear();
echo json_encode($counts, JSON_PRETTY_PRINT) . PHP_EOL;
