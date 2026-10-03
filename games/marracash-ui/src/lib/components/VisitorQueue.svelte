<script lang="ts">
    import { QueueEnd } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Pawn from '$lib/components/Pawn.svelte'
    import { QueueCountLabel, queueLayout, QueuePawnSize } from '$lib/utils/boardGeometry.js'
    import { queuePawnChoices, type QueuePawnChoice } from '$lib/utils/queueChoices.js'

    const PawnHitArea = { width: QueuePawnSize * 0.8, height: QueuePawnSize * 1.5 }

    const gameSession = getGameSession()

    let queue = $derived(gameSession.gameState.queue)
    let layout = $derived(queueLayout(queue.length))
    let choices: QueuePawnChoice[] = $derived(
        gameSession.canChooseRefill ? queuePawnChoices(queue.length) : []
    )

    function choosePawn(index: number) {
        const pawn = choices[index]
        if (pawn.kind === 'choice') {
            gameSession.chooseRefill(pawn.choice)
        } else if (pawn.kind === 'ambiguous') {
            gameSession.warnQueueTooShort()
        }
    }

    function pawnLabel(pawn: QueuePawnChoice, index: number): string {
        if (pawn.kind !== 'choice') return `Visitor ${index + 1} in the queue`
        const end = pawn.choice.end === QueueEnd.Front ? 'front' : 'back'
        return `Bring ${pawn.choice.count} visitors from the ${end}`
    }
</script>

<g role="group" aria-label="Visitor queue">
    {#each queue as color, index (index)}
        {@const position = layout.visitors[index]}
        {@const pawn = choices[index]}
        {#if pawn !== undefined && pawn.kind !== 'none'}
            <g
                role="button"
                tabindex="0"
                aria-label={pawnLabel(pawn, index)}
                class="cursor-pointer"
                onclick={() => choosePawn(index)}
                onkeydown={(event) => event.key === 'Enter' && choosePawn(index)}
            >
                <rect
                    x={position.x - PawnHitArea.width / 2}
                    y={position.y - PawnHitArea.height / 2}
                    width={PawnHitArea.width}
                    height={PawnHitArea.height}
                    fill="transparent"
                ></rect>
                <Pawn
                    {color}
                    x={position.x}
                    y={position.y}
                    size={QueuePawnSize}
                    highlighted={gameSession.incomingQueueIndices.has(index)}
                />
            </g>
        {:else}
            <Pawn
                {color}
                x={position.x}
                y={position.y}
                size={QueuePawnSize}
                highlighted={gameSession.incomingQueueIndices.has(index)}
            />
        {/if}
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
