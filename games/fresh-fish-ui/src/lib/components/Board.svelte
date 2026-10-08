<script lang="ts">
    import Cell from '$lib/components/Cell.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    let gameSession = getGameSession()
</script>

<div
    class="land grid"
    style="grid-template-rows: repeat({gameSession.gameState.board.cells
        .length}, 100px); grid-template-columns: repeat({gameSession.gameState.board.cells[0]
        .length}, 100px); column-gap: 0; row-gap: 0;"
>
    {#each gameSession.gameState.board.cells ?? [] as row, y (y)}
        {#each row as cell, x (x)}
            <Cell {cell} coords={[x, y]} />
        {/each}
    {/each}
</div>

<style>
    .land {
        filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.5));
    }
</style>
