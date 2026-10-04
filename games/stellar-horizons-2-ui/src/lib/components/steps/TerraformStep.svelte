<script lang="ts">
    import { WorldSide, terraformTargets } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import WorldImage from '../WorldImage.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const targets = $derived(terraformTargets(gameState, gameSession.myPlayerId ?? ''))
</script>

<div class="sh-step">
    <p class="hint">
        You may terraform one world in a system where you have a base. A side I world flips to side
        II; a side II world draws a replacement that may be up to 10 population larger.
    </p>
    <div class="row">
        {#each targets as target (`${target.systemId}:${target.slot}`)}
            {@const world = gameState.systemState(target.systemId).worlds[target.slot]}
            <button
                type="button"
                class="target"
                onclick={() => gameSession.terraform(target.systemId, target.slot)}
            >
                <WorldImage tileId={world.tileId} side={world.side} size={64} />
                <span>{systemName(target.systemId)}</span>
                <span class="side"
                    >{world.side === WorldSide.I ? 'Flip to II' : 'Draw a new world'}</span
                >
            </button>
        {/each}
        <button type="button" onclick={() => gameSession.passTerraform()}>Don't terraform</button>
    </div>
</div>

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
    }

    .target {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        font-size: 12px;
    }

    .side {
        color: #7fd3ff;
    }
</style>
