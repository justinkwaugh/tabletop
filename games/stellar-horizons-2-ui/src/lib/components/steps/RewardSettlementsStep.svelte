<script lang="ts">
    import { anomalyDefinition, rewardPlacementSystems } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { plural, systemName } from '$lib/utils/presentation.js'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const reward = $derived(gameState.settlementRewards.at(0))
    const systems = $derived(reward ? rewardPlacementSystems(gameState) : [])
    const anomalyName = $derived.by(() => {
        const anomalyId = reward ? gameState.systemState(reward.systemId).anomaly : undefined
        return anomalyId ? anomalyDefinition(anomalyId).name : 'The anomaly'
    })

    let counts: Record<string, number> = $state({})
    const placed = $derived(Object.values(counts).reduce((total, count) => total + count, 0))
    const left = $derived((reward?.settlements ?? 0) - placed)

    function adjust(systemId: string, change: number) {
        const next = Math.max(0, (counts[systemId] ?? 0) + change)
        if (change > 0 && left <= 0) return
        counts = { ...counts, [systemId]: next }
    }

    async function place() {
        const placements = Object.entries(counts)
            .filter(([, settlements]) => settlements > 0)
            .map(([systemId, settlements]) => ({ systemId, settlements }))
        counts = {}
        await gameSession.placeRewardSettlements(placements)
    }
</script>

{#if reward}
    <div class="sh-step">
        <p class="hint">
            {anomalyName} gives {plural(reward.settlements, 'settlement')}. Add them to any of your
            bases, or found a base at {systemName(reward.systemId)} if you are within your base limit.
        </p>
        <div class="row">
            {#each systems as systemId (systemId)}
                {@const isNew = gameState.base(reward.playerId, systemId) === undefined}
                <div class="place">
                    <span class="system">{systemName(systemId)}{isNew ? ' (new base)' : ''}</span>
                    <span class="stepper">
                        <button
                            type="button"
                            aria-label="One fewer at {systemName(systemId)}"
                            disabled={(counts[systemId] ?? 0) === 0}
                            onclick={() => adjust(systemId, -1)}>−</button
                        >
                        <span>{counts[systemId] ?? 0}</span>
                        <button
                            type="button"
                            aria-label="One more at {systemName(systemId)}"
                            disabled={left <= 0}
                            onclick={() => adjust(systemId, 1)}>+</button
                        >
                    </span>
                </div>
            {/each}
            <button type="button" class="primary" disabled={left !== 0} onclick={place}>
                {left === 0 ? 'Place settlements' : `${plural(left, 'settlement')} to place`}
            </button>
        </div>
    </div>
{/if}

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 16px;
    }

    .place {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .system {
        font-weight: 700;
        color: #e8f1ff;
    }

    .stepper {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }

    .stepper button {
        width: 26px;
        height: 26px;
        padding: 0;
    }
</style>
