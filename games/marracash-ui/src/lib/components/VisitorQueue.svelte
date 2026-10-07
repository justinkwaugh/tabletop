<script lang="ts">
    import { onDestroy } from 'svelte'
    import { QueueEnd } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Pawn from '$lib/components/Pawn.svelte'
    import { queueLayout, QueuePawnSize, queueRunnerLabels } from '$lib/utils/boardGeometry.js'
    import QueueRunner from '$lib/components/QueueRunner.svelte'
    import { queuePawnChoices, type QueuePawnChoice } from '$lib/utils/queueChoices.js'
    import { frontTaken } from '$lib/utils/queueShift.js'
    import { placeQueueVisitor, QueueAnimator } from '$lib/animators/queueAnimator.js'

    const PawnHitArea = { width: QueuePawnSize * 0.8, height: QueuePawnSize * 1.5 }

    const gameSession = getGameSession()

    const queueAnimator = new QueueAnimator(gameSession)
    queueAnimator.register()
    onDestroy(() => queueAnimator.unregister())

    let queue = $derived(gameSession.gameState.queue)
    let firstVisitorId = $derived(frontTaken(gameSession.shownActions))
    let labels = $derived(queueRunnerLabels(queue.length))
    let layout = $derived(queueLayout(queue.length, labels[1]))
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
    {#if queue.length > 0}
        <QueueRunner runner={layout.runner} {labels} animator={queueAnimator} />
    {/if}
    {#each queue as color, index (firstVisitorId + index)}
        {@const pawn = choices[index]}
        {@const choosable = pawn !== undefined && pawn.kind !== 'none'}
        <!-- tabindex is set only when the role is button; the checker cannot follow the condition -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <g
            use:placeQueueVisitor={{
                animator: queueAnimator,
                visitorId: firstVisitorId + index,
                at: layout.visitors[index]
            }}
            role={choosable ? 'button' : undefined}
            tabindex={choosable ? 0 : undefined}
            aria-label={choosable ? pawnLabel(pawn, index) : undefined}
            class:cursor-pointer={choosable}
            onclick={choosable ? () => choosePawn(index) : undefined}
            onkeydown={choosable
                ? (event) => event.key === 'Enter' && choosePawn(index)
                : undefined}
        >
            {#if choosable}
                <rect
                    x={-PawnHitArea.width / 2}
                    y={-PawnHitArea.height / 2}
                    width={PawnHitArea.width}
                    height={PawnHitArea.height}
                    fill="transparent"
                ></rect>
            {/if}
            <Pawn
                {color}
                x={0}
                y={0}
                size={QueuePawnSize}
                highlighted={gameSession.incomingQueueIndices.has(index)}
            />
        </g>
    {/each}
</g>
