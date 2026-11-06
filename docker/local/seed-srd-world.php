<?php

use App\Facades\BookmarkCache;
use App\Facades\CampaignCache;
use App\Facades\CampaignLocalization;
use App\Facades\EntityCache;
use App\Facades\Mentions;
use App\Facades\Module;
use App\Models\Bookmark;
use App\Models\Campaign;
use App\Models\Entity;
use App\Models\EntityType;
use App\Services\Campaign\CreateService;
use App\Services\Entity\StandardEntityCreationService;
use App\Services\LocalOwner;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

$app = require __DIR__ . '/bootstrap.php';
if (! $app->environment('local') || ! config('selfhost.advanced_features')) {
    throw new RuntimeException('Local advanced deployment only');
}
$user = app(LocalOwner::class)->user();
Auth::login($user);
$campaign = Campaign::find(1);
if (! $campaign) {
    if (Campaign::count() || Entity::count()) {
        throw new RuntimeException('The SRD base requires a fresh database');
    }
    $campaign = app(CreateService::class)->user($user)->data([
        'name' => '5e Rules — SRD 5.1', 'locale' => 'en', 'visibility_id' => 1,
        'description' => '<p>2014 fifth-edition rules reference from the official SRD 5.1.</p>',
    ])->create();
}
if ($campaign->id !== 1 || $campaign->name !== '5e Rules — SRD 5.1' || ! $user->can('admin', $campaign)) {
    throw new RuntimeException('Unexpected campaign or owner');
}
CampaignCache::campaign($campaign)->user($user);
BookmarkCache::campaign($campaign);
CampaignLocalization::forceCampaign($campaign);
EntityCache::campaign($campaign);
Mentions::campaign($campaign);
Module::campaign($campaign);
Entity::disableSearchSyncing();
$types = [];
foreach (['Class' => 'Classes', 'Subclass' => 'Subclasses', 'Background' => 'Backgrounds', 'Condition' => 'Conditions', 'Rule' => 'Rules', 'Hazard' => 'Hazards', 'Disease' => 'Diseases', 'Language' => 'Languages'] as $singular => $plural) {
    $type = EntityType::where('campaign_id', 1)->where('code', Str::slug($singular))->first();
    if (! $type) {
        $type = new EntityType;
        $type->forceFill(['campaign_id' => 1, 'code' => Str::slug($singular), 'singular' => $singular, 'plural' => $plural,
            'icon' => 'ra ra-book', 'is_special' => true, 'is_enabled' => true])->save();
    }
    $types[$plural] = $type->id;
}
$licenseHtml = file_get_contents(base_path('data/srd5.1/attribution.html'));
$notes = [];
foreach (['SRD 5.1 — Source and License' => $licenseHtml, '5e Rules' => '<p>2014 fifth-edition rules reference.</p>'] as $name => $entry) {
    $entity = Entity::where('campaign_id', 1)->where('type_id', 6)->where('name', $name)->first();
    if (! $entity) {
        $entity = app(StandardEntityCreationService::class)->campaign($campaign)->entityType(EntityType::findOrFail(6))->user($user)
            ->create(['name' => $name, 'entry' => $entry, 'type' => 'Library', 'is_private' => false])->entity;
    }
    $notes[$name] = $entity;
}
if ($notes['SRD 5.1 — Source and License']->id !== 1 || $notes['5e Rules']->id !== 2) {
    throw new RuntimeException('The base manifests require license entity 1 and overview entity 2');
}
$links = [['Core Rules', $types['Rules'], ''], ['Races', 9, ''], ['Classes', $types['Classes'], ''], ['Subclasses', $types['Subclasses'], ''],
    ['Backgrounds', $types['Backgrounds'], ''], ['Feats', 16, 'type=Feat%21'], ['Features', 16, 'type=Feature'], ['Spells', 16, 'type=Spell'],
    ['Equipment', 5, ''], ['Magic Items', 5, 'type=Magic+item'], ['Creatures', 20, ''], ['Conditions', $types['Conditions'], ''],
    ['Hazards', $types['Hazards'], ''], ['Diseases', $types['Diseases'], ''], ['Languages', $types['Languages'], ''],
    ['Planes', 3, 'type=Plane'], ['Pantheons', 4, 'type=Pantheon'], ['Deities', 1, 'type=Deity']];
$specs = array_merge([['Rules Overview', null, '', 2]], array_map(fn ($row) => [...$row, null], $links), [['Source and License', null, '', 1]]);
foreach ($specs as $position => [$name, $type, $filter, $target]) {
    Bookmark::firstOrCreate(['campaign_id' => 1, 'name' => $name], [
        'entity_type_id' => $type, 'entity_id' => $target, 'filters' => $filter ?: null, 'position' => $position + 1,
        'icon' => 'ra ra-book', 'parent' => 'bookmarks', 'is_active' => true, 'is_private' => false,
    ]);
}
$overview = '<p>2014 fifth-edition rules reference.</p><ul>';
foreach ($links as [$name, $type, $filter]) {
    $href = config('app.url') . '/w/1/t/' . $type . ($filter ? '?' . $filter : '');
    $overview .= '<li><a href="' . htmlspecialchars($href, ENT_QUOTES) . '">' . $name . '</a></li>';
}
$overview .= '</ul><p>[entity:1|Source and license]</p>';
$notes['5e Rules']->entry = $overview;
$notes['5e Rules']->saveQuietly();
$ui = $campaign->ui_settings ?? [];
$ui['sidebar']['labels']['bookmarks'] = '5e Rules';
$ui['sidebar']['icons']['bookmarks'] = 'ra ra-book';
$campaign->ui_settings = $ui;
$campaign->saveQuietly();
CampaignCache::campaign($campaign)->clear();
echo "Local SRD campaign, modules, attribution and 20 sidebar links ready.\n";
