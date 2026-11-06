@extends('layouts.app', [
    'title' => __('Local advanced features'),
    'breadcrumbs' => false,
    'sidebar' => 'settings',
    'centered' => true,
])

@section('content')
    <x-grid type="1/1">
        <h1 class="text-2xl">{{ __('Local advanced features') }}</h1>
        <p>{{ __('Advanced campaign features are enabled on this local installation. No hosted subscription or premium allocation is needed.') }}</p>

        <div class="rounded-2xl p-6 bg-base-100 flex flex-col gap-3">
            <h2 class="text-xl">{{ __('Available locally') }}</h2>
            <p>{{ __('Custom modules, larger uploads, campaign galleries, styles and layout customization are enabled. Search, local mail capture and realtime updates run in the Docker stack.') }}</p>
            <ul class="list-disc pl-5">
                @foreach ($campaigns as $localCampaign)
                    <li><a href="{{ route('dashboard', ['campaign' => $localCampaign]) }}" class="text-link">{{ $localCampaign->name }}</a></li>
                @endforeach
            </ul>
        </div>

        <div class="rounded-2xl p-6 bg-base-100 flex flex-col gap-3">
            <h2 class="text-xl">{{ __('Hosted or separately configured services') }}</h2>
            <p>{{ __('Kanka subscription billing and premium allocation belong to the hosted service. Marketplace downloads, paid assets and Font Awesome Pro are not included in this installation.') }}</p>
            <p>{{ __('Social sign-in, Discord and delivery of email to external recipients require separate provider configuration. Mailpit captures email locally.') }}</p>
        </div>
    </x-grid>
@endsection
