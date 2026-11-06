<?php

use App\Models\Campaign;
use App\Models\CampaignBoost;

it('renders local premium status without requiring hosted subscription allocations', function () {
    $this->asUser()->withCampaign();
    $this->actingAs(auth()->user(), 'web')->withoutVite();
    config(['selfhost.advanced_features' => true]);
    expect(CampaignBoost::count())->toBe(0);

    $this->get(route('settings.premium'))
        ->assertOk()
        ->assertViewIs('settings.premium.local')
        ->assertSee('Local advanced features')
        ->assertSee('No hosted subscription or premium allocation is needed.')
        ->assertSee(Campaign::firstOrFail()->name)
        ->assertDontSee('Switch to legacy');

    expect(CampaignBoost::count())->toBe(0);
});
