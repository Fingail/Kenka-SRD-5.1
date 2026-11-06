<?php

use App\Models\Campaign;
use App\Models\User;

it('enables the highest local feature tier without hosted subscription records', function () {
    config(['selfhost.advanced_features' => true]);

    $campaign = new Campaign(['boost_count' => 0]);
    $user = new User;

    expect($campaign->premium())->toBeTrue()
        ->and($campaign->boosted())->toBeTrue()
        ->and($campaign->superboosted())->toBeTrue()
        ->and($campaign->isElemental())->toBeTrue()
        ->and($user->isSubscriber())->toBeTrue()
        ->and($user->isGoblin())->toBeTrue()
        ->and($user->isElemental())->toBeTrue();
});

it('preserves the ordinary tier checks when local advanced features are disabled', function () {
    config(['selfhost.advanced_features' => false]);

    $campaign = new Campaign(['boost_count' => 0]);
    $user = new User;

    expect($campaign->premium())->toBeFalse()
        ->and($campaign->boosted())->toBeFalse()
        ->and($user->isElemental())->toBeFalse();
});

it('provides integer queue visibility timeouts for Carbon date arithmetic', function () {
    expect(config('queue.connections.redis.retry_after'))->toBeInt()->toBeGreaterThan(0)
        ->and(config('queue.connections.heavy.retry_after'))->toBeInt()->toBeGreaterThan(0);
});
