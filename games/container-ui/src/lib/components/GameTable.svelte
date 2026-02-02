<script lang="ts">
    import {
        ScalingWrapper,
        HistoryControls,
        GameChat,
        DefaultTableLayout,
        DefaultTabs,
        CustomFont,
        GameSession
    } from '@tabletop/frontend-components'

    // import History from '$lib/components/History.svelte'
    // import PlayersPanel from '$lib/components/PlayersPanel.svelte'

    import type { ContainerGameSession } from '$lib/model/session.svelte'
    import type { HydratedContainerGameState, ContainerGameState } from '@tabletop/container'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let {
        gameSession
    }: { gameSession: GameSession<ContainerGameState, HydratedContainerGameState> } = $props()
    setGameSession(gameSession as ContainerGameSession)
</script>

<!-- Full Height and Width with 8px padding-->
<div class="bg-repeat" style="--chat-height-offset: 0px;">
    <DefaultTableLayout>
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <!-- <HistoryControls
                    borderClass="border-b-1 border-[#ad9c80]"
                    enabledColor="text-[#ad9c80]"
                    disabledColor="text-[#373128]"
                /> -->
            </div>
            <DefaultTabs
                fontClass="gap-1 sol-font uppercase font-size-sm tracking-widest"
                activeTabClass="py-1 px-1 border-1 border-transparent rounded-lg text-gray-200 text-md"
                inactiveTabClass="py-1 px-1 text-[#ad9c80] rounded-lg border-1 border-transparent hover:border-[#ad9c80] text-md"
            >
                {#snippet playersPanel()}
                    <!-- <PlayersPanel /> -->
                {/snippet}
                {#snippet history()}
                    <!-- <History /> -->
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-[#ad9c80]"
                        bgColor="bg-black"
                        inputBgColor="bg-black"
                        inputBorderColor="border-[#ad9c80]"
                        borderColor="border-[#ad9c80]"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <!--  Top part is not allowed to shrink -->
            <div class="shrink-0">
                {#if gameSession.gameState.result}
                    <!-- <GameEndPanel /> -->
                {:else}
                    <!-- <InformationPanel /> -->
                {/if}
            </div>
            <!--  Bottom part fills the remaining space, but hides overflow to keep it's height fixed.
              This allows the wrapper to scale to its bounds regardless of its content size-->
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left">
                    <div></div>
                    <!-- <Board /> -->
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
