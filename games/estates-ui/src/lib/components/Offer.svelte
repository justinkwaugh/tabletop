<script lang="ts">
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { fadeIn, fadeOut } from '$lib/utils/animations'
    import { range, sameCoordinates, type OffsetCoordinates } from '@tabletop/common'
    import { BarrierDirection, Cube, MachineState, PieceType } from '@tabletop/estates'
    import { useThrelte } from '@threlte/core'

    import { getContext } from 'svelte'

    let { hidden }: { hidden?: boolean } = $props()
    let gameSession = getContext('gameSession') as EstatesGameSession
    let ref: HTMLDivElement
    let { size } = useThrelte()

    let canPlace = $derived(
        gameSession.isMyTurn && gameSession.gameState.machineState === MachineState.StartOfTurn
    )

    let placeableCubes = $derived(gameSession.gameState.placeableCubes())

    function chooseCube(cube: Cube | null | undefined, coords: OffsetCoordinates) {
        if (!cube || !canPlace || !placeableCubes.find((c) => sameCoordinates(c, coords))) {
            return
        }

        gameSession.startAuction(cube)
    }

    async function chooseRoof() {
        if (!canPlace) {
            return
        }
        const index = gameSession.gameState.visibleRoofs.findIndex((r) => r)
        await gameSession.drawRoof(index)
    }

    function chooseBarrier(value: number) {
        if (!canPlace) {
            return
        }
        gameSession.startAuction({
            pieceType: PieceType.Barrier,
            value,
            direction: BarrierDirection.Unplaced
        })
    }

    function chooseMayor() {
        if (!canPlace) {
            return
        }
        gameSession.startAuction({ pieceType: PieceType.Mayor })
    }

    function chooseCancel() {
        if (!canPlace) {
            return
        }
        gameSession.startAuction({ pieceType: PieceType.CancelCube })
    }

    $effect(() => {
        if (hidden) {
            fadeOut({ object: ref, duration: 0.2 })
        } else {
            fadeIn({ object: ref, duration: 0.2 })
        }
    })
</script>

