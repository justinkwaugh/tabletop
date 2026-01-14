<script lang="ts">
    import {
        GameSessionMode,
        ScalingWrapper,
        DefaultSideContent,
        DefaultTableLayout,
        GameSession
    } from '@tabletop/frontend-components'
    import Board from '$lib/components/Board.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'

    import { onMount } from 'svelte'
    import type { BridgesGameSession } from '$lib/model/BridgesGameSession.svelte'
    import type {
        BridgesGameState,
        HydratedBridgesGameState
    } from '@tabletop/bridges-of-shangri-la'
    import WaitingPanel from '$lib/components/WaitingPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import LastActionDescription from './LastActionDescription.svelte'
    import { setGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<BridgesGameState, HydratedBridgesGameState> } =
        $props()

    // svelte-ignore state_referenced_locally
    setGameSession(gameSession as BridgesGameSession)
    let table: HTMLDivElement

    onMount(() => {
        table.scrollTo({ left: table.scrollWidth, behavior: 'instant' })
    })
</script>

<!-- Full Height and Width with 8px padding-->
<div bind:this={table}>
    <DefaultTableLayout>
        {#snippet sideContent()}
            <DefaultSideContent>
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
            </DefaultSideContent>
        {/snippet}
        {#snippet gameContent()}
            <!--  Top part is not allowed to shrink -->
            <div class="shrink-0">
                {#if gameSession.gameState.result}
                    <GameEndPanel />
                {:else if gameSession.isViewingHistory}
                    <LastActionDescription />
                {:else if gameSession.isPlayable}
                    <LastActionDescription />
                    {#if gameSession.isMyTurn}
                        <ActionPanel />
                    {:else}
                        <WaitingPanel />
                    {/if}
                {/if}
            </div>
            <!--  Bottom part fills the remaining space, but hides overflow to keep it's height fixed.
              This allows the wrapper to scale to its bounds regardless of its content size-->
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="top-left">
                    <Board />
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
