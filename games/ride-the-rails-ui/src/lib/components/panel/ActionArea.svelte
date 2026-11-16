<script lang="ts">
    import { MachineState } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import BuildPanel from './BuildPanel.svelte'
    import GameEndSummary from './GameEndSummary.svelte'
    import HistoryDescription from './HistoryDescription.svelte'
    import JourneyPanel from './JourneyPanel.svelte'
    import TakeSharePanel from './TakeSharePanel.svelte'
    import WaitingView from './WaitingView.svelte'

    const gameSession = getGameSession()

    const machineState = $derived(gameSession.gameState.machineState)
</script>

<!-- docs/game-ui-layout.md, Action area views: exactly one of these, centred in the panel. -->
<div
    class="action rounded-xl border border-rtr-card-edge bg-rtr-panel px-3 py-2 text-rtr-ink shadow-sm max-sm:px-1.5 max-sm:py-[5px]"
>
    {#if gameSession.isViewingHistory}
        <HistoryDescription />
    {:else if gameSession.gameState.result}
        <GameEndSummary />
    {:else if !gameSession.isMyTurn}
        <WaitingView />
    {:else if machineState === MachineState.TakingShares}
        <TakeSharePanel />
    {:else if machineState === MachineState.Building}
        <BuildPanel />
    {:else if machineState === MachineState.Riding}
        <!-- R-3.3.1: a seat with no journey passes by itself, so a Ride turn always rides. -->
        <JourneyPanel />
    {:else}
        <WaitingView />
    {/if}
</div>

<style>
    /* Every view's rows and columns centre in the panel, the share buttons' row too. */
    .action {
        text-align: center;
    }

    .action :global(.flex),
    .action :global(.share-row) {
        justify-content: center;
    }

    .action :global(.flex-col) {
        align-items: center;
    }
</style>
