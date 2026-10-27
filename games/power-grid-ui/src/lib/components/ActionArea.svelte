<script lang="ts">
    import { MachineState } from '@tabletop/power-grid'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/describe.js'
    import Description from './Description.svelte'
    import WaitingView from './WaitingView.svelte'
    import GameEndPanel from './GameEndPanel.svelte'
    import ChoosePlantPanel from './actions/ChoosePlantPanel.svelte'
    import BiddingPanel from './actions/BiddingPanel.svelte'
    import ScrapPanel from './actions/ScrapPanel.svelte'
    import BuyPanel from './actions/BuyPanel.svelte'
    import BuildPanel from './actions/BuildPanel.svelte'
    import PowerPanel from './actions/PowerPanel.svelte'
    import PlaceTrustPanel from './actions/PlaceTrustPanel.svelte'

    const session = getGameSession()
    const historyLines = $derived(
        session.currentAction ? describeAction(session.currentAction) : []
    )
</script>

<div class="action-area">
    {#if session.isViewingHistory}
        {#each historyLines as line, index (index)}
            <p class="history-line"><Description {line} /></p>
        {:else}
            <p class="history-line">The game begins.</p>
        {/each}
    {:else if session.gameState.result}
        <GameEndPanel />
    {:else if session.canAct}
        {#if session.machineState === MachineState.PlacingTrust}
            <PlaceTrustPanel />
        {:else if session.machineState === MachineState.ChoosingPlant}
            <ChoosePlantPanel />
        {:else if session.machineState === MachineState.Bidding}
            <BiddingPanel />
        {:else if session.machineState === MachineState.ScrappingPlant}
            <ScrapPanel />
        {:else if session.machineState === MachineState.BuyingResources}
            <BuyPanel />
        {:else if session.machineState === MachineState.Building}
            <BuildPanel />
        {:else if session.machineState === MachineState.Powering}
            <PowerPanel />
        {/if}
    {:else}
        <WaitingView />
    {/if}
</div>

<style>
    .action-area {
        margin: 0 12px;
        padding: 10px 14px;
        border-radius: 8px;
        background: #1b201b;
        border: 2px solid #3b4529;
        min-height: 62px;
        font-size: 17px;
    }
    .history-line {
        font-size: 17px;
    }
    .action-area :global(.prompt) {
        font-size: 18px;
        font-weight: 600;
    }
    .action-area :global(.note) {
        color: #cfd4bd;
        font-size: 15px;
    }
    .action-area :global(.prompt-row) {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 16px;
    }
    .action-area :global(.column) {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .action-area :global(.choice) {
        display: flex;
        gap: 14px;
        align-items: center;
    }
    .action-area :global(.details) {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .action-area :global(.controls),
    .action-area :global(.cards) {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
    }
    .action-area :global(.btn) {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 6px;
        padding: 4px 16px;
        font-size: 18px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .action-area :global(.btn.primary) {
        background: #f3c534;
        color: #231d0c;
        border: 2px solid #f3c534;
    }
    .action-area :global(.btn.primary:hover) {
        background: #ffd64d;
    }
    .action-area :global(.btn.primary:disabled) {
        background: #6d6550;
        border-color: #6d6550;
        color: #2b2722;
    }
    .action-area :global(.btn.secondary) {
        border: 2px solid #8d987a;
        color: #ecebe1;
    }
    .action-area :global(.btn.secondary:hover) {
        background: rgb(255 255 255 / 0.08);
    }
    @media (max-width: 639px) {
        .action-area {
            margin: 0 4px;
            padding: 6px 8px;
            font-size: 15px;
        }
        .action-area :global(.prompt) {
            font-size: 15px;
        }
        .action-area :global(.btn) {
            font-size: 15px;
            padding: 3px 10px;
        }
    }
</style>
