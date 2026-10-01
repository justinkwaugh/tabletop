<script lang="ts">
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    let standings = $derived(
        gameSession.gameState.players
            .map((player) => ({ playerId: player.playerId, money: player.getMoney() }))
            .toSorted((a, b) => b.money - a.money)
    )
    let winners = $derived(gameSession.gameState.winningPlayerIds)
</script>

<div class="flex flex-col items-center gap-1">
    <p class="text-lg font-bold">
        The game is over.
        {#each winners as playerId, index (playerId)}
            {index === 0 ? '' : index === winners.length - 1 ? ' and ' : ', '}<PlayerTag
                {playerId}
            />
        {/each}
        {winners.length > 1 ? 'share the win' : 'wins'}.
    </p>
    <p class="text-sm">
        {#each standings as standing, index (standing.playerId)}
            {index > 0 ? ' · ' : ''}<PlayerTag playerId={standing.playerId} />
            {standing.money} Dirham
        {/each}
    </p>
</div>
