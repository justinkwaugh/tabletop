<script lang="ts">
    import { fade } from 'svelte/transition'
    import { GameResult, type Color } from '@tabletop/common'
    import { PoliticsCardType } from '@tabletop/lowenherz'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const isDraw = $derived(gameSession.gameState.result === GameResult.Draw)
    const winnerIds = $derived(gameSession.gameState.winningPlayerIds)

    // Parchment cards were folded into powerPoints already (see EndOfGameStateHandler)
    // - this just re-derives the per-player breakdown from what's still in each hand,
    // so the final score doesn't look like it came from nowhere.
    function parchmentBonus(color: Color): number {
        const player = gameSession.gameState.players.find((p) => p.color === color)
        if (!player) return 0
        return player.politicsCards
            .filter((c) => c.type === PoliticsCardType.Parchment)
            .reduce((sum, c) => sum + (c.value ?? 0), 0)
    }

    const parchmentBonuses = $derived(
        gameSession.gameState.players
            .map((p) => ({ playerId: p.playerId, bonus: parchmentBonus(p.color) }))
            .filter((p) => p.bonus > 0)
    )
</script>

<div transition:fade={{ duration: 75 }} class="mb-2 rounded-lg bg-black/10 px-2 pt-2 pb-4 text-center">
    <h1 class="text-lg sm:text-xl font-semibold text-black">
        {#if isDraw}
            The King is dead, and the crown is shared between
            {#each winnerIds as id, i (id)}
                {i === 0 ? '' : i === winnerIds.length - 1 ? ' and ' : ', '}<PlayerName playerId={id} />
            {/each}
            — tied at {gameSession.gameState.getPlayerState(winnerIds[0]).powerPoints} power points.
        {:else}
            <PlayerName playerId={winnerIds[0]} /> is the new king, with {gameSession.gameState.getPlayerState(
                winnerIds[0]
            ).powerPoints} power points!
        {/if}
    </h1>
    {#if parchmentBonuses.length > 0}
        <p class="text-sm text-black/70 mt-1">
            (includes Parchment bonuses:
            {#each parchmentBonuses as entry, i (entry.playerId)}
                {i > 0 ? ', ' : ''}<PlayerName playerId={entry.playerId} /> +{entry.bonus}
            {/each})
        </p>
    {/if}
</div>
