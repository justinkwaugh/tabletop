<script lang="ts">
    import {
        ScalingWrapper,
        DefaultTableLayout,
        HistoryControls,
        DefaultTabs,
        GameChat,
        CustomFont,
        GameSession
    } from '@tabletop/frontend-components'
    import Board from '$lib/components/Board.svelte'
    import { onMount } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import Phase from '$lib/components/Phase.svelte'
    import BidBoard from '$lib/components/BidBoard.svelte'
    import { ActionType, MachineState } from '@tabletop/kaivai'
    import type { HydratedKaivaiGameState, KaivaiGameState } from '@tabletop/kaivai'
    import History from '$lib/components/History.svelte'
    import LastHistoryDescription from '$lib/components/LastHistoryDescription.svelte'
    import WaitingPanel from '$lib/components/WaitingPanel.svelte'
    import EndOfGamePanel from './EndOfGamePanel.svelte'
    import KaivaiFont from '$lib/fonts/stacatto222bt.woff'
    import { setGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let {
        gameSession
    }: { gameSession: GameSession<KaivaiGameState, HydratedKaivaiGameState> } = $props()

    setGameSession(gameSession as KaivaiGameSession)

    let showBidBoard = $derived.by(() => {
        if (gameSession.isPlayable) {
            return gameSession.gameState.machineState === MachineState.Bidding
        }
        if (gameSession.isViewingHistory) {
            return (
                gameSession.currentAction && gameSession.currentAction.type === ActionType.PlaceBid
            )
        }

        return false
    })
    let table: HTMLDivElement
    onMount(() => {
        table.scrollTo({ left: table.scrollWidth, behavior: 'instant' })
    })
</script>

<CustomFont fontFamily="stacatto" url={KaivaiFont} format="woff" />

<div bind:this={table} class="bg-[#f5e397]">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                borderClass="border-[#634a11] border-b-2"
                enabledColor="text-[#634a11]"
                disabledColor="text-[#cabb7a]"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    borderClass="rounded-lg border-2 border-[#634a11]"
                    enabledColor="text-[#634a11]"
                    disabledColor="text-[#cabb7a]"
                />
            </div>
            <DefaultTabs
                fontClass="kaivai-font uppercase"
                activeTabClass="py-1 px-3 bg-[#634a11] border-2 border-transparent rounded-lg text-gray-200 text-md"
                inactiveTabClass="text-[#634a11] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#634a11] text-md"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor={'text-[#8d794d]'}
                        bgColor={'bg-[#302408]'}
                        inputBgColor={'bg-[#634a11]'}
                        inputBorderColor={'border-[#302408]'}
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <!--  Top part is not allowed to shrink -->
            <div class="shrink-0">
                <Phase />

                {#if gameSession.isViewingHistory}
                    <LastHistoryDescription />
                {:else if gameSession.gameState.result}
                    <EndOfGamePanel />
                {:else if gameSession.isPlayable}
                    <LastHistoryDescription />
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
                <ScalingWrapper justify={'center'} controls={'bottom-left'}>
                    <div class="w-fit h-fit">
                        {#if showBidBoard}
                            <BidBoard />
                        {/if}
                        <Board />
                    </div>
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style global>
    :global(.kaivai-font) {
        font-family: 'stacatto', ui-sans-serif, system-ui, sans-serif;
    }

    :global(.text-shadow) {
        text-shadow: 2px 3px 6px black;
    }
</style>
