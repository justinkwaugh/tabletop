<script lang="ts">
    import Cell from '$lib/components/Cell.svelte'
import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    let gameSession = getGameSession() as FreshFishGameSession
</script>

<div
    class="grid"
    style="grid-template-rows: repeat({gameSession.gameState.board.cells
        .length}, 100px); grid-template-columns: repeat({gameSession.gameState.board.cells[0]
        .length}, 100px); column-gap: 1px; row-gap: 1px;"
>
    {#each gameSession.gameState.board.cells ?? [] as row, y}
        {#each row as cell, x}
            <Cell {cell} coords={[x, y]} />
        {/each}
    {/each}
</div>
