<?php

use App\Services\RaceTransferResolver;

function transferRace(int $id, string $name, ?string $key = null): array
{
    return ['entity_id' => $id, 'race_id' => $id + 100, 'name' => $name, 'srd_key' => $key];
}

it('prefers 5e on import and campaign races on export', function () {
    $r = new RaceTransferResolver;
    $rows = [transferRace(1, 'Elf', 'srd5.1:elf'), transferRace(2, 'Elves (Renovar)')];
    expect($r->resolve(transferRace(90, 'Elves'), $rows, 'import')['entity_id'])->toBe(1)
        ->and($r->resolve($rows[0], $rows, 'export')['entity_id'])->toBe(2);
});

it('does not conflate subraces variants or creatures with base races', function () {
    $r = new RaceTransferResolver;
    foreach (['High Elf', 'Wood Elf', 'Drow', 'Human (variant)', 'Satyr'] as $name) {
        expect($r->resolve(transferRace(90, $name), [transferRace(1, 'Elf'), transferRace(2, 'Human')], 'import')['action'])->toBe('create');
    }
});

it('requires a decision for ambiguous matches and skips archived rows', function () {
    $r = new RaceTransferResolver;
    $rows = [transferRace(1, 'Elves'), transferRace(2, 'Elf')];
    expect($r->resolve(transferRace(90, 'Elf'), $rows, 'export')['action'])->toBe('conflict');
    $rows[0]['archived_at'] = '2026-11-06';
    expect($r->resolve(transferRace(90, 'Elf'), $rows, 'export')['entity_id'])->toBe(2);
});

it('creates once then reuses the destination native and global IDs on subsequent plans', function () {
    $r = new RaceTransferResolver;
    $source = transferRace(1, 'Half-Elf', 'srd5.1:half-elf');
    expect($r->resolve($source, [], 'export')['action'])->toBe('create');
    $destination = [transferRace(20, 'Half Elf')];
    expect($r->resolve($source, $destination, 'export'))->toBe(['action' => 'reuse', 'entity_id' => 20, 'race_id' => 120]);
});
