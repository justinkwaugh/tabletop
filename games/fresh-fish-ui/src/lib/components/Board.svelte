<script lang="ts">
    import Cell from '$lib/components/Cell.svelte'
    import { getContext } from 'svelte'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    let gameSession = getContext('gameSession') as FreshFishGameSession
</script>

{#each gameSession.gameState.board.cells ?? [] as row, y}
    <div class="flex flex-row justify-start items-center">
        {#each row as cell, x}
            <Cell {cell} coords={[x, y]} />
        {/each}
    </div>
{/each}
