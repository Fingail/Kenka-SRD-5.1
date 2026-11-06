<?php

use Illuminate\Support\Facades\Redis;

$app = require __DIR__ . '/bootstrap.php';

$queue = app('queue')->connection();
echo json_encode([
    'connection' => config('queue.default'),
    'driver_class' => get_class($queue),
    'queue_name' => config('queue.connections.redis.queue'),
    'redis_connection' => config('queue.connections.redis.connection'),
    'queue_size' => $queue->size('default'),
    'redis_list' => Redis::connection()->llen('queues:default'),
    'redis_host' => config('database.redis.default.host'),
    'redis_database' => config('database.redis.default.database'),
    'maintenance' => app()->isDownForMaintenance(),
], JSON_PRETTY_PRINT) . PHP_EOL;
