<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { Scenario, Side, roundLabel } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import SwelledRule from './SwelledRule.svelte'

    const gameSession = getGameSession()

    const TURN_TITLES: Record<Side, string> = {
        [Side.Allied]: 'Allies’ turn',
        [Side.French]: 'French turn'
    }

    const activePlayerId = $derived(gameSession.gameState.activePlayerIds[0])
    const activeSide = $derived(
        activePlayerId ? gameSession.gameState.findPlayerState(activePlayerId)?.side : undefined
    )
    const inPlay = $derived(gameSession.gameState.rounds.currentRound !== undefined)
</script>

<div class="nt-masthead-block">
    <div class="nt-masthead">
        <div class="nt-masthead-title">
            <span class="nt-masthead-turn">
                {#if gameSession.isViewingHistory}
                    History
                {:else if gameSession.gameState.result}
                    End of game
                {:else if activeSide}
                    {TURN_TITLES[activeSide]}
                {:else if gameSession.isMyTurn}
                    Your turn
                {:else}
                    <PlayerName playerId={activePlayerId} possessive={true} /> turn
                {/if}
            </span>
            {#if inPlay && !gameSession.gameState.result}
                {@const round = gameSession.gameState.currentRound}
                <span class="nt-masthead-time">
                    {#if gameSession.gameState.scenario === Scenario.December1}
                        {round.day}
                        <span class="max-sm:hidden">December</span><span class="sm:hidden">Dec</span
                        >
                        ·
                    {/if}
                    {roundLabel(round)}
                </span>
            {/if}
        </div>
        <div class="nt-masthead-side">
            {#if gameSession.hasManualSelection() || gameSession.undoableAction}
                <button type="button" class="nt-undo" onclick={() => gameSession.undo()}>
                    <svg viewBox="0 0 16 12.4" aria-hidden="true">
                        <path d="M5.4 1 L1.2 5 L5.4 9"></path>
                        <path d="M1.2 5 H10.6 a3.3 3.3 0 0 1 0 6.6 H6.8"></path>
                    </svg>
                    Undo
                </button>
            {/if}
        </div>
    </div>
    <div class="nt-masthead-rule"><SwelledRule /></div>
</div>

<style>
    .nt-masthead-block {
        --tint: color-mix(in srgb, var(--nt-turn-colour, var(--nt-ground)) 28%, var(--nt-ground));
        padding-bottom: 6px;
        background: linear-gradient(to bottom, var(--tint), var(--nt-ground));
    }

    .nt-masthead {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px 5px;
    }

    .nt-masthead-title {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0 0.6em;
        line-height: 1.2;
    }

    .nt-masthead-turn {
        font-size: 21px;
        font-style: italic;
    }

    .nt-masthead-time {
        font-size: 21px;
        font-weight: 700;
    }

    .nt-masthead-time::before {
        content: '·';
        margin-right: 0.6em;
    }

    .nt-masthead-side {
        display: flex;
        align-items: center;
        gap: 9px;
    }

    .nt-undo {
        display: inline-flex;
        align-items: baseline;
        gap: 0.32em;
        padding: 0 2px 0 6px;
        line-height: 1.2;
        font-size: 17px;
        font-style: italic;
    }

    .nt-undo svg {
        --capital-height: 0.765em;
        flex: none;
        height: var(--capital-height);
        aspect-ratio: 16 / 12.4;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .nt-undo:hover:not(:disabled) {
        text-decoration: underline;
        text-underline-offset: 3px;
    }

    .nt-masthead-rule {
        padding: 0 16px;
    }

    @media (max-width: 639px) {
        .nt-masthead-block {
            padding-bottom: 4px;
        }

        .nt-masthead {
            padding: 6px 6px 3px;
        }

        .nt-masthead-turn {
            font-size: 16px;
        }

        .nt-masthead-time {
            font-size: 16px;
        }

        .nt-undo {
            font-size: 14px;
        }

        .nt-masthead-rule {
            padding: 0 6px;
        }
    }
</style>
