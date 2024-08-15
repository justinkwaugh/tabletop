<script lang="ts">
    import { GameSessionMode, ScalingWrapper } from '@tabletop/frontend-components'
    import Board from '$lib/components/Board.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'

    import { getContext } from 'svelte'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import AdminPanel from '$lib/components/AdminPanel.svelte'
    import WaitingPanel from '$lib/components/WaitingPanel.svelte'
    import GameDataPanel from '$lib/components/GameDataPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import { Button, ButtonGroup } from 'flowbite-svelte'
    import { generateBoard, Scorer } from '@tabletop/fresh-fish'
    import { generateSeed, getPrng, range } from '@tabletop/common'
    let gameSession = getContext('gameSession') as FreshFishGameSession

    function generateABoard(size: number) {
        const seed = generateSeed()
        console.log('seed:', seed)
        const prng = getPrng(seed)
        generateBoard(size, prng)
    }
</script>

<div class="p-2 w-full h-full flex flex-row justify-between items-start">
    <div class="flex flex-col space-y-2 shrink-0 grow-0 w-[320px] h-[calc(100vh-76px)]">
        {#if gameSession.isAdmin}
            <div class="flex flex-row justify-center items-center">
                <h1 class="text-lg text-white me-4">Test Layout</h1>
                <ButtonGroup>
                    {#each range(2, 4) as i}
                        <Button value={i} onclick={() => generateABoard(i)}>{i}</Button>
                    {/each}
                </ButtonGroup>
            </div>
            <Button
                onclick={() => {
                    const scorer = new Scorer(gameSession.hydratedState)
                    console.log(scorer.calculateScores())
                }}>Re-score</Button
            >
        {/if}
        <div class="grow-0 shrink-0">
            <PlayersPanel />
        </div>
        <History />
    </div>
    <div class="ms-2 shrink grow min-w-[300px] h-[calc(100vh-76px)] overflow-auto">
        {#if gameSession.gameState.result}
            <GameEndPanel />
        {:else if gameSession.mode === GameSessionMode.Play}
            {#if gameSession.isMyTurn}
                <ActionPanel />
            {:else}
                <WaitingPanel />
            {/if}
        {/if}

        <ScalingWrapper justify={'center'}>
            <div class="w-fit h-fit">
                <GameDataPanel />
                <Board />
            </div>
        </ScalingWrapper>
    </div>
    {#if gameSession.isAdmin}
        <div class="flex flex-col space-y-2 shrink-0 grow-0 w-[400px]">
            <AdminPanel />
        </div>
    {/if}
</div>
