<script lang="ts">
    import {
        GameSessionMode,
        ScalingWrapper,
        AdminPanel,
        HistoryControls
    } from '@tabletop/frontend-components'
    import Board from '$lib/components/Board.svelte'
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import Phase from '$lib/components/Phase.svelte'
    import BidBoard from '$lib/components/BidBoard.svelte'
    import { MachineState } from '@tabletop/kaivai'
    import { TabItem, Tabs } from 'flowbite-svelte'
    import { UserCircleSolid, ClockSolid } from 'flowbite-svelte-icons'
    import History from './History.svelte'
    let gameSession = getContext('gameSession') as KaivaiGameSession

    let activeTabClasses = 'py-2 px-3 bg-[#634a11] rounded-lg text-gray-200 h-[42px] box-border'
    let inactiveTabClasses =
        'text-[#634a11] py-2 px-3 h-[42px] rounded-lg border-2 border-transparent hover:border-[#634a11] box-border'
</script>

<!-- Full Height and Width with 8px padding-->
<div class="p-2 w-full h-full flex flex-row justify-between items-start bg-[#f5e397]">
    <!--  Panels have screen minus the height of navbar plus padding -->
    <div
        class="flex flex-col space-y-2 shrink-0 grow-0 w-[320px] min-w-[320px] max-w-[90vw] sm:h-[calc(100vh-84px)] h-[calc(100vh-116px)]"
    >
        <div class="py-2 rounded-lg bg-[#634a11] h-[42px]">
            <HistoryControls />
        </div>
        <Tabs tabStyle="pill" contentClass="p-0 bg-transparent" activeClasses="p-2 kaivai-font">
            <TabItem
                open
                defaultClass="uppercase kaivai-font"
                activeClasses={activeTabClasses}
                inactiveClasses={inactiveTabClasses}
            >
                <div slot="title" class="flex items-center gap-2">
                    <UserCircleSolid size="md" />
                    Players
                </div>

                <PlayersPanel />
            </TabItem>
            <TabItem
                defaultClass="uppercase kaivai-font"
                activeClasses={activeTabClasses}
                inactiveClasses={inactiveTabClasses}
            >
                <div slot="title" class="flex items-center gap-2">
                    <ClockSolid size="md" />
                    History
                </div>
                <div class="h-[600px]">
                    <History />
                </div>
            </TabItem>
        </Tabs>

        <!-- <History /> -->
    </div>
    <div
        class="ms-2 pe-2 sm:pe-0 shrink grow sm:min-w-[320px] min-w-[90vw] sm:h-[calc(100vh-84px)] h-[calc(100vh-116px)] flex flex-col"
    >
        <!--  Top part is not allowed to shrink -->
        <div class="shrink-0">
            <!-- {#if gameSession.gameState.result}
                <GameEndPanel />
            {:else if gameSession.mode === GameSessionMode.Play}-->
            <Phase />
            {#if gameSession.isMyTurn}
                <ActionPanel />
                <!-- {:else}
                    <WaitingPanel /> -->
            {/if}
            <!-- {/if}  -->
        </div>
        <!--  Bottom part fills the remaining space, but hides overflow to keep it's height fixed.
              This allows the wrapper to scale to its bounds regardless of its content size-->
        <div class="grow-0 overflow-hidden" style="flex:1;">
            <ScalingWrapper justify={'center'} controls={'none'}>
                <div class="w-fit h-fit">
                    {#if gameSession.gameState.machineState === MachineState.Bidding}
                        <BidBoard />
                    {/if}
                    <Board />
                </div>
            </ScalingWrapper>
        </div>
    </div>
    {#if gameSession.showDebug}
        <div class="flex flex-col space-y-2 shrink-0 grow-0 w-[400px]">
            <AdminPanel />
        </div>
    {/if}
</div>

<style global>
    @font-face {
        font-family: 'stacatto';
        src: url('/stacatto222bt.woff') format('woff');
    }

    :global(.kaivai-font) {
        font-family: 'stacatto', ui-sans-serif, system-ui, sans-serif;
    }

    :global(.text-shadow) {
        text-shadow: 2px 3px 6px black;
    }
</style>
