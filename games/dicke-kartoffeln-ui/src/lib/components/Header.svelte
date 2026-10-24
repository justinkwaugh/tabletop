<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { roundLabel } from '$lib/utils/rounds.js'

    const gameSession = getGameSession()

    const label = $derived(roundLabel(gameSession.gameState.machineState))
    const waitingFor = $derived(
        gameSession.gameState.activePlayerIds.filter(
            (playerId) => playerId !== gameSession.myPlayerId
        )
    )
</script>

<div class="header">
    <div class="status">
        {#if gameSession.isViewingHistory}
            <div in:fade={{ duration: 200 }}>History</div>
        {:else if gameSession.gameState.result}
            <div in:fade={{ duration: 200 }}>End of game</div>
        {:else}
            <div class="line" in:fade={{ duration: 200 }}>
                <span class="year">Year {gameSession.year} of {gameSession.setup.years}</span>
                {#if label}<span class="round">· {label.number} {label.name}</span>{/if}
                <span class="who">
                    {#if gameSession.myPlanningTurn}
                        — Your turn
                    {:else if waitingFor.length > 0}
                        — waiting for
                        {#each waitingFor as playerId, index (playerId)}
                            {#if index > 0}<span>,</span>{/if}
                            <PlayerName {playerId} />
                        {/each}
                    {/if}
                </span>
            </div>
        {/if}
    </div>
    <div class="buttons">
        {#if gameSession.hasManualSelection() || gameSession.undoableAction}
            <button type="button" class="undo" onclick={() => gameSession.undo()}>Undo</button>
        {/if}
        <button
            type="button"
            class="aid"
            class:open={gameSession.playerAidOpen}
            aria-label="Player aid"
            aria-expanded={gameSession.playerAidOpen}
            onclick={() => gameSession.togglePlayerAid()}>?</button
        >
    </div>
</div>

<style>
    .header {
        display: flex;
        min-height: 42px;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 0 12px;
        color: #3d2410;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
        font-size: 22px;
    }

    .line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
    }

    .round {
        color: #6e3b1c;
    }

    .who {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 4px;
        font-size: 18px;
    }

    .undo {
        border: 2px solid #6e3b1c;
        border-radius: 999px;
        padding: 0 14px;
        color: #6e3b1c;
        font-size: 18px;
    }

    .buttons {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .aid {
        width: 30px;
        height: 30px;
        border: 2px solid #6e3b1c;
        border-radius: 999px;
        color: #6e3b1c;
        font-size: 18px;
        line-height: 1;
    }

    .aid.open {
        background: #6e3b1c;
        color: #fff6dc;
    }

    .undo:hover,
    .aid:not(.open):hover {
        background: rgba(110, 59, 28, 0.12);
    }

    @media (max-width: 639px) {
        .header {
            min-height: 30px;
            font-size: 15px;
        }

        .who {
            font-size: 14px;
        }

        .undo {
            font-size: 14px;
        }
    }
</style>
