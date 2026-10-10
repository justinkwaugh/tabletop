<script lang="ts">
    import ReefBoard from './ReefBoard.svelte'
    import OpenSea from './OpenSea.svelte'
    import type { BoardRotation } from '$lib/utils/artGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Turned to landscape, the boards fit two to a row under the open sea in less height.
    const BoardRotationOnTable: BoardRotation = 90
    const ReefsPerRow = 2

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const reefRows = $derived(
        Array.from({ length: Math.ceil(state.reefs.length / ReefsPerRow) }, (_, row) =>
            state.reefs.slice(row * ReefsPerRow, (row + 1) * ReefsPerRow)
        )
    )
</script>

<div class="flex flex-col items-center gap-4 p-4">
    <OpenSea />
    {#each reefRows as row, index (index)}
        <div class="flex gap-4">
            {#each row as reef (reef.boardId)}
                <ReefBoard
                    {reef}
                    rotation={BoardRotationOnTable}
                    shrimps={state.shrimps.filter((shrimp) => shrimp.boardId === reef.boardId)}
                />
            {/each}
        </div>
    {/each}
</div>
