<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    let gameSession = getContext('gameSession') as KaivaiGameSession
    const phase = $derived(gameSession.gameState.phases.currentPhase?.name)
    const round = $derived(gameSession.gameState.rounds.currentRound?.number)
    const text = $derived.by(() => {
        return `Round: ${round} - Phase: ${phase}`
    })
</script>

<div class="relative flex flex-col justify-center items-center w-full rounded-lg overflow-hidden">
    {text}
</div>
