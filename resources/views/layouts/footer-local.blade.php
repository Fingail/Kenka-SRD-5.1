<footer id="footer" class="main-footer px-4 py-4 print:hidden">
    <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-content">
        <span>Kanka v{{ config('app.version') }} · &copy; {{ date('Y') }} Owlchester SNC</span>
        <nav aria-label="{{ __('Licensing and source code') }}" class="flex flex-wrap gap-4">
            <a href="https://github.com/Fingail/Kenka-SRD-5.1" class="text-link">GitHub</a>
            <a href="https://github.com/owlchester/kanka/blob/3.17/LICENSE" class="text-link">{{ __('Kanka license') }}</a>
            @if (isset($campaign) && $campaign->id === 1)
                <a href="{{ url('/w/1/entities/1') }}" class="text-link">{{ __('SRD and icon licenses') }}</a>
            @endif
        </nav>
    </div>
</footer>
