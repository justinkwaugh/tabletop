<script lang="ts">
    import ReefBoard from './ReefBoard.svelte'
    import OpenSea from './OpenSea.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)

    const ReefsPerRow = 2
    const reefRows = $derived(
        Array.from({ length: Math.ceil(state.reefs.length / ReefsPerRow) }, (_, row) =>
            state.reefs.slice(row * ReefsPerRow, (row + 1) * ReefsPerRow)
        )
    )
</script>

<div class="flex items-center gap-6 p-6">
    <OpenSea />
    <div class="flex flex-col items-center gap-4">
        {#each reefRows as row, index (index)}
            <div class="flex gap-4">
                {#each row as reef (reef.boardId)}
                    <ReefBoard
                        {reef}
                        shrimps={state.shrimps.filter((shrimp) => shrimp.boardId === reef.boardId)}
                    />
                {/each}
            </div>
        {/each}
    </div>
</div>
