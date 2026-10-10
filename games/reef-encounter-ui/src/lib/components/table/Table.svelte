<script lang="ts">
    import ReefBoard from './ReefBoard.svelte'
    import OpenSea from './OpenSea.svelte'
    import type { BoardRotation } from '$lib/utils/artGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // The open sea stands upright at the left with its shrimp spaces on top, beside the reef
    // boards turned to landscape, two to a row: a shape that fills a wide screen.
    const OpenSeaRotation: BoardRotation = 270
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

<div class="flex items-center gap-4 p-4">
    <OpenSea rotation={OpenSeaRotation} />
    <div class="flex flex-col items-center gap-4">
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
</div>
