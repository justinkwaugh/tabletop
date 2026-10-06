<script lang="ts">
    import type { Snippet } from 'svelte'
    import DirhamAmount from '$lib/components/DirhamAmount.svelte'
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { finalStandings } from '$lib/utils/standings.js'

    let { lead }: { lead?: Snippet } = $props()
    const gameSession = getGameSession()

    let standings = $derived(
        finalStandings(
            gameSession.gameState.players.map((player) => ({
                playerId: player.playerId,
                money: player.getMoney()
            })),
            gameSession.gameState.turnManager.turnOrder
        )
    )
    let winners = $derived(gameSession.gameState.winningPlayerIds)
</script>

<div class="flex flex-col items-center gap-1">
    <p class="marracash-display text-lg">
        {@render lead?.()}
        The game is over.
        {#each winners as playerId, index (playerId)}
            {index === 0 ? '' : index === winners.length - 1 ? ' and ' : ', '}<PlayerTag
                {playerId}
            />
        {/each}
        {winners.length > 1 ? 'share the win' : 'wins'}.
    </p>
    <ol class="grid grid-cols-[auto_auto_auto] items-center gap-x-2 gap-y-1 text-sm">
        {#each standings as standing (standing.playerId)}
            <li class="contents">
                <span class="text-right font-semibold">{standing.rank}.</span>
                <span class="justify-self-end"><PlayerTag playerId={standing.playerId} /></span>
                <span class="text-left"><DirhamAmount amount={standing.money} /></span>
            </li>
        {/each}
    </ol>
</div>
