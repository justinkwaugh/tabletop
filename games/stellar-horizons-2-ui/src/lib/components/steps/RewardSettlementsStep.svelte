<script lang="ts">
    import { anomalyDefinition } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { plural, systemName } from '$lib/utils/presentation.js'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const reward = $derived(gameState.settlementRewards.at(0))
    const placed = $derived(gameSession.rewardDraft.systemIds)
    const placements = $derived(
        [...new Set(placed)].map((systemId) => ({
            systemId,
            count: placed.filter((candidate) => candidate === systemId).length
        }))
    )
</script>

{#if reward}
    {@const left = reward.settlements - placed.length}
    <div class="sh-step">
        <p class="hint">
            {anomalyDefinition(reward.anomalyId).name} gives {plural(
                reward.settlements,
                'settlement'
            )}. Choose highlighted systems on the map, one settlement each: any of your bases, or a
            new base at {systemName(reward.systemId)} if you are within your base limit. Undo takes one
            back.
        </p>
        <div class="row">
            {#each placements as placement (placement.systemId)}
                <span class="placed"
                    >{systemName(placement.systemId)}{gameState.base(
                        reward.playerId,
                        placement.systemId
                    )
                        ? ''
                        : ' (new base)'}: +{placement.count}</span
                >
            {/each}
            <button
                type="button"
                class="primary"
                disabled={left !== 0}
                onclick={() => gameSession.commitRewardDraft()}
            >
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

    .placed {
        font-weight: 700;
        color: #e8f1ff;
    }
</style>
