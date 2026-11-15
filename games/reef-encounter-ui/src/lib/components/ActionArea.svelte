<script lang="ts">
    import FeedParrotfishPanel from './action/FeedParrotfishPanel.svelte'
    import LarvaCubePanel from './action/LarvaCubePanel.svelte'
    import WaitingPanel from './action/WaitingPanel.svelte'
    import HistoryStepPanel from './action/HistoryStepPanel.svelte'
    import TurnPanel from './action/TurnPanel.svelte'
    import FinalTurnPanel from './action/FinalTurnPanel.svelte'
    import GameEndPanel from './action/GameEndPanel.svelte'
    import FinalTurnsBanner from './action/FinalTurnsBanner.svelte'
    import { MachineState } from '@tabletop/reef-encounter'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
</script>

<section class="card" class:settling={gameSession.busy} aria-label="Actions">
    {#if gameSession.gameState.machineState === MachineState.FinalTurns && !gameSession.gameState.result}
        <FinalTurnsBanner />
    {/if}
    {#if gameSession.isViewingHistory}
        <HistoryStepPanel />
    {:else if gameSession.gameState.result}
        <GameEndPanel />
    {:else if gameSession.canFeedParrotfish}
        <FeedParrotfishPanel />
    {:else if gameSession.canChooseLarvaCubes}
        <LarvaCubePanel />
    {:else if gameSession.isTakingTurn}
        <TurnPanel />
    {:else if gameSession.isTakingFinalTurn}
        <FinalTurnPanel />
    {:else}
        <WaitingPanel />
    {/if}
</section>

<style>
    .settling {
        pointer-events: none;
    }

    /* Inside the paper the ink colours turn dark, so the panels within need none of their own. */
    .card {
        --reef-ink: var(--reef-paper-ink);
        --reef-muted: var(--reef-paper-muted);
        --reef-rule: rgb(29 71 63 / 0.18);
        position: relative;
        isolation: isolate;
        margin: 0 8px 10px;
        padding: 16px 18px 14px;
        color: var(--reef-ink);
    }

    .card::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: var(--reef-wobble);
        background:
            radial-gradient(ellipse 40% 60% at 8% 20%, rgb(140 198 179 / 0.16), transparent 70%),
            radial-gradient(ellipse 30% 70% at 92% 80%, rgb(238 123 90 / 0.08), transparent 70%),
            radial-gradient(ellipse 70% 90% at 50% 0, #fffdf6, var(--reef-paper) 70%);
        box-shadow:
            inset 0 0 0 1px rgb(255 255 255 / 0.9),
            inset 0 0 22px rgb(170 150 105 / 0.18),
            0 8px 18px -8px rgb(4 30 26 / 0.55);
        filter: url(#reef-rough-edge);
    }

    .card :global(.warning) {
        margin-top: 8px;
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 14px;
        color: #7a3313;
        background: rgb(238 123 90 / 0.14);
        box-shadow: inset 3px 0 0 var(--reef-coral);
    }

    .card :global(.prompt) {
        font-size: 19px;
        line-height: 1.25;
    }

    .card :global(.detail) {
        font-size: 14px;
        color: var(--reef-muted);
    }

    .card :global(.detail + .detail) {
        margin-top: 2px;
    }

    @media (max-width: 639px) {
        .card {
            padding: 12px 10px 10px;
        }

        .card :global(.prompt) {
            font-size: 16px;
        }
    }
</style>
