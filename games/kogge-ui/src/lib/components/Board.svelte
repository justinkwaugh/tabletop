<script lang="ts">
    import { BoardStyle } from '$lib/board/geometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ChartBoard from './ChartBoard.svelte'
    import RedesignBoard from './redesign/RedesignBoard.svelte'

    const gameSession = getGameSession()
</script>

{#if gameSession.boardStyle === BoardStyle.Redesign}
    <RedesignBoard />
{:else}
    <ChartBoard />
{/if}
