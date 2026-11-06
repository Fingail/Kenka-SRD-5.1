<?php

use App\Facades\Avatar;
use App\Facades\CampaignCache;
use App\Facades\CampaignLocalization;
use App\Facades\EntityCache;
use App\Facades\Module;
use App\Models\Bookmark;
use App\Models\Campaign;
use App\Models\Entity;
use App\Models\EntityType;
use App\Models\Tag;
use App\Services\Entity\StandardEntityCreationService;
use App\Services\LocalOwner;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

$app = require __DIR__ . '/bootstrap.php';
if (! $app->environment('local') || ! config('selfhost.advanced_features')) {
    throw new RuntimeException('Local advanced campaign only');
}
$campaign = Campaign::findOrFail(1);
if ($campaign->name !== '5e Rules — SRD 5.1') {
    throw new RuntimeException('Unexpected campaign');
}
$user = app(LocalOwner::class)->user();
Auth::login($user);
CampaignCache::campaign($campaign)->user($user);
CampaignLocalization::forceCampaign($campaign);
EntityCache::campaign($campaign);
Module::campaign($campaign);
Entity::disableSearchSyncing();
$plan = json_decode(file_get_contents(storage_path('app/srd-icons-plan.json')), true, 512, JSON_THROW_ON_ERROR);
$disk = Storage::disk('s3');
$font = base_path('node_modules/rpg-awesome/fonts/rpgawesome-webfont.ttf');
$paths = [];
foreach ($plan['glyphs'] as $icon => $hex) {
    $canvas = imagecreatetruecolor(256, 256);
    $hue = hexdec(substr(hash('sha256', $icon), 0, 2));
    imagefill($canvas, 0, 0, imagecolorallocate($canvas, 30 + $hue % 28, 44 + $hue % 32, 59 + $hue % 38));
    $glyph = mb_chr(hexdec($hex));
    $size = 132;
    $box = imagettfbbox($size, 0, $font, $glyph);
    if (! $box) {
        throw new RuntimeException('Invalid glyph');
    }
    $left = min($box[0], $box[2], $box[4], $box[6]);
    $right = max($box[0], $box[2], $box[4], $box[6]);
    $top = min($box[1], $box[3], $box[5], $box[7]);
    $bottom = max($box[1], $box[3], $box[5], $box[7]);
    imagettftext($canvas, $size, 0, (int) ((256 - $right + $left) / 2 - $left), (int) ((256 - $bottom + $top) / 2 - $top), imagecolorallocate($canvas, 244, 231, 202), $font, $glyph);
    ob_start();
    imagepng($canvas);
    $bytes = ob_get_clean();
    $path = 'campaigns/1/srd-icons/' . $icon . '.png';
    $disk->put($path, $bytes, 'public');
    if (hash('sha256', $disk->get($path)) !== hash('sha256', $bytes)) {
        throw new RuntimeException('Stored icon differs');
    }
    $paths[$icon] = $path;
}
$tagType = EntityType::findOrFail(12);
$groupTags = [];
$makeTag = function (string $name, string $icon, ?Entity $parent = null) use ($campaign, $user, $tagType, $paths): Tag {
    $query = Tag::where('campaign_id', 1)->whereHas('entity', function ($query) use ($name, $parent) {
        $query->where('name', $name)->where('type', 'SRD browsing group');
        $parent ? $query->where('parent_id', $parent->id) : $query->whereNull('parent_id');
    });
    $tag = $query->first();
    if (! $tag) {
        $tag = app(StandardEntityCreationService::class)->campaign($campaign)->entityType($tagType)->user($user)
            ->create(['name' => $name, 'is_private' => false]);
        $tag->entity->forceFill(['type' => 'SRD browsing group', 'parent_id' => $parent?->id])->saveQuietly();
    }
    $tag->forceFill(['icon' => 'ra ra-' . $icon])->saveQuietly();
    $tag->entity->forceFill(['image_path' => $paths[$icon]])->saveQuietly();

    return $tag;
};
foreach (['Creature types', 'Equipment families', 'Spell schools'] as $root) {
    $groupTags[$root] = $makeTag($root, 'book');
}
foreach ($plan['groups'] as $key => $group) {
    $groupTags[$key] = $makeTag($group['name'], $group['icon'], $groupTags[$group['parent']]->entity);
}
$byKey = [];
foreach (Entity::where('campaign_id', 1)->where('source', 'local-srd')->with(['attributes', 'image'])->get() as $entity) {
    $byKey[$entity->attributes->firstWhere('name', '_srd_key')?->value] = $entity;
}
$assigned = 0;
$preserved = 0;
$groupCounts = [];
$sampleUrls = [];
foreach ($plan['records'] as $record) {
    $entity = $byKey[$record['key']] ?? throw new RuntimeException('Missing icon target');
    if (! $entity->image && (! $entity->image_path || str_starts_with($entity->image_path, 'campaigns/1/srd-icons/'))) {
        $entity->image_path = $paths[$record['icon']];
        $entity->saveQuietly();
        $assigned++;
    } else {
        $preserved++;
    }
    if ($record['group']) {
        $entity->tags()->syncWithoutDetaching([$groupTags[$record['group']]->id]);
        $groupCounts[$record['group']] = ($groupCounts[$record['group']] ?? 0) + 1;
    }
    if (in_array($entity->name, ['Aboleth', 'Adult Red Dragon', 'Dwarf', 'Wizard', 'Grappler', 'Acolyte', 'Dagger', 'Fireball'])) {
        $sampleUrls[$entity->name] = ['entity' => $entity->id, 'thumbnail' => Avatar::entity($entity)->size(256)->thumbnail()];
    }
}
foreach (EntityType::where('campaign_id', 1)->get() as $type) {
    if (isset($plan['kind_icons'][$type->singular])) {
        $type->icon = 'ra ra-' . $plan['kind_icons'][$type->singular];
        $type->saveQuietly();
    }
}
foreach (Bookmark::where('campaign_id', 1)->get() as $bookmark) {
    if ($bookmark->name === 'Feats') {
        $bookmark->filters = 'type=Feat%21';
    }
    if (isset($plan['bookmark_icons'][$bookmark->name])) {
        $bookmark->icon = 'ra ra-' . $plan['bookmark_icons'][$bookmark->name];
        $bookmark->saveQuietly();
    }
}
$overview = Entity::where('campaign_id', 1)->findOrFail(2);
$overview->entry = str_replace('?type=Feat"', '?type=Feat%21"', $overview->entry);
$overview->saveQuietly();
$license = Entity::where('campaign_id', 1)->findOrFail(1);
if (! str_contains($license->entry, 'RPG Awesome')) {
    $license->entry .= '<h3>Generic icons</h3><p>RPG Awesome by Daniela Howe and contributors. '
        . '<a href="https://github.com/nagoshiashumari/Rpg-Awesome">Source</a>. '
        . 'Font: <a href="https://openfontlicense.org/open-font-license-official-text/">SIL Open Font License 1.1</a>; CSS: MIT, as stated in the bundled README. '
        . 'Copyright and bundled license notices are retained in data/licenses. '
        . 'Shared group icons indicate categories; they are not individual creature portraits.</p>';
    $license->saveQuietly();
}
CampaignCache::campaign($campaign)->clear();
echo json_encode([
    'pack' => $plan['pack'], 'shared_icons' => count($paths), 'assigned' => $assigned, 'existing_artwork_preserved' => $preserved,
    'groups' => $groupCounts, 'group_tags' => count($groupTags), 'samples' => $sampleUrls,
    'source_records' => count($byKey), 'campaign_entities' => Entity::where('campaign_id', 1)->count(),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
