<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { GameResult } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
</script>

<div class="end">
    {#if gameState.result === GameResult.Loss}
        <p>
            {gameState.numPlayers === 1 ? 'You did not' : 'Nobody managed to'} settle ten colonists on
            a world of population 25 by the end of {gameState.year}. Everyone loses.
        </p>
    {:else}
        <p class="inline-flex flex-wrap items-center justify-center gap-x-1">
            {#each gameState.winningPlayerIds as playerId, index (playerId)}
                <PlayerName {playerId} />{index < gameState.winningPlayerIds.length - 1
                    ? ' and'
                    : ''}
            {/each}
            {gameState.result === GameResult.Draw ? 'share the victory' : 'wins'}, establishing
            humanity's first great colony among the stars in {gameState.year}.
        </p>
    {/if}
</div>

<style>
    .end {
        text-align: center;
        padding: 8px;
        color: #f2c94c;
        font-size: 16px;
    }
</style>
