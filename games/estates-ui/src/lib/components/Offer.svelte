<script lang="ts">
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { sameCoordinates, type OffsetCoordinates } from '@tabletop/common'
    import { Cube, MachineState } from '@tabletop/estates'

    import { getContext } from 'svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

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
</script>

<div class="p-2 flex justify-center">
    <div class="flex flex-col justify-center items-center gap-y-1">
        {#each gameSession.gameState.cubes as cubeRow, row}
            <div class="flex items-center gap-x-1">
                {#each cubeRow as cube, col}
                    <button
                        tabindex="-1"
                        onclick={() => chooseCube(cube, { row, col })}
                        class="flex justify-center items-center text-[#DDDDDD] w-8 h-8 font-bold text-2xl select-none {cube
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
</div>
