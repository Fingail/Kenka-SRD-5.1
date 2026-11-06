<?php

use App\Models\Campaign;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

$app = require __DIR__ . '/bootstrap.php';

$access = json_decode(file_get_contents(storage_path('app/local-access.json')), true, 512, JSON_THROW_ON_ERROR);
$user = User::firstOrNew(['email' => $access['email']]);
if (! $user->exists) {
    $user->forceFill([
        'name' => $access['name'],
        'password' => Hash::make($access['password']),
        'locale' => 'en',
    ])->save();
}
$user->roles()->syncWithoutDetaching(Role::whereIn('name', ['admin', 'user'])->pluck('id'));
if (empty($access['api_token'])) {
    $access['api_token'] = $user->createToken('Local workstation')->accessToken;
}
if (empty($access['mcp_token'])) {
    $access['mcp_token'] = $user->createToken('Local MCP', ['mcp:use'])->accessToken;
}
file_put_contents(storage_path('app/local-access.json'), json_encode($access, JSON_PRETTY_PRINT) . PHP_EOL);
chmod(storage_path('app/local-access.json'), 0600);
echo 'Local owner ready; campaign count: ' . Campaign::count() . PHP_EOL;
