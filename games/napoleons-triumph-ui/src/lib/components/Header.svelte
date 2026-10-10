<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { Scenario, roundLabel } from '@tabletop/napoleons-triumph'
    import { ARMY_COLORS } from '$lib/definitions/palette.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const activePlayerId = $derived(gameSession.gameState.activePlayerIds[0])
    const inPlay = $derived(gameSession.gameState.rounds.currentRound !== undefined)
    const morale = $derived(
        gameSession.gameState.players.flatMap((player) =>
            player.side ? [{ side: player.side, morale: player.morale }] : []
        )
    )
</script>

<div class="flex h-[40px] max-sm:h-[30px] items-center justify-between px-3 max-sm:px-1 text-[#2b2620]">
    <div class="flex items-baseline gap-x-3 text-[17px] max-sm:text-[14px]">
        {#if gameSession.isViewingHistory}
            <span>History</span>
        {:else if gameSession.gameState.result}
            <span>End of game</span>
        {:else if gameSession.isMyTurn}
            <span>Your turn</span>
        {:else}
            <span class="inline-flex gap-x-1">
                <PlayerName playerId={activePlayerId} possessive={true} /> turn
            </span>
        {/if}
        {#if inPlay && !gameSession.gameState.result}
            <span class="text-[14px] max-sm:text-[12px] opacity-70"
                >{roundLabel(
                    gameSession.gameState.currentRound,
                    gameSession.gameState.scenario === Scenario.December1
                )}</span
            >
        {/if}
    </div>
    <div class="flex items-center gap-x-3">
        {#each morale as army (army.side)}
            <span
                class="nt-morale"
                style="background: {ARMY_COLORS[army.side].block}; color: {ARMY_COLORS[army.side].ink};"
                aria-label="{army.side} morale {army.morale}">{army.morale}</span
            >
        {/each}
        {#if gameSession.hasManualSelection() || gameSession.undoableAction}
            <button type="button" class="nt-plain-button" onclick={() => gameSession.undo()}>Undo</button>
        {/if}
    </div>
</div>

<style>
    .nt-morale {
        min-width: 2.1em;
        padding: 0 0.35em;
        border-radius: 3px;
        text-align: center;
        font-weight: 700;
        font-size: 16px;
    }
</style>
