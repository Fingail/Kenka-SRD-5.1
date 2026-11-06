<?php

namespace App\Services;

use App\Models\User;
use RuntimeException;

class LocalOwner
{
    public function user(): User
    {
        if (! app()->environment('local')) {
            throw new RuntimeException('Local owner access is restricted to local deployments.');
        }
        $access = json_decode(file_get_contents(storage_path('app/local-access.json')), true, 512, JSON_THROW_ON_ERROR);

        return User::where('email', $access['email'])->firstOrFail();
    }
}
