<?php

use App\Models\Campaign;
use App\Models\Entity;
use App\Models\EntityAbility;
use App\Models\OrganisationMember;
use App\Services\LocalSrdImporter;
use App\Services\LocalSrdLinker;

it('links native children, inherited race abilities and pantheon members without duplicates', function () {
    $this->asUser()->withCampaign();
    $campaign = Campaign::firstOrFail();
    $records = [];
    foreach ([
        ['race:Base', 'Base', 'race', 'Race', []],
        ['race:Subrace', 'Subrace', 'race', 'Race', ['parent_key' => 'srd5.1:race:Base']],
        ['feature:Trait', 'Trait', 'ability', 'Feature', ['owner_key' => 'srd5.1:race:Base']],
        ['pantheon:Gods', 'Gods', 'organisation', 'Pantheon', []],
        ['deity:God', 'God', 'character', 'Deity', ['pantheon_key' => 'srd5.1:pantheon:Gods']],
    ] as [$key, $name, $module, $kind, $links]) {
        $records[] = ['key' => 'srd5.1:' . $key, 'name' => $name, 'module' => $module,
            'kind' => $kind, 'entry' => '<p>Source text.</p>', 'properties' => [], 'links' => $links];
    }
    $map = [];
    foreach ($records as $record) {
        $map[$record['key']] = app(LocalSrdImporter::class)->importRecord($campaign, auth()->user(), $record)['entity_id'];
    }
    $linker = app(LocalSrdLinker::class);
    $linker->link($campaign, ['records' => $records]);
    $linker->link($campaign, ['records' => $records]);
    $member = OrganisationMember::firstOrFail();

    expect(Entity::findOrFail($map['srd5.1:race:Subrace'])->parent_id)->toBe($map['srd5.1:race:Base'])
        ->and(EntityAbility::count())->toBe(2)
        ->and(OrganisationMember::count())->toBe(1)
        ->and($member->character_id)->toBe(Entity::findOrFail($map['srd5.1:deity:God'])->child->id)
        ->and($member->organisation_id)->toBe(Entity::findOrFail($map['srd5.1:pantheon:Gods'])->child->id);
});
