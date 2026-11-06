<?php

use Illuminate\Contracts\Console\Kernel;

require __DIR__ . '/../../vendor/autoload.php';
$app = require __DIR__ . '/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
// Standalone helpers must fail the shell pipeline when Laravel renders an exception.
set_exception_handler(static function (Throwable $exception): never {
    fwrite(STDERR, get_class($exception) . ': ' . $exception->getMessage() . PHP_EOL);
    exit(1);
});
if (! $app->environment('local')) {
    throw new RuntimeException('These helpers are restricted to APP_ENV=local.');
}

return $app;
