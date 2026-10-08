<script lang="ts">
    import { MachineState } from '@tabletop/kogge'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/story.js'
    import StoryLine from './ui/StoryLine.svelte'
    import StartCityPanel from './panels/StartCityPanel.svelte'
    import BiddingPanel from './panels/BiddingPanel.svelte'
    import GuildMasterPanel from './panels/GuildMasterPanel.svelte'
    import TurnPanel from './panels/TurnPanel.svelte'
    import SpoilsPanel from './panels/SpoilsPanel.svelte'
    import ExpelPanel from './panels/ExpelPanel.svelte'
    import WaitingPanel from './panels/WaitingPanel.svelte'
    import GameEndPanel from './panels/GameEndPanel.svelte'

    const gameSession = getGameSession()
    const machineState = $derived(gameSession.gameState.machineState)
    const historyStory = $derived(
        gameSession.currentAction ? describeAction(gameSession.currentAction) : undefined
    )
</script>

<div class="px-3 py-2 max-sm:px-2 max-sm:py-1 text-[#3f2a16]">
    {#if gameSession.isViewingHistory}
        <div class="kogge-prompt">
            {#if historyStory}<StoryLine story={historyStory} />{:else}The voyage begins{/if}
        </div>
    {:else if gameSession.gameState.result}
        <GameEndPanel />
    {:else if machineState === MachineState.ChoosingStartCities}
        <StartCityPanel />
    {:else if machineState === MachineState.Bidding}
        <BiddingPanel />
    {:else if machineState === MachineState.MovingGuildMaster}
        <GuildMasterPanel />
    {:else if !gameSession.canAct}
        <WaitingPanel />
    {:else if machineState === MachineState.TakingTurn}
        <TurnPanel />
    {:else if machineState === MachineState.ExpellingRaider}
        <ExpelPanel />
    {:else}
        <SpoilsPanel />
    {/if}
</div>
