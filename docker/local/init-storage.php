<?php

use Illuminate\Support\Facades\Storage;

$app = require __DIR__ . '/bootstrap.php';

$client = Storage::disk('s3')->getClient();
foreach (['kanka', 'thumbnails', 'exports', 'backups'] as $bucket) {
    if (! $client->doesBucketExistV2($bucket)) {
        $client->createBucket(['Bucket' => $bucket]);
    }
    if (in_array($bucket, ['kanka', 'thumbnails'], true)) {
        $client->putBucketPolicy([
            'Bucket' => $bucket,
            'Policy' => json_encode([
                'Version' => '2012-10-17',
                'Statement' => [[
                    'Effect' => 'Allow',
                    'Principal' => ['AWS' => ['*']],
                    'Action' => ['s3:GetObject'],
                    'Resource' => ['arn:aws:s3:::' . $bucket . '/*'],
                ]],
            ]),
        ]);
    }
    echo 'Ready bucket: ' . $bucket . PHP_EOL;
}
