<?php

use App\Models\Campaign;
use App\Models\Entity;
use App\Services\LocalCampaignCloneService;
use App\Services\LocalOwner;
use Illuminate\Support\Facades\Auth;

$app = require __DIR__ . '/bootstrap.php';
$name = trim($argv[1] ?? '');
if ($name === '') {
    throw new RuntimeException('Usage: vendor/bin/sail php docker/local/copy-srd.php "World name"');
}
$source = Campaign::findOrFail(1);
if ($source->name !== '5e Rules — SRD 5.1' || Campaign::where('name', $name)->exists()) {
    throw new RuntimeException('A clean SRD base and a new campaign name are required.');
}
$user = app(LocalOwner::class)->user();
Auth::login($user);
$before = hash('sha256', Entity::where('campaign_id', 1)->orderBy('id')->get()->toJson());
$result = app(LocalCampaignCloneService::class)->copy($source, $user, $name);
$after = hash('sha256', Entity::where('campaign_id', 1)->orderBy('id')->get()->toJson());
if ($before !== $after) {
    throw new RuntimeException('The source campaign changed during copying.');
}
$directory = storage_path('app/campaign-copies');
if (! is_dir($directory)) {
    mkdir($directory, 0700, true);
}
$result['clean_source_hash'] = $before;
$result['clean_source_campaign'] = 1;
$file = $directory . '/' . $result['campaign_id'] . '.json';
file_put_contents($file, json_encode($result, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
chmod($file, 0600);
echo json_encode([
    'campaign_id' => $result['campaign_id'],
    'url' => config('app.url') . '/w/' . $result['campaign_id'],
    'copied_entities' => count($result['entities']),
    'clean_source_unchanged' => true,
]) . PHP_EOL;
