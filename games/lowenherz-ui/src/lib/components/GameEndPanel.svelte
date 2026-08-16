<script lang="ts">
    import { fade } from 'svelte/transition'
    import { GameResult, type Color } from '@tabletop/common'
    import { PoliticsCardType } from '@tabletop/lowenherz'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Numeral from './Numeral.svelte'

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

    // Final standings, highest total first. "Earned" is everything won on the board across
    // the whole game; parchment is the hidden endgame bonus that only lands when the King
    // dies - which is exactly why they're worth separating. A player can be overtaken at
    // the very last moment by cards nobody could see, and a single total hides that.
    //
    // Equal totals share a place (two firsts are followed by a third, not a second), which
    // matches how the game itself treats a tie: the crown is shared, not broken.
    const standings = $derived.by(() => {
        const rows = gameSession.gameState.players.map((playerState) => {
            const parchment = parchmentBonus(playerState.color)
            return {
                playerId: playerState.playerId,
                parchment,
                earned: playerState.powerPoints - parchment,
                total: playerState.powerPoints
            }
        })

        rows.sort((a, b) => b.total - a.total)

        let place = 0
        let previousTotal: number | undefined
        return rows.map((row, index) => {
            if (row.total !== previousTotal) {
                place = index + 1
                previousTotal = row.total
            }
            return { ...row, place }
        })
    })

    const anyParchment = $derived(standings.some((row) => row.parchment > 0))
</script>

<div transition:fade={{ duration: 75 }} class="mb-2 rounded-lg bg-black/10 px-2 pt-2 pb-3 text-center">
    <h1 class="text-lg sm:text-xl font-semibold text-black">
        {#if isDraw}
            The King is dead, and the crown is shared between
            {#each winnerIds as id, i (id)}
                {i === 0 ? '' : i === winnerIds.length - 1 ? ' and ' : ', '}<PlayerName playerId={id} />
            {/each}
            — tied at {gameSession.gameState.getPlayerState(winnerIds[0]).powerPoints} power points.
        {:else}
            <PlayerName playerId={winnerIds[0]} /> is the new ruler, with {gameSession.gameState.getPlayerState(
                winnerIds[0]
            ).powerPoints} power points!
        {/if}
    </h1>

    <!-- The full reckoning under the headline. Centred as a block rather than stretched to
         the panel, so with two players it doesn't strand its columns at opposite edges. -->
    <table class="mx-auto mt-2 text-black text-[15px] border-collapse">
        <thead>
            <tr class="text-[12px] uppercase tracking-wide text-black/55">
                <th class="px-1.5 pb-1 text-right font-semibold"></th>
                <th class="px-2 pb-1 text-left font-semibold">Player</th>
                <th class="px-2 pb-1 text-center font-semibold">Earned</th>
                {#if anyParchment}
                    <th class="px-2 pb-1 text-center font-semibold">Parchment</th>
                {/if}
                <th class="px-2 pb-1 text-center font-semibold">Total</th>
            </tr>
        </thead>
        <tbody>
            {#each standings as row (row.playerId)}
                {@const isWinner = winnerIds.includes(row.playerId)}
                <tr class="border-t border-black/15 {isWinner ? 'font-bold' : ''}">
                    <td class="px-1.5 py-[3px] text-right text-black/55 tabular-nums">
                        <Numeral value={row.place} />.
                    </td>
                    <td class="px-2 py-[3px] text-left whitespace-nowrap">
                        <PlayerName playerId={row.playerId} />
                    </td>
                    <td class="px-2 py-[3px] text-center tabular-nums">
                        <Numeral value={row.earned} />
                    </td>
                    {#if anyParchment}
                        <!-- A dash rather than a zero: holding no parchment isn't a score of
                             nothing, it's a column that doesn't apply to this player. -->
                        <td class="px-2 py-[3px] text-center tabular-nums">
                            {#if row.parchment > 0}+<Numeral value={row.parchment} />{:else}<span
                                    class="text-black/35">—</span
                                >{/if}
                        </td>
                    {/if}
                    <td class="px-2 py-[3px] text-center tabular-nums">
                        <Numeral value={row.total} />
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
