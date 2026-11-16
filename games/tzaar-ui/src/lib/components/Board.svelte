<script lang="ts">
    import { MediaQuery } from 'svelte/reactivity'
    import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
    import { SPACES, spaceKey, spaceName } from '@tabletop/tzaar'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import { VIEW, viewOf } from '$lib/board/geometry.js'
    import { stackDiscs, TILT, topFaceY } from '$lib/board/pieceGeometry.js'
    import { markRing, outlinePath } from '$lib/board/pieceShape.js'
    import { BoardAnimator, type DrawnStack } from '$lib/animators/boardAnimator.svelte.js'
    import PieceDefs from './PieceDefs.svelte'
    import StackShape from './StackShape.svelte'

    const session = getGameSession()

    // On a phone the board grows into the labels' room while they are hidden.
    const phone = new MediaQuery('width < 40rem')
    const layout = $derived(
        viewOf(
            session.showCoordinates || !phone.current,
            session.rotatedBoard,
            session.turned,
            session.shrinkStacks
        )
    )
    const radius = VIEW.radius

    const animator = new BoardAnimator(session, () => layout)

    const frame = $derived(layout.raised(animator.raise))
    // Coordinate labels sit on the alphabetic baseline, lowered by a share of their size to centre
    // on their point, which every browser draws alike.
    const LABEL_SIZE = 15

    // Back to front, so a nearer stack covers the one behind it.
    const stacks = $derived(
        animator.stacks.toSorted((a, b) => {
            const pa = layout.center(a.coords)
            const pb = layout.center(b.coords)
            return pa.y - pb.y || pa.x - pb.x
        })
    )

    function stackId(key: string): string {
        return `tzaar-stack-${key}`
    }

    function heightAt(coords: AxialCoordinates): number {
        return session.gameState.board.stackAt(coords).length
    }

    type Role = 'movable' | 'chosen' | 'destination'

    function roleOf(coords: AxialCoordinates): Role | undefined {
        if (
            includesCoords(session.captureTargets, coords) ||
            includesCoords(session.stackTargets, coords)
        ) {
            return 'destination'
        }
        if (session.chosenFrom && sameCoordinates(session.chosenFrom, coords)) return 'chosen'
        if (includesCoords(session.movable, coords) && !session.chosenFrom) return 'movable'
        return undefined
    }

    // Far first, so where a nearer stack's outline overlaps one behind, the nearer one takes the tap.
    const clickable = $derived(
        SPACES.filter((coords) => session.isClickable(coords)).toSorted((a, b) => {
            const pa = layout.center(a)
            const pb = layout.center(b)
            return pa.y - pb.y || pa.x - pb.x
        })
    )

    // The outline of the stack standing there, or of a single piece on an empty space.
    function target(coords: AxialCoordinates): string {
        const height = Math.max(heightAt(coords), 1)
        const base = stackDiscs(1, radius, layout.model)[0].base
        return outlinePath(base, topFaceY(height, radius, layout.model), radius)
    }

    function describe(coords: AxialCoordinates): string {
        const name = spaceName(coords)
        if (includesCoords(session.placeable, coords)) return `place on ${name}`
        if (includesCoords(session.captureTargets, coords)) return `capture ${name}`
        if (includesCoords(session.stackTargets, coords)) return `stack onto ${name}`
        return roleOf(coords) === 'chosen' ? `put back ${name}` : `move ${name}`
    }

    // A tap on nothing you can choose lets go of what is chosen.
    function onBoardClick(event: MouseEvent) {
        if (event.target instanceof Element && event.target.closest('[role="button"]')) return
        session.letGo()
    }

    function onKey(event: KeyboardEvent, act: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            act()
        }
    }

    const shadowRx = $derived(radius + 3)
    // A mark recolors a ring on the flat edge of the stack's top piece.
    const ring = markRing(radius)
</script>

