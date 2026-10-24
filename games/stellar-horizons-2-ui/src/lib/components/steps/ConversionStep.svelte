<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import { conversionTargets } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { plural, systemName } from '$lib/utils/presentation.js'

    const gameSession = getGameSession()
    const targets = $derived(conversionTargets(gameSession.gameState, gameSession.myPlayerId ?? ''))
    // The True Path convert on a 4 or less, Cultural Dominance on a 3 or less.
    const roll = $derived.by(() => {
        const chance = gameSession.gameState.conversions.at(0)
        assertExists(chance, 'The conversion step waits on a conversion roll')
        return chance.roll
    })
</script>

<div class="sh-step">
    <p class="hint">
        In one system where you and another faction both have bases, roll a die: on {roll}
        or less one of their settlements becomes yours. The last settlement of a base cannot be converted.
    </p>
    <div class="row">
        {#each targets as base (`${base.systemId}:${base.playerId}`)}
            <button
                type="button"
                class="target"
                onclick={() => gameSession.convertSettlement(base.systemId, base.playerId)}
            >
                <span>{systemName(base.systemId)}</span>
                <span class="who"
                    ><PlayerName playerId={base.playerId} /> · {plural(
                        base.settlements,
                        'settlement'
                    )}</span
                >
            </button>
        {/each}
        <button type="button" onclick={() => gameSession.passConversion()}>Don't convert</button>
    </div>
</div>

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
    }

    .target {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
    }

    .who {
        font-size: 12px;
        color: #9fb4d0;
    }
</style>
