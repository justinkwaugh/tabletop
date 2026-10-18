<script lang="ts">
    import {
        IP_FOR_FLIP,
        IP_FOR_REPLACEMENT,
        WorldSide,
        isCampaign,
        terraformTargets
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import WorldImage from '../WorldImage.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const targets = $derived(terraformTargets(gameState, gameSession.myPlayerId ?? ''))
    // The Givers terraform once more than their tech allows, one turn of the queue each.
    const remaining = $derived(
        gameState.terraformQueue.filter((playerId) => playerId === gameSession.myPlayerId).length
    )
</script>

<div class="sh-step">
    <p class="hint">
        You may terraform {remaining > 1 ? `${remaining} worlds, one at a time,` : 'one world'} in a system
        where you have a base. A side I world flips to side II; a side II world draws a replacement that
        may be up to 10 population larger.{isCampaign(gameState)
            ? ` Flipping earns ${IP_FOR_FLIP} IP, a replacement ${IP_FOR_REPLACEMENT}.`
            : ''}
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
