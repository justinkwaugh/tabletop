<script lang="ts">
    import { AnomalyChallenge } from '@tabletop/stellar-horizons-2'
    import type { AnomalySummary } from '$lib/utils/systemSummary.js'
    import { ANOMALY_SIZE } from '$lib/utils/tileFeatures.js'
    import AnomalyTile from './AnomalyTile.svelte'

    let { summary }: { summary: AnomalySummary } = $props()
    const anomaly = $derived(summary.anomaly)
    const science = $derived(anomaly.challenge === AnomalyChallenge.Science)
</script>

<section class="anomaly" class:science aria-label="Anomaly: {anomaly.name}">
    <AnomalyTile
        anomalyId={anomaly.id}
        difficulty={summary.difficulty}
        width={ANOMALY_SIZE.width}
    />
    <div class="facts">
        <span class="name">{anomaly.name}</span>
        <span class="challenge">
            {science ? 'Science' : 'Combat'} challenge:
            <strong>{summary.difficulty}</strong>
            {science ? 'exploration' : 'combat'} value to resolve
            <span class="sum">({anomaly.difficulty} + {summary.players} players)</span>
        </span>
        {#if anomaly.noExploration}
            <span class="rule">No exploration here until it is resolved.</span>
        {/if}
        {#if anomaly.noBases}
            <span class="rule">No settlements can be landed here until it is resolved.</span>
        {/if}
    </div>
</section>

<style>
    .anomaly {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 10px;
        border: 1px solid #1e2b44;
        border-left: 4px solid #e2552b;
        border-radius: 8px;
        background: #0d1322;
    }

    .anomaly.science {
        border-left-color: #2f9fd8;
    }

    .facts {
        display: flex;
        flex-direction: column;
        gap: 3px;
        font-size: 13px;
        color: #c5d3e6;
    }

    .name {
        font-size: 16px;
        font-weight: 700;
        color: #e8f1ff;
    }

    .challenge strong {
        color: #f2c94c;
    }

    .sum {
        color: #8fa4c2;
    }

    .rule {
        color: #f0a37c;
    }
</style>
