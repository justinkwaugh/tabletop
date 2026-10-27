<script lang="ts">
    import { flip } from 'svelte/animate'
    import { fade } from 'svelte/transition'
    import { GameResult } from '@tabletop/common'
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { PoliticsCardType, type LowenherzProjectedPlayerState } from '@tabletop/lowenherz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Numeral from './Numeral.svelte'
    import ScoreHistoryChart from './ScoreHistoryChart.svelte'
    import { withSharedPlaces } from '$lib/model/standings.js'
    import PlayerPill from './PlayerPill.svelte'

    const gameSession = getGameSession()
    const isDraw = $derived(gameSession.gameState.result === GameResult.Draw)
    const winnerIds = $derived(gameSession.gameState.winningPlayerIds)

    // Parchment cards were folded into powerPoints already (see EndOfGameStateHandler)
    // - this just re-derives the per-player breakdown from what's still in each hand,
    // so the final score doesn't look like it came from nowhere.
    function parchmentBonus(playerState: LowenherzProjectedPlayerState): number {
        return (
            gameSession.gameState.finalHands?.find((hand) => hand.playerId === playerState.playerId)
                ?.cards ??
            playerState.politicsCards ??
            []
        )
            .filter((c) => c.type === PoliticsCardType.Parchment)
            .reduce((sum, c) => sum + (c.value ?? 0), 0)
    }

    // Final standings, highest total first. "Earned" is everything won on the board across
    // the whole game; parchment is the hidden endgame bonus that only lands when the King
    // dies - which is exactly why they're worth separating. A player can be overtaken at
    // the very last moment by cards nobody could see, and a single total hides that.
    const standings = $derived.by(() => {
        const rows = gameSession.gameState.players.map((playerState) => {
            const parchment = parchmentBonus(playerState)
            return {
                playerId: playerState.playerId,
                parchment,
                earned: playerState.powerPoints - parchment,
                total: playerState.powerPoints
            }
        })

        return withSharedPlaces(rows)
    })

    const history = $derived(gameSession.powerPointHistory)
    let hoveredIndex: number | null = $state(null)
    const shownRoundIndex = $derived(
        history && hoveredIndex !== null && hoveredIndex < history[0].scores.length - 1
            ? hoveredIndex
            : null
    )
    const roundStandings = $derived.by(() => {
        const index = shownRoundIndex
        if (!history || index === null) return undefined
        return withSharedPlaces(
            history.map(({ playerId, scores }) => ({ playerId, total: scores[index] }))
        )
    })

    const anyParchment = $derived(standings.some((row) => row.parchment > 0))
</script>

<div
    transition:fade={{ duration: 75 }}
    class="mb-2 rounded-lg bg-black/10 px-2 pt-2 pb-3 text-center"
>
    {#if gameSession.gameCall}
        <CalledGameEnding class="text-lg sm:text-xl text-black" />
    {:else}
        <h1 class="text-lg sm:text-xl font-semibold text-black">
            {#if isDraw}
                The King is dead, and the crown is shared between
                {#each winnerIds as id, i (id)}
                    {i === 0 ? '' : i === winnerIds.length - 1 ? ' and ' : ', '}<PlayerPill
                        playerId={id}
                    />
                {/each}
                — tied at {gameSession.gameState.getPlayerState(winnerIds[0]).powerPoints} power points.
            {:else}
                <!-- The winner's own name even on their screen: "You is the new ruler" is not a sentence. -->
                <PlayerPill playerId={winnerIds[0]} showAsYou={false} /> is the new ruler, with {gameSession.gameState.getPlayerState(
                    winnerIds[0]
                ).powerPoints} power points!
            {/if}
        </h1>

        <!-- The full reckoning under the headline, centred rather than stretched to the panel so
             with two players it doesn't strand its columns at opposite edges. -->
        <div class="flex flex-wrap items-start justify-center gap-x-8 gap-y-2">
            <div class="grid">
                {#if roundStandings}
                    <div class="mt-2 text-black [grid-area:1/1] justify-self-center">
                        <div
                            class="text-[12px] uppercase tracking-wide font-semibold text-black/55"
                        >
                            After Round <Numeral value={(shownRoundIndex ?? 0) + 1} />
                        </div>
                        <table class="text-[15px] border-collapse">
                            <tbody>
                                {#each roundStandings as row (row.playerId)}
                                    <tr
                                        class="border-t border-black/15 {row.place === 1
                                            ? 'font-bold'
                                            : ''}"
                                        animate:flip={{ duration: 200 }}
                                    >
                                        <td
                                            class="px-1.5 py-[3px] text-right text-black/55 tabular-nums"
                                        >
                                            <Numeral value={row.place} />.
                                        </td>
                                        <td class="px-2 py-[3px] text-left whitespace-nowrap">
                                            <PlayerPill playerId={row.playerId} />
                                        </td>
                                        <td class="px-2 py-[3px] text-center tabular-nums">
                                            <Numeral value={row.total} />
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                {/if}
                <!-- Kept laid out, though hidden, while a round is shown, so the chart beside it does
                     not shift as the narrower round table takes its place. -->
                <table
                    class="mt-2 text-black text-[15px] border-collapse [grid-area:1/1]"
                    class:invisible={roundStandings !== undefined}
                >
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
                                    <PlayerPill playerId={row.playerId} />
                                </td>
                                <td class="px-2 py-[3px] text-center tabular-nums">
                                    <Numeral value={row.earned} />
                                </td>
                                {#if anyParchment}
                                    <!-- A dash rather than a zero: holding no parchment isn't a score of
                                     nothing, it's a column that doesn't apply to this player. -->
                                    <td class="px-2 py-[3px] text-center tabular-nums">
                                        {#if row.parchment > 0}+<Numeral
                                                value={row.parchment}
                                            />{:else}<span class="text-black/35">—</span>{/if}
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
            {#if history}
                <div class="mt-2 w-[300px] max-w-full text-black">
                    <ScoreHistoryChart series={history} bind:hoveredIndex />
                </div>
            {/if}
        </div>
    {/if}
</div>
