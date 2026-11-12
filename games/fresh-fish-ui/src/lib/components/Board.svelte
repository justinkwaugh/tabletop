<script lang="ts">
    import Cell from '$lib/components/Cell.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { CELL_SIZE, SHADOW_MARGIN, landShadowImage } from '$lib/utils/landShape.js'
    let gameSession = getGameSession()

    let shadow = $derived(landShadowImage(gameSession.gameState.board.cells))
</script>

<div
    class="land grid"
    style="grid-template-rows: repeat({gameSession.gameState.board.cells
        .length}, {CELL_SIZE}px); grid-template-columns: repeat({gameSession.gameState.board
        .cells[0].length}, {CELL_SIZE}px); column-gap: 0; row-gap: 0;"
>
    <!-- Positioned before the squares, so they paint over it. -->
    <div
        class="land-shadow"
        aria-hidden="true"
        style:inset="-{SHADOW_MARGIN}px"
        style:background-image={`url("${shadow}")`}
    ></div>
    {#each gameSession.gameState.board.cells ?? [] as row, y (y)}
        {#each row as cell, x (x)}
            <Cell {cell} coords={[x, y]} />
        {/each}
    {/each}
</div>

<style>
    .land {
        position: relative;
    }
    .land-shadow {
        position: absolute;
        background-size: 100% 100%;
        pointer-events: none;
    }
</style>
