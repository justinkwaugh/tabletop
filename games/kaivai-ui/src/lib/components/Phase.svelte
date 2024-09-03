<script lang="ts">
    import { getContext } from 'svelte'
    import { Button } from 'flowbite-svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    let gameSession = getContext('gameSession') as KaivaiGameSession
    const phase = $derived(gameSession.gameState.phases.currentPhase?.name)
    const round = $derived(gameSession.gameState.rounds.currentRound?.number)
    const text = $derived.by(() => {
        return `Round: ${round} - Phase: ${phase}`
    })
</script>

<div class="relative flex flex-row justify-between items-center w-full rounded-lg overflow-hidden">
    <div>{text}</div>
    {#if gameSession.undoableAction}
        <Button
            onclick={async () => {
                gameSession.resetAction()
                await gameSession.undo()
            }}
            size="xs"
            class="m-1"
            color="light">Undo</Button
        >
    {/if}
</div>
