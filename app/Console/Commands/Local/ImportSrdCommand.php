<?php

namespace App\Console\Commands\Local;

use App\Facades\CampaignCache;
use App\Facades\CampaignLocalization;
use App\Facades\EntityCache;
use App\Facades\Mentions;
use App\Facades\Module;
use App\Models\Campaign;
use App\Models\Entity;
use App\Services\LocalOwner;
use App\Services\LocalSrdImporter;
use App\Services\LocalSrdLinker;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Auth;
use RuntimeException;

class ImportSrdCommand extends Command
{
    protected $signature = 'local:import-srd {manifest} {--dry-run}';

    protected $description = 'Import prepared official SRD records directly into the local rules campaign';

    public function handle(LocalSrdImporter $importer, LocalSrdLinker $linker): int
    {
        if (! app()->environment('local') || ! config('selfhost.advanced_features')) {
            throw new RuntimeException('This command is restricted to the local deployment.');
        }
        $manifest = json_decode(file_get_contents($this->argument('manifest')), true, 512, JSON_THROW_ON_ERROR);
        if (rtrim($manifest['origin'] ?? '', '/') !== rtrim(config('app.url'), '/') || ($manifest['campaign_id'] ?? null) !== 1) {
            throw new RuntimeException('Unexpected destination in the manifest.');
        }
        $campaign = Campaign::findOrFail(1);
        if ($campaign->name !== '5e Rules — SRD 5.1') {
            throw new RuntimeException('The destination campaign has changed.');
        }
        $user = app(LocalOwner::class)->user();
        Auth::login($user);
        if (! $user->can('admin', $campaign)) {
            throw new RuntimeException('Local owner cannot administer the destination.');
        }
        CampaignCache::campaign($campaign)->user($user);
        EntityCache::campaign($campaign);
        CampaignLocalization::forceCampaign($campaign);
        Mentions::campaign($campaign);
        Module::campaign($campaign);
        $keys = [];
        foreach ($manifest['records'] as $record) {
            foreach (['key', 'name', 'entry', 'module', 'kind', 'properties'] as $field) {
                if (! isset($record[$field])) {
                    throw new RuntimeException('Missing record field: ' . $field);
                }
            }
            if (isset($keys[$record['key']]) || ! str_starts_with($record['key'], 'srd5.1:')) {
                throw new RuntimeException('Invalid or duplicate source key.');
            }
            $keys[$record['key']] = true;
        }
        if ($this->option('dry-run')) {
            $this->info('Validated ' . count($keys) . ' source records; no writes performed.');

            return self::SUCCESS;
        }
        $started = microtime(true);
        $report = ['created' => 0, 'unchanged' => 0, 'mapping' => [], 'verification_failures' => []];
        $previousScout = config('scout.driver');
        config(['scout.driver' => null]);
        Entity::disableSearchSyncing();
        try {
            foreach ($manifest['records'] as $index => $record) {
                $result = $importer->importRecord($campaign, $user, $record);
                $report[$result['action']]++;
                $report['mapping'][$record['key']] = $result['entity_id'];
                if (($index + 1) % 100 === 0) {
                    $this->info('Imported/checked ' . ($index + 1) . '/' . count($keys));
                }
            }
            $report['links'] = $linker->link($campaign, $manifest);
            foreach ($manifest['records'] as $record) {
                $entity = Entity::findOrFail($report['mapping'][$record['key']]);
                if ($entity->entry !== $record['entry'] || $entity->name !== $record['name']) {
                    $report['verification_failures'][] = $record['key'];
                }
                $storedProperties = $entity->attributes()->pluck('value', 'name');
                foreach ($record['properties'] as $name => $value) {
                    if ($value === null || $value === '') {
                        continue;
                    }
                    $expected = is_array($value)
                        ? json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)
                        : (is_bool($value) ? ($value ? '1' : '0') : (string) $value);
                    if ($storedProperties->get($name) !== $expected) {
                        $report['verification_failures'][] = $record['key'] . ':' . $name;
                    }
                }
                if ($entity->entityType->isStandard() && ! $entity->child) {
                    $report['verification_failures'][] = $record['key'] . ':missing native child';
                }
            }
        } finally {
            Entity::enableSearchSyncing();
            config(['scout.driver' => $previousScout]);
            CampaignCache::campaign($campaign)->clear();
            $report['elapsed_seconds'] = round(microtime(true) - $started, 2);
            file_put_contents(storage_path('app/srd-import-report.json'), json_encode($report, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
        }
        $this->info(json_encode(array_diff_key($report, ['mapping' => true]), JSON_THROW_ON_ERROR));

        return empty($report['verification_failures']) ? self::SUCCESS : self::FAILURE;
    }
}
