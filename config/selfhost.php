<?php

return [
    'advanced_features' => env('APP_ENV') === 'local' && (bool) env('LOCAL_ADVANCED_FEATURES', false),
    'single_host' => env('APP_ENV') === 'local' && (bool) env('LOCAL_SINGLE_HOST', false),
];
