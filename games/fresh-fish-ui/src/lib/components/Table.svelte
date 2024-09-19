<script lang="ts">
    import {
        GameSessionMode,
        ScalingWrapper,
        AdminPanel,
        HistoryControls
    } from '@tabletop/frontend-components'
    import Board from '$lib/components/Board.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'

    import { getContext, onMount } from 'svelte'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import WaitingPanel from '$lib/components/WaitingPanel.svelte'
    import GameDataPanel from '$lib/components/GameDataPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import { Button, ButtonGroup, Tabs, TabItem } from 'flowbite-svelte'
    import { UserCircleSolid, ClockSolid, AnnotationSolid } from 'flowbite-svelte-icons'
    import { generateBoard } from '@tabletop/fresh-fish'
    import { generateSeed, getPrng, range } from '@tabletop/common'
    import LastActionDescription from './LastActionDescription.svelte'
    let gameSession = getContext('gameSession') as FreshFishGameSession

    function generateABoard(size: number) {
        const seed = generateSeed()
        const prng = getPrng(seed)
        generateBoard(size, prng)
    }

    let activeTabClasses =
        'py-1 px-3 bg-gray-300 border-2 border-transparent rounded-lg text-gray-900 box-border'
    let inactiveTabClasses =
        'text-gray-200 py-1 px-3 rounded-lg border-2 border-transparent hover:border-gray-700 box-border'

    let table: HTMLDivElement
    onMount(() => {
        table.scrollTo({ left: table.scrollWidth, behavior: 'instant' })
    })
</script>

<!-- Full Height and Width with 8px padding-->
<div
    class="sm:hidden shrink-0 grow-0 p-2 h-[42px] flex flex-col justify-center items-center border-gray-700 border-b-2"
>
    <HistoryControls />
</div>
<div bind:this={table} class="flex w-screen overflow-auto max-sm:h-[calc(100vh-142px)]">
    <div class="p-2 w-full h-full flex flex-row justify-between items-start">
        <!--  Panels have screen minus the height of navbar plus padding -->
        <div
            class="flex flex-col gap-2 shrink-0 grow-0 w-[320px] min-w-[320px] max-w-[90vw] sm:h-[calc(100dvh-84px)] h-[calc(100dvh-158px)]"
        >
            {#if gameSession.showDebug}
                <div class="flex flex-row justify-center items-center">
                    <h1 class="text-lg text-white me-4">Test Layout</h1>
                    <ButtonGroup>
                        {#each range(2, 4) as i}
                            <Button value={i} onclick={() => generateABoard(i)}>{i}</Button>
                        {/each}
                    </ButtonGroup>
                </div>
            {/if}
            <div
                class="shrink-0 grow-0 p-2 rounded-lg border-2 border-gray-700 bg-transparent h-[42px] max-sm:hidden"
            >
                <HistoryControls />
            </div>
            <Tabs
                tabStyle="pill"
                contentClass="p-0 bg-transparent h-full overflow-scroll rounded-lg"
            >
                <TabItem open activeClasses={activeTabClasses} inactiveClasses={inactiveTabClasses}>
                    <div slot="title" class="flex items-center gap-2">
                        <UserCircleSolid size="md" />
                        Players
                    </div>

                    <PlayersPanel />
                </TabItem>
                <TabItem activeClasses={activeTabClasses} inactiveClasses={inactiveTabClasses}>
                    <div slot="title" class="flex items-center gap-2">
                        <ClockSolid size="md" />
                        History
                    </div>
                    <History />
                </TabItem>
                <TabItem activeClasses={activeTabClasses} inactiveClasses={inactiveTabClasses}>
                    <div slot="title" class="flex items-center gap-2">
                        <AnnotationSolid size="md" />
                        Chat
                    </div>
                </TabItem>
            </Tabs>
        </div>
        <div
            class="ms-2 pe-2 sm:pe-0 shrink grow sm:min-w-[320px] min-w-[90vw] sm:h-[calc(100dvh-84px)] h-[calc(100dvh-158px)] flex flex-col overflow-auto"
        >
            <!--  Top part is not allowed to shrink -->
            <div class="shrink-0">
                {#if gameSession.gameState.result}
                    <GameEndPanel />
                {:else if gameSession.mode === GameSessionMode.History}
                    <LastActionDescription />
                {:else if gameSession.mode === GameSessionMode.Play}
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
            <div class="grow-0 overflow-hidden min-h-[200px]" style="flex:1;">
                <ScalingWrapper justify={'center'} controls={'top-right'}>
                    <div class="w-fit h-fit">
                        <GameDataPanel />
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
</div>
