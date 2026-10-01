<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Pawn from '$lib/components/Pawn.svelte'

    const gameSession = getGameSession()
    const Spacing = 22

    let queue = $derived(gameSession.gameState.queue)
    let width = $derived(Math.max(queue.length, 1) * Spacing + 16)
</script>

<div class="flex items-center gap-2 text-sm text-[#e8d7b5]">
    <span class="font-semibold">Front</span>
    <svg {width} height="34" viewBox="0 0 {width} 34" role="img" aria-label="Visitor queue">
        {#each queue as color, index (index)}
            <Pawn {color} x={8 + Spacing / 2 + index * Spacing} y={17} />
        {/each}
    </svg>
    <span class="font-semibold">Back</span>
    <span class="ml-2">{queue.length} waiting</span>
</div>
