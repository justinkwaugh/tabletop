<script lang="ts">
    import {
        ScalingWrapper,
        DefaultSideContent,
        DefaultTableLayout,
        GameSession,
        GameChat,
        HistoryControls,
        DefaultTabs
    } from '@tabletop/frontend-components'

    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'

    import type { BusGameSession } from '$lib/model/session.svelte'
    import type { HydratedBusGameState, BusGameState } from '@tabletop/bus'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let { gameSession }: { gameSession: GameSession<BusGameState, HydratedBusGameState> } = $props()
    setGameSession(gameSession as BusGameSession)
</script>

<!-- Full Height and Width with 8px padding-->
<div class="bg-[#f0f1ec]" style="--chat-height-offset: 0px;">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls enabledColor="text-[#333333]" disabledColor="text-[#cccccc]" />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls enabledColor="text-[#333333]" disabledColor="text-[#cccccc]" />
            </div>
            <DefaultTabs
                playersTitle="Drivers"
                activeTabClass="py-1 px-3 bg-[#333333] border-2 border-transparent rounded-lg text-gray-200 "
                inactiveTabClass="text-[#333333] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#333333]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-[#8d794d]"
                        bgColor="bg-[#302408]"
                        inputBgColor="bg-[#634a11]"
                        inputBorderColor="border-[#302408]"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <!--  Top part is not allowed to shrink -->
            <div class="shrink-0">
                <Header />
                <ActionPanel />
            </div>
            <!--  Bottom part fills the remaining space, but hides overflow to keep it's height fixed.
              This allows the wrapper to scale to its bounds regardless of its content size-->
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left">
                    <Board />
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
