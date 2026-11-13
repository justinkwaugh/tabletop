<script lang="ts">
    import { MachineState } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import BuildPanel from './BuildPanel.svelte'
    import GameEndSummary from './GameEndSummary.svelte'
    import HistoryDescription from './HistoryDescription.svelte'
    import JourneyPanel from './JourneyPanel.svelte'
    import PassPanel from './PassPanel.svelte'
    import TakeSharePanel from './TakeSharePanel.svelte'
    import WaitingView from './WaitingView.svelte'

    const gameSession = getGameSession()

    const machineState = $derived(gameSession.gameState.machineState)
</script>

<!-- docs/game-ui-layout.md, Action area views: exactly one of these. -->
<div
    class="mx-2 rounded-xl border border-rtr-line bg-rtr-panel px-3 py-2 text-rtr-ink shadow-sm max-sm:mx-1 max-sm:px-2 max-sm:py-1.5"
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
    {:else if gameSession.journeyPossible}
        <JourneyPanel />
    {:else if machineState === MachineState.Riding}
        <PassPanel />
    {:else}
        <WaitingView />
    {/if}
</div>
