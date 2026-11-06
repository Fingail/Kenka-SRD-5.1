<?php

// Runs before Composer is installed. No credentials are written to stdout.
$root = dirname(__DIR__, 2);
umask(0077);
$envFile = $root . '/.env';
if (! file_exists($envFile)) {
    $template = file_get_contents($root . '/.env.example');
    $replace = function (string $key, string $value) use (&$template): void {
        $template = preg_replace('/^' . preg_quote($key, '/') . '=.*$/m', $key . '=' . $value, $template);
    };
    $random = fn (): string => bin2hex(random_bytes(24));
    $storageUser = 'local-' . bin2hex(random_bytes(6));
    $storagePassword = $random();
    foreach (['APP_KEY' => 'base64:' . base64_encode(random_bytes(32)), 'DB_PASSWORD' => $random(), 'DB_ROOT_PASSWORD' => $random(),
        'MINIO_ROOT_USER' => $storageUser, 'MINIO_ROOT_PASSWORD' => $storagePassword,
        'AWS_ACCESS_KEY_ID' => $storageUser, 'HETZNER_S3_ACCESS_KEY_ID' => $storageUser,
        'AWS_SECRET_ACCESS_KEY' => $storagePassword, 'HETZNER_S3_ACCESS_KEY_SECRET' => $storagePassword,
        'MEILISEARCH_KEY' => $random(), 'REVERB_APP_KEY' => $random(), 'REVERB_APP_SECRET' => $random(),
        'REVERB_APP_ID' => (string) random_int(100000, 999999),
        'WWWUSER' => (string) posix_getuid(), 'WWWGROUP' => (string) posix_getgid(),
    ] as $key => $value) {
        $replace($key, $value);
    }
    $port = (int) (getenv('LOCAL_HTTP_PORT') ?: 18081);
    if ($port < 1025 || $port > 63000) {
        throw new RuntimeException('Choose a local HTTP port between 1025 and 64000.');
    }
    $offset = $port - 18081;
    $replace('APP_PORT', (string) $port);
    $replace('APP_URL', 'http://127.0.0.1:' . $port);
    $replace('MCP_REDIRECT_DOMAINS', 'http://127.0.0.1:' . $port);
    $replace('REVERB_PORT', (string) (18080 + $offset));
    $replace('VITE_REVERB_PORT', (string) (18080 + $offset));
    $replace('THUMBOR_URL', 'http://127.0.0.1:' . (18889 + $offset));
    $replace('AWS_URL', 'http://127.0.0.1:' . (19000 + $offset));
    $replace('AWS_URL_S3', 'http://127.0.0.1:' . (19000 + $offset) . '/kanka');
    $project = getenv('LOCAL_PROJECT') ?: 'kenka-srd-51';
    $replace('COMPOSE_PROJECT_NAME', $project);
    $replace('LOCAL_NETWORK_NAME', $project);
    $template .= 'MINIO_PORT=' . (19000 + $offset) . "\nMINIO_CONSOLE_PORT=" . (19001 + $offset) . "\nTHUMBOR_PORT=" . (18889 + $offset) . "\nMAILPIT_PORT=" . (18025 + $offset) . "\n";
    file_put_contents($envFile, $template);
    chmod($envFile, 0600);
}
$accessFile = $root . '/storage/app/local-access.json';
if (! file_exists($accessFile)) {
    if (! is_dir(dirname($accessFile))) {
        mkdir(dirname($accessFile), 0770, true);
    }
    preg_match('/^APP_URL=(.*)$/m', file_get_contents($envFile), $url);
    $access = ['url' => trim($url[1]), 'name' => 'Local owner',
        'email' => 'owner-' . bin2hex(random_bytes(6)) . '@localhost.invalid',
        'password' => bin2hex(random_bytes(20))];
    file_put_contents($accessFile, json_encode($access, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . PHP_EOL);
    chmod($accessFile, 0600);
}
echo "Local configuration ready. Credentials are stored only in ignored, mode-0600 files.\n";
