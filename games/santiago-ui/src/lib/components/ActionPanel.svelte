<script lang="ts">
    import { flip } from 'svelte/animate'
    import ScoreHistoryChart from './ScoreHistoryChart.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    const session = getGameSession()

    const gameState = $derived(session.gameState)

    const scoreHistory = $derived.by(() => {
        const series = gameState.players.map(({ playerId, roundScores }) => ({
            playerId,
            scores: roundScores ?? []
        }))
        return series.every(({ scores }) => scores.length === gameState.round) ? series : undefined
    })

    let hoveredRoundIndex: number | null = $state(null)

    const standings = $derived.by(() => {
        const index = hoveredRoundIndex
        const scores =
            scoreHistory && index !== null
                ? scoreHistory.map(({ playerId, scores }) => ({ playerId, score: scores[index] }))
                : gameState.players.map(({ playerId, score }) => ({ playerId, score }))
        return scores.toSorted((a, b) => b.score - a.score)
    })
    const highlightedPlayerIds = $derived.by(() => {
        if (hoveredRoundIndex === null) return gameState.winningPlayerIds
        const leadingScore = standings[0].score
        return standings.filter(({ score }) => score === leadingScore).map(({ playerId }) => playerId)
    })
</script>

<div class="paper-texture bg-stone-900/90 rounded-xl p-4 text-white space-y-3 min-w-64">
    <p class="text-green-400 font-bold text-lg text-center">
        {hoveredRoundIndex === null ? 'Final Scores' : `After Round ${hoveredRoundIndex + 1}`}
    </p>
    <ul class="space-y-1">
        {#each standings as p, i (p.playerId)}
            <li class="flex justify-between text-sm"
                class:text-amber-300={highlightedPlayerIds.includes(p.playerId)}
                animate:flip={{ duration: 200 }}>
                <span>{i + 1}. {session.getPlayerName(p.playerId)}</span>
                <span class="font-bold">{p.score} pts</span>
            </li>
        {/each}
    </ul>
    {#if scoreHistory}
        <div class="border-t border-stone-700/60 pt-3 text-amber-100">
            <ScoreHistoryChart series={scoreHistory} bind:hoveredIndex={hoveredRoundIndex} />
        </div>
    {/if}
</div>
