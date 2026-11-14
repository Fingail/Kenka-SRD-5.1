<?php

namespace App\Console\Commands\Local;

use App\Services\RulesTransferResolver;
use Illuminate\Console\Command;
use RuntimeException;

class PlanRulesTransferCommand extends Command
{
    protected $signature = 'local:plan-rules-transfer {direction : import or export} {manifest : Classified source and complete destination inventory JSON}';

    protected $description = 'Plan category-aware rules mappings for manual sync without API or database writes';

    public function handle(RulesTransferResolver $resolver): int
    {
        if (! app()->environment('local')) {
            throw new RuntimeException('This command is restricted to the local deployment.');
        }
        $manifest = json_decode(file_get_contents($this->argument('manifest')), true, 512, JSON_THROW_ON_ERROR);
        if (($manifest['destination_complete'] ?? false) !== true || empty($manifest['source_campaign_id'])
            || empty($manifest['destination_campaign_id']) || ! isset($manifest['sources'], $manifest['destination'])) {
            throw new RuntimeException('Supply campaign IDs, selected sources and a complete classified destination inventory.');
        }
        $plan = [];
        foreach ($manifest['sources'] as $source) {
            $plan[$source['entity_id']] = $resolver->resolve($source, $manifest['destination'], $this->argument('direction'));
        }
        $this->line(json_encode(['source_campaign_id' => $manifest['source_campaign_id'],
            'destination_campaign_id' => $manifest['destination_campaign_id'], 'writes' => 0,
            'resources' => $plan], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));

        return collect($plan)->contains(fn ($r) => $r['action'] === 'conflict') ? self::FAILURE : self::SUCCESS;
    }
}
