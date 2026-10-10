<script lang="ts">
    import ReefBoard from './ReefBoard.svelte'
    import OpenSea from './OpenSea.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
</script>

<div class="flex flex-col items-center gap-6 p-6">
    <OpenSea />
    <div class="flex gap-4">
        {#each state.reefs as reef (reef.boardId)}
            <ReefBoard
                {reef}
                shrimps={state.shrimps.filter((shrimp) => shrimp.boardId === reef.boardId)}
            />
        {/each}
    </div>
</div>
