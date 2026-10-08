<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const scores = $derived(game.scores())
    const fiveDp = $derived(game.winningPlayerIds.some((playerId) => game.hasWon(playerId)))
    const standings = $derived(
        game.players.toSorted((a, b) => scores[b.playerId].total - scores[a.playerId].total)
    )
</script>

<div class="flex flex-col gap-2">
    <div class="kogge-prompt inline-flex flex-wrap gap-1">
        {#each game.winningPlayerIds as playerId, index (playerId)}
            {#if index > 0}<span>and</span>{/if}<PlayerName {playerId} />
        {/each}
        <span>
            {fiveDp
                ? 'reaches five development points and wins'
                : game.winningPlayerIds.length > 1
                  ? 'share the victory'
                  : 'wins as the richest merchant'}
        </span>
    </div>
    {#if !fiveDp}
        <table class="text-sm">
            <thead class="kogge-note text-left">
                <tr
                    ><th class="pr-3 font-normal">Merchant</th><th class="px-2 font-normal"
                        >Offices</th
                    ><th class="px-2 font-normal">Bonus</th><th class="px-2 font-normal">Raid</th
                    ><th class="px-2 font-normal">Goods</th><th class="px-2 font-normal">Total</th
                    ></tr
                >
            </thead>
            <tbody>
                {#each standings as player (player.playerId)}
                    {@const score = scores[player.playerId]}
                    <tr>
                        <td class="pr-3"><PlayerName playerId={player.playerId} /></td>
                        <td class="px-2 tabular-nums">{score.offices}</td>
                        <td class="px-2 tabular-nums">{score.bonusChits}</td>
                        <td class="px-2 tabular-nums">{score.raidMarkers}</td>
                        <td class="px-2 tabular-nums">{score.cargo + score.officeGoods}</td>
                        <td class="px-2 font-bold tabular-nums">{score.total}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>
