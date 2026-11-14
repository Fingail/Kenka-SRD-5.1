<?php

namespace App\Console\Commands\Local;

use App\Models\Campaign;
use App\Models\Entity;
use App\Services\RaceTransferResolver;
use Illuminate\Console\Command;
use RuntimeException;

class PlanRaceTransferCommand extends Command
{
    protected $signature = 'local:plan-race-transfer {direction : import or export} {snapshot : Complete remote race inventory JSON} {--campaign=2}';

    protected $description = 'Resolve local/remote race mappings without creating races or calling the API';

    public function handle(RaceTransferResolver $resolver): int
    {
        if (! app()->environment('local')) {
            throw new RuntimeException('This command is restricted to the local deployment.');
        }
        $direction = $this->argument('direction');
        $campaign = Campaign::findOrFail((int) $this->option('campaign'));
        $snapshot = json_decode(file_get_contents($this->argument('snapshot')), true, 512, JSON_THROW_ON_ERROR);
        if (($snapshot['complete'] ?? false) !== true || empty($snapshot['campaign_id']) || ! isset($snapshot['races'])) {
            throw new RuntimeException('A complete remote race inventory with campaign_id and races is required.');
        }
        $local = Entity::where('campaign_id', $campaign->id)->where('type_id', config('entities.ids.race'))
            ->whereNull('archived_at')->with(['attributes', 'assets'])->get()->map(fn ($e) => [
                'entity_id' => $e->id, 'race_id' => $e->entity_id, 'name' => $e->name,
                'srd_key' => $e->attributes->firstWhere('name', '_srd_key')?->value,
                'aliases' => $e->assets->filter(fn ($a) => $a->type_id->value === 3)->pluck('name')->all(),
            ])->all();
        [$sources, $targets] = $direction === 'import' ? [$snapshot['races'], $local] : [$local, $snapshot['races']];
        $plan = [];
        foreach ($sources as $source) {
            $plan[$source['entity_id']] = $resolver->resolve($source, $targets, $direction);
        }
        $this->line(json_encode(['direction' => $direction, 'local_campaign_id' => $campaign->id,
            'remote_campaign_id' => $snapshot['campaign_id'], 'writes' => 0, 'races' => $plan], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));

        return collect($plan)->contains(fn ($row) => $row['action'] === 'conflict') ? self::FAILURE : self::SUCCESS;
    }
}
