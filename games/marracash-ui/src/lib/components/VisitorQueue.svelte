<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Pawn from '$lib/components/Pawn.svelte'
    import { QueueCountLabel, queueLayout, QueuePawnSize } from '$lib/utils/boardGeometry.js'

    const gameSession = getGameSession()

    let queue = $derived(gameSession.gameState.queue)
    let layout = $derived(queueLayout(queue.length))
</script>

<g role="img" aria-label="Visitor queue">
    {#each queue as color, index (index)}
        <Pawn
            {color}
            x={layout.visitors[index].x}
            y={layout.visitors[index].y}
            size={QueuePawnSize}
            highlighted={gameSession.incomingQueueIndices.has(index)}
        />
    {/each}
    {#if queue.length > 0}
        <text class="queue-label" x={layout.front.x} y={layout.front.y}>Front</text>
        <text class="queue-label" x={layout.back.x} y={layout.back.y}>Back</text>
    {/if}
    <text
        class="queue-label"
        x={QueueCountLabel.x}
        y={QueueCountLabel.y}
        transform="rotate(90 {QueueCountLabel.x} {QueueCountLabel.y})">{queue.length} waiting</text
    >
</g>

<style>
    .queue-label {
        fill: #e8d7b5;
        font-size: 15px;
        font-weight: 600;
        text-anchor: middle;
        dominant-baseline: central;
    }
</style>
