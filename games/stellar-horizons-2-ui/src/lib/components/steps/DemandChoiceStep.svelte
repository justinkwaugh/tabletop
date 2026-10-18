<script lang="ts">
    import { DEMAND_ART } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import { goodName } from '$lib/utils/trade.js'

    const gameSession = getGameSession()
    const draw = $derived(gameSession.gameState.demandDraws.at(0))
</script>

{#if draw}
    <div class="sh-step">
        <p class="hint">
            {systemName(draw.systemId)} gets a demand marker: goods of its kind can be sold there. Keep
            one; the others go back to the pool.
        </p>
        <div class="markers">
            {#each draw.drawn as good, index (index)}
                <button
                    type="button"
                    class="marker"
                    aria-label="Keep {goodName(good)} demand"
                    onclick={() => gameSession.chooseDemand(good)}
                >
                    <img src={DEMAND_ART[good]} alt="" width="64" height="64" />
                    <span>{goodName(good)}</span>
                </button>
            {/each}
        </div>
    </div>
{/if}

<style>
    .markers {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }

    .marker {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 6px 10px;
    }

    .marker img {
        border-radius: 4px;
    }

    .marker span {
        font-weight: 700;
    }
</style>