{#snippet barrier(stripes: number)}
    <div
        class="flex justify-around items-start rounded-sm w-6 h-6 font-bold text-xl px-1 select-none bg-gray-500"
    >
        {#each range(0, stripes) as value}
            <span class="w-1 bg-[#DDDDDD] h-4"></span>
        {/each}
    </div>
{/snippet}

<div bind:this={ref} class="p-2 flex justify-center bg-gray-900 opacity-0">
    <div
        class="flex justify-between items-center {$size.width < 380
            ? 'gap-x-1'
            : $size.width < 400
              ? 'gap-x-4'
              : 'gap-x-8'}"
    >
        <button
            tabindex="-1"
            onclick={() => chooseRoof()}
            class="flex flex-col justify-center items-center bg-gray-200 rounded-lg py-2 {$size.width <
            380
                ? 'px-1'
                : 'px-2'} gap-y-2"
        >
            <div
                class="flex flex-col justify-center items-center text-[#DDDDDD] w-8 h-8 font-bold text-[18px] select-none bg-[#222222] leading-none {canPlace
                    ? 'cursor-default'
                    : 'cursor-pointer'}"
            >
                <h1>{gameSession.gameState.roofs.remaining}</h1>
                <h1 class=" text-[.65rem] leading-none">left</h1>
            </div>
            <h1 class="text-xs text-black font-semibold text-center leading-none">DRAW ROOF</h1>
        </button>
        <div class="flex flex-col justify-center items-center gap-y-1">
            {#each gameSession.gameState.cubes as cubeRow, row}
                <div class="flex items-center gap-x-1">
                    {#each cubeRow as cube, col}
                        <button
                            tabindex="-1"
                            onclick={() => chooseCube(cube, { row, col })}
                            class="flex justify-center items-center text-[#EEEEEE] rounded-sm w-6 h-6 font-bold text-xl select-none {cube
                                ? gameSession.getBgColor(gameSession.getCompanyColor(cube.company))
                                : 'bg-transparent'} {canPlace &&
                            !placeableCubes.find((c) => sameCoordinates(c, { row, col }))
                                ? 'opacity-30 cursor-default'
                                : 'cursor-pointer'}"
                        >
                            {cube?.value ?? ''}
                        </button>
                    {/each}
                </div>
            {/each}
        </div>
        <div class="flex justify-center items-center gap-x-1">
            {#if gameSession.gameState.barrierOne || gameSession.gameState.barrierTwo || gameSession.gameState.barrierThree}
                <div class="flex flex-col justify-center items-center gap-y-1">
                    {#if gameSession.gameState.barrierThree}
                        <button
                            tabindex="-1"
                            onclick={() => chooseBarrier(3)}
                            class={canPlace ? 'cursor-default' : 'cursor-pointer'}
                        >
                            {@render barrier(3)}
                        </button>
                    {/if}
                    {#if gameSession.gameState.barrierTwo}
                        <button
                            tabindex="-1"
                            onclick={() => chooseBarrier(2)}
                            class={canPlace ? 'cursor-default' : 'cursor-pointer'}
                        >
                            {@render barrier(2)}
                        </button>
                    {/if}
                    {#if gameSession.gameState.barrierOne}
                        <button
                            tabindex="-1"
                            onclick={() => chooseBarrier(1)}
                            class="w-6 h-6 {canPlace ? 'cursor-default' : 'cursor-pointer'}"
                        >
                            {@render barrier(1)}
                        </button>
                    {/if}
                </div>
            {/if}
            {#if gameSession.gameState.mayor || gameSession.gameState.cancelCube}
                <div class="flex flex-col justify-center items-center gap-y-1">
                    {#if gameSession.gameState.mayor}
                        <button
                            aria-label="mayor"
                            tabindex="-1"
                            onclick={() => chooseMayor()}
                            class="flex justify-center items-center text-[#DDDDDD] rounded-sm bg-gray-200 w-6 h-6 font-bold text-2xl select-none {canPlace
                                ? 'cursor-default'
                                : 'cursor-pointer'}"
                        >
                            <svg
                                width="20px"
                                height="20px"
                                viewBox="0 0 64 64"
                                xmlns="http://www.w3.org/2000/svg"
                                xmlns:xlink="http://www.w3.org/1999/xlink"
                                aria-hidden="true"
                                role="img"
                                class="iconify iconify--emojione-monotone"
                                preserveAspectRatio="xMidYMid meet"
                                ><path
                                    d="M61.338 41.881c-1.663-3.873-5.663-4.015-11.069-3.241c.041-9.028 1.562-17.65 4.452-27.072c1.344-3.374-8.67-9.501-22.72-9.567c-14.05.066-24.065 6.192-22.721 9.566c2.873 9.365 4.384 18.047 4.438 27.07c-5.399-.771-9.394-.627-11.057 3.243C-.961 49.077 10.487 62 32 62c21.514 0 32.961-12.923 29.338-20.119m-48.856 5.962s1.357-4.745 1.14-7.254c11.804 10.624 24.954 10.624 36.757 0c.045 2.56 1.139 7.254 1.139 7.254c-11.62 11.057-27.415 11.057-39.036 0"
                                    fill="#000000"
                                ></path></svg
                            >
                        </button>
                    {/if}
                    {#if gameSession.gameState.cancelCube}
                        <button
                            tabindex="-1"
                            onclick={() => chooseCancel()}
                            class="flex justify-center items-center text-[#DDDDDD] rounded-sm w-6 h-6 font-bold text-2xl select-none bg-gray-500 {canPlace
                                ? 'cursor-default'
                                : 'cursor-pointer'}"
                        >
                            {'X'}
                        </button>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</div>
