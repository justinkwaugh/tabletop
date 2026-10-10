<script lang="ts">
    import FeedParrotfishPanel from './action/FeedParrotfishPanel.svelte'
    import LarvaCubePanel from './action/LarvaCubePanel.svelte'
    import WaitingPanel from './action/WaitingPanel.svelte'
    import TurnPanel from './action/TurnPanel.svelte'
    import FinalTurnPanel from './action/FinalTurnPanel.svelte'
    import GameEndPanel from './action/GameEndPanel.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
</script>

<section class="card" aria-label="Actions">
    {#if gameSession.gameState.result && !gameSession.isViewingHistory}
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
    .card {
        margin: 0 8px 8px;
        padding: 10px 14px 12px;
        border-radius: 8px;
        background: rgb(0 0 0 / 0.26);
        box-shadow: inset 0 0 0 2px var(--reef-line);
    }

    .card :global(.prompt) {
        font-size: 18px;
    }

    .card :global(.detail) {
        font-size: 14px;
        color: var(--reef-muted);
    }

    @media (max-width: 639px) {
        .card {
            padding: 8px 10px 10px;
        }

        .card :global(.prompt) {
            font-size: 16px;
        }
    }
</style>
