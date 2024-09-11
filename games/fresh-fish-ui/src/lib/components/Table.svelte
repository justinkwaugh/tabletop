<script lang="ts">
    import { GameSessionMode, ScalingWrapper, AdminPanel } from '@tabletop/frontend-components'
    import Board from '$lib/components/Board.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'

    import { getContext } from 'svelte'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import WaitingPanel from '$lib/components/WaitingPanel.svelte'
    import GameDataPanel from '$lib/components/GameDataPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import { Button, ButtonGroup } from 'flowbite-svelte'
    import { generateBoard, Scorer } from '@tabletop/fresh-fish'
    import { generateSeed, getPrng, range } from '@tabletop/common'
    let gameSession = getContext('gameSession') as FreshFishGameSession

    function generateABoard(size: number) {
        const seed = generateSeed()
        const prng = getPrng(seed)
        generateBoard(size, prng)
    }
</script>

<!-- Full Height and Width with 8px padding-->
<div class="p-2 w-full h-full flex flex-row justify-between items-start">
    <!--  Panels have screen minus the height of navbar plus padding -->
    <div
        class="flex flex-col space-y-2 shrink-0 grow-0 w-[320px] min-w-[320px] max-w-[90vw] sm:h-[calc(100dvh-84px)] h-[calc(100dvh-116px)]"
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
        <div class="grow-0 shrink-0">
            <PlayersPanel />
        </div>
        <History />
    </div>
    <div
        class="ms-2 pe-2 sm:pe-0 shrink grow sm:min-w-[320px] min-w-[90vw] sm:h-[calc(100dvh-84px)] h-[calc(100dvh-116px)] flex flex-col"
    >
        <!--  Top part is not allowed to shrink -->
        <div class="shrink-0">
            {#if gameSession.gameState.result}
                <GameEndPanel />
            {:else if gameSession.mode === GameSessionMode.Play}
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
