<script lang="ts">
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    const session = getGameSession()

    const state = $derived(session.gameState)

    const playerName = (id: string) =>
        session.game?.players.find((p) => p.id === id)?.name ?? id

    const sortedPlayers = $derived(
        [...state.players].sort((a, b) => b.score - a.score)
    )
</script>

<div class="paper-texture bg-stone-900/90 rounded-xl p-4 text-white space-y-3 min-w-64">
    <p class="text-green-400 font-bold text-lg text-center">Final Scores</p>
    <ul class="space-y-1">
        {#each sortedPlayers as p, i}
            <li class="flex justify-between text-sm"
                class:text-amber-300={state.winningPlayerIds.includes(p.playerId)}>
                <span>{i + 1}. {playerName(p.playerId)}</span>
                <span class="font-bold">{p.score} pts</span>
            </li>
        {/each}
    </ul>
</div>