<!-- A stack's shadow on the board, and right under it the board in its shade, which shows through
     the gap under the bottom piece. -->
{#snippet shadow()}
    <ellipse cx="1.5" cy="2" rx={shadowRx} ry={shadowRx * TILT} fill="url(#tzaar-shadow)"></ellipse>
    <ellipse rx={radius} ry={radius * TILT} fill="url(#tzaar-board-contact)"></ellipse>
{/snippet}

{#snippet drawn(stack: DrawnStack)}
    {@const center = layout.center(stack.coords)}
    {@const role = roleOf(stack.coords)}
    <g id={stackId(stack.key)} transform="translate({center.x} {center.y})" class="piece">
        <g {@attach animator.stack(stack.key, 'shadow')}>
            {@render shadow()}
        </g>
        <g {@attach animator.stack(stack.key, 'body')}>
            <StackShape
                pieces={stack.pieces.map((piece) => session.shapeOf(piece))}
                {radius}
                prefix="tzaar-board"
                model={animator.modelAt(stack.key, layout.model)}
                quarterTurns={layout.quarterTurns}
            >
                <!-- A mark recolors a ring on the top piece, under the count, so the count
                     stays whole. The animator fades it with the move. -->
                {#snippet onTop()}
                    {#if role}
                        <g class="rim role-{role}" {@attach animator.mark()}>
                            {#each ['under', 'over'] as layer (layer)}
                                <ellipse cy={ring.y} rx={ring.rx} ry={ring.ry} class={layer}
                                ></ellipse>
                            {/each}
                        </g>
                    {/if}
                {/snippet}
            </StackShape>
        </g>
    </g>
{/snippet}

<!-- Tapping off the choices is a shortcut for pointers; Undo lets go from the keyboard. -->
<div class="tap-off" role="presentation" onclick={onBoardClick}>
    <svg
        class="tzaar-board"
        viewBox="{frame.x} {frame.y} {frame.width} {frame.height}"
        width={frame.width}
        height={frame.height}
        role="group"
        aria-label="TZAAR board"
        {@attach animator.attach}
    >
        <defs>
            <PieceDefs prefix="tzaar-board" {radius} />
            <!-- Soft shadows as gradients rather than a blur filter: WebKit leaves the pixels of a
                 removed piece under a filter on screen until something else repaints there. -->
            <radialGradient id="tzaar-shadow">
                <stop offset="0.72" stop-color="#000" stop-opacity="0.32"></stop>
                <stop offset="1" stop-color="#000" stop-opacity="0"></stop>
            </radialGradient>
        </defs>

        <path d={layout.playArea} class="play-area" fill-rule="evenodd"></path>
        <g class="lines">
            {#each layout.lines as line, index (index)}
                <line x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y}></line>
            {/each}
        </g>

        {#if session.showCoordinates}
            {#each layout.labels as label (label.key)}
                {@const at = layout.labelAt(label)}
                <text
                    x={at.x}
                    y={at.y}
                    dy={LABEL_SIZE * 0.35}
                    font-size={LABEL_SIZE}
                    class="coordinate-label">{label.text}</text
                >
            {/each}
        {/if}

        {#each stacks as stack (stack.key)}
            {@render drawn(stack)}
        {/each}

        {#each animator.fliers as flier (flier.key)}
            {@const center = layout.center(flier.from)}
            <g transform="translate({center.x} {center.y})" class="flier">
                <g {@attach animator.flierNode(flier.key, 'whole')}>
                    <g {@attach animator.flierNode(flier.key, 'shadow')}>
                        {@render shadow()}
                    </g>
                    <g {@attach animator.flierNode(flier.key, 'body')}>
                        <StackShape
                            pieces={flier.pieces.map((piece) => session.shapeOf(piece))}
                            {radius}
                            prefix="tzaar-board"
                            model={layout.model}
                            quarterTurns={layout.quarterTurns}
                        />
                    </g>
                </g>
            </g>
        {/each}
        <!-- A lone flier passes behind the stacks nearer the viewer than its place on the board. -->
        {#if animator.fliers.length === 1}
            {@const flier = animator.fliers[0]}
            <g class="occluders" aria-hidden="true">
                {#each stacks as stack (stack.key)}
                    {#if !flier.passes.includes(stack.key)}
                        <use href="#{stackId(stack.key)}" {@attach animator.occluder(stack)}></use>
                    {/if}
                {/each}
            </g>
        {/if}

        <g class="targets">
            {#each clickable as coords (spaceKey(coords))}
                {@const center = layout.center(coords)}
                <path
                    d={target(coords)}
                    transform="translate({center.x} {center.y})"
                    class="target"
                    role="button"
                    tabindex="0"
                    aria-label={describe(coords)}
                    onclick={() => session.chooseSpace(coords)}
                    onkeydown={(event) => onKey(event, () => session.chooseSpace(coords))}
                ></path>
            {/each}
        </g>
    </svg>
</div>

<style>
    .tzaar-board {
        overflow: visible;
        user-select: none;
    }

    .play-area {
        fill: var(--tzaar-play);
    }

    .lines line {
        stroke-linecap: butt;
        stroke: var(--tzaar-line);
        stroke-width: 1.4;
    }

    .coordinate-label {
        fill: var(--tzaar-label);
        font-weight: 600;
        letter-spacing: 0.6px;
        text-anchor: middle;
        pointer-events: none;
    }

    .tap-off {
        display: contents;
    }

    .piece,
    .flier,
    .occluders {
        pointer-events: none;
    }

    /* Two-tone, a dark band under a bright core, so a mark reads on every color. */
    .rim ellipse {
        fill: none;
    }

    .rim .under {
        stroke: rgb(0 0 0 / 0.8);
        stroke-width: 3.6;
    }

    .rim .over {
        stroke: var(--tzaar-mark);
        stroke-width: 1.8;
    }

    .rim.role-chosen .under {
        stroke-width: 5;
    }

    .rim.role-chosen .over {
        stroke-width: 3;
    }

    .rim.role-destination .over {
        stroke-width: 2.6;
        stroke-dasharray: 4.5 3.5;
    }

    /* Each dash outlined on its own rather than laid on a band, so the piece shows between
       dashes: the black dashes are shorter but square-capped, overhanging each cyan dash by the
       outline's width at both ends. */
    .rim.role-destination .under {
        stroke: #000;
        stroke-width: 4.4;
        stroke-dasharray: 1.9 6.1;
        stroke-dashoffset: -1.3;
        stroke-linecap: square;
    }

    .target {
        fill: transparent;
        cursor: pointer;
        outline: none;
    }

    .target:focus-visible {
        stroke: var(--tzaar-mark);
        stroke-width: 1.4;
    }
</style>
