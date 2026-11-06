<?php

use App\Facades\Img;
use App\Models\Campaign;
use App\Models\Entity;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

$app = require __DIR__ . '/bootstrap.php';

$disk = Storage::disk('s3');
$image = imagecreatetruecolor(16, 16);
imagefill($image, 0, 0, imagecolorallocate($image, 40, 80, 120));
ob_start();
imagepng($image);
$bytes = ob_get_clean();
$path = 'deployment-check.png';
$disk->put($path, $bytes, 'public');
if (hash('sha256', $disk->get($path)) !== hash('sha256', $bytes)) {
    throw new RuntimeException('Object storage roundtrip mismatch');
}
$campaign = new Campaign;
$user = User::firstOrFail();
echo json_encode([
    'database' => 'ready',
    'storage_roundtrip' => true,
    'image_url' => $disk->url($path),
    'thumbnail_url' => Img::crop(8, 8)->url($path),
    'campaigns' => Campaign::count(),
    'entities' => Entity::count(),
    'advanced_features' => config('selfhost.advanced_features'),
    'premium_available' => $campaign->premium(),
    'highest_campaign_tier' => $campaign->isElemental(),
    'highest_owner_tier' => $user->isElemental(),
    'api_limit' => $user->rate_limit,
    'mcp_enabled' => config('mcp.enabled'),
    'two_factor_available' => config('google2fa.enabled'),
    'queue' => config('queue.default'),
    'search' => config('scout.driver'),
    'broadcasting' => config('broadcasting.default'),
], JSON_PRETTY_PRINT) . PHP_EOL;
