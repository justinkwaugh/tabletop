<script lang="ts">
    import { addAxial, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
    import { isSpace, SPACES, spaceName } from '@tabletop/dvonn'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import { coordsKey, LAYOUT } from '$lib/board/geometry.js'
    import { HOLE_RATIO, SIDE, stackBounds, TILT, topFaceY } from '$lib/board/pieceGeometry.js'
    import { sandImage } from '$lib/board/sand.js'
    import { BoardAnimator, type DrawnStack } from '$lib/animators/boardAnimator.svelte.js'
    import StackShape from './StackShape.svelte'

    const session = getGameSession()

    const layout = LAYOUT
    const radius = layout.radius

    // The graph board: lines along the three directions through every space, running a short
    // whisker on past the outer spaces, as on the printed board.
    const AXES: AxialCoordinates[] = [
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: -1, r: 1 }
    ]
    const WHISKER = 0.15
    const beyond = (coords: AxialCoordinates, step: AxialCoordinates) => {
        const from = layout.center(coords)
        const to = layout.center(addAxial(coords, step))
        return { x: from.x + (to.x - from.x) * WHISKER, y: from.y + (to.y - from.y) * WHISKER }
    }
    const lines = $derived(
        AXES.flatMap((axis) => {
            const back = { q: -axis.q, r: -axis.r }
            return SPACES.filter((space) => !isSpace(addAxial(space, back))).map((start) => {
                let end = start
                while (isSpace(addAxial(end, axis))) end = addAxial(end, axis)
                return { from: beyond(start, back), to: beyond(end, axis) }
            })
        })
    )

    // The sand board, its grain drawn once across the whole frame.
    const sand = $derived(
        session.graphBoard ? undefined : sandImage(layout.frame.width, layout.frame.height)
    )
    // Each imprint sits where a single piece's base rests.
    const imprintY = $derived((radius * SIDE) / 2)
    const imprintRadius = $derived(radius * 1.03)

    const animator = new BoardAnimator(session, () => layout)

    // Back to front, so a nearer stack covers the one behind it.
    const stacks = $derived(
        animator.stacks.toSorted((a, b) => {
            const pa = layout.center(a.coords)
            const pb = layout.center(b.coords)
            return pa.y - pb.y || pa.x - pb.x
        })
    )

    function heightAt(coords: AxialCoordinates): number {
        return session.gameState.board.stackAt(coords).length
    }

    type Role = 'movable' | 'chosen' | 'destination'

    function roleOf(coords: AxialCoordinates): Role | undefined {
        if (includesCoords(session.destinations, coords)) return 'destination'
        if (session.chosenFrom && sameCoordinates(session.chosenFrom, coords)) return 'chosen'
        if (includesCoords(session.movable, coords) && !session.chosenFrom) return 'movable'
        return undefined
    }

    const clickable = $derived(SPACES.filter((coords) => session.isClickable(coords)))

    function target(coords: AxialCoordinates) {
        const center = layout.center(coords)
        const { top, bottom } = stackBounds(Math.max(heightAt(coords), 1), radius)
        return { x: center.x, y: center.y + (top + bottom) / 2, ry: (bottom - top) / 2 }
    }

    function describe(coords: AxialCoordinates): string {
        const name = spaceName(coords)
        if (includesCoords(session.placeable, coords)) return `place on ${name}`
        switch (roleOf(coords)) {
            case 'destination':
                return `move onto ${name}`
            case 'chosen':
                return `put back ${name}`
            default:
                return `stack ${name}`
        }
    }

    function onKey(event: KeyboardEvent, act: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            act()
        }
    }

    const shadowRx = $derived(radius + 3)
    const RIM = 0.72
</script>

{#snippet drawn(stack: DrawnStack)}
    {@const center = layout.center(stack.coords)}
    {@const role = roleOf(stack.coords)}
    <g transform="translate({center.x} {center.y})" class="piece">
        <g {@attach animator.node(stack.key)}>
            <ellipse
                cx="1.5"
                cy={imprintY + 2}
                rx={shadowRx}
                ry={shadowRx * TILT}
                fill="url(#dvonn-shadow)"
                {@attach animator.node(`${stack.key}:shadow`)}
            ></ellipse>
            <g {@attach animator.node(`${stack.key}:body`)}>
                <StackShape
                    tones={stack.pieces.map((piece) => session.toneOfPiece(piece))}
                    seedKeys={stack.pieces.map((piece) => coordsKey(piece.placedAt))}
                    {radius}
                />
            </g>
        </g>
        <!-- A mark recolors the moulded rim on top of the stack. It is drawn with its stack, so
             nearer stacks cover it as they cover the pieces, but outside the stack's moving
             group: it fades with the move rather than travelling with the stack. -->
        {#if role}
            <g class="rim role-{role}" {@attach animator.mark()}>
                {#each ['under', 'over'] as layer (layer)}
                    <ellipse
                        cy={topFaceY(stack.pieces.length, radius)}
                        rx={radius * RIM}
                        ry={radius * RIM * TILT}
                        class={layer}
                    ></ellipse>
                {/each}
            </g>
        {/if}
    </g>
{/snippet}

<svg
    class="dvonn-board"
    class:graph={session.graphBoard}
    viewBox={layout.viewBox}
    width={layout.frame.width}
    height={layout.frame.height}
    role="group"
    aria-label="DVONN board"
    {@attach animator.attach}
>
    <defs>
        <clipPath id="dvonn-sand-clip">
            <path d={layout.sandOutline}></path>
        </clipPath>
        <!-- Soft shadows as gradients rather than a blur filter: WebKit leaves the pixels of a
             removed piece under a filter on screen until something else repaints there. -->
        <radialGradient id="dvonn-shadow">
            <stop offset="0.72" stop-color="#000" stop-opacity="0.32"></stop>
            <stop offset="1" stop-color="#000" stop-opacity="0"></stop>
        </radialGradient>
        <!-- A pressed ring: shaded on its far side, lit on its near side. -->
        <linearGradient id="dvonn-imprint" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#6f675a" stop-opacity="0.55"></stop>
            <stop offset="0.5" stop-color="#6f675a" stop-opacity="0.08"></stop>
            <stop offset="1" stop-color="#ffffff" stop-opacity="0.7"></stop>
        </linearGradient>
        <linearGradient id="dvonn-imprint-hole" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ffffff" stop-opacity="0.6"></stop>
            <stop offset="1" stop-color="#6f675a" stop-opacity="0.45"></stop>
        </linearGradient>
    </defs>

    {#if session.graphBoard}
        <polygon points={layout.hull} class="play-area"></polygon>
        <g class="lines">
            {#each lines as line, index (index)}
                <line x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y}></line>
            {/each}
        </g>
    {:else}
        <path d={layout.sandOutline} class="sand"></path>
        {#if sand}
            <image
                href={sand}
                x={layout.frame.x}
                y={layout.frame.y}
                width={layout.frame.width}
                height={layout.frame.height}
                clip-path="url(#dvonn-sand-clip)"
                class="grain"
            ></image>
        {/if}
        <g class="imprints">
            {#each SPACES as coords (coordsKey(coords))}
                {@const center = layout.center(coords)}
                <g transform="translate({center.x} {center.y + imprintY})">
                    <ellipse
                        rx={imprintRadius}
                        ry={imprintRadius * TILT}
                        stroke="url(#dvonn-imprint)"
                        class="imprint"
                    ></ellipse>
                    <ellipse
                        rx={imprintRadius * HOLE_RATIO}
                        ry={imprintRadius * HOLE_RATIO * TILT}
                        stroke="url(#dvonn-imprint-hole)"
                        class="imprint"
                    ></ellipse>
                </g>
            {/each}
        </g>
    {/if}

    {#if session.showCoordinates}
        {#each layout.labels as label (label.key)}
            <text x={label.at.x} y={label.at.y} class="coordinate-label">{label.text}</text>
        {/each}
    {/if}

    {#each stacks as stack (stack.key)}
        {@render drawn(stack)}
    {/each}

    {#if animator.flier}
        {@const center = layout.center(animator.flier.coords)}
        <g transform="translate({center.x} {center.y + animator.flier.startLift})" class="flier">
            <g {@attach animator.flierNode()}>
                <ellipse
                    cx="1.5"
                    cy={imprintY + 2}
                    rx={shadowRx}
                    ry={shadowRx * TILT}
                    fill="url(#dvonn-shadow)"
                ></ellipse>
                <StackShape
                    tones={animator.flier.pieces.map((piece) => session.toneOfPiece(piece))}
                    seedKeys={animator.flier.pieces.map((piece) => coordsKey(piece.placedAt))}
                    {radius}
                />
            </g>
        </g>
    {/if}

    <g class="targets">
        {#each clickable as coords (coordsKey(coords))}
            {@const area = target(coords)}
            <ellipse
                cx={area.x}
                cy={area.y}
                rx={radius}
                ry={area.ry}
                class="target"
                role="button"
                tabindex="0"
                aria-label={describe(coords)}
                onclick={() => session.chooseSpace(coords)}
                onkeydown={(event) => onKey(event, () => session.chooseSpace(coords))}
            ></ellipse>
        {/each}
    </g>
</svg>

<style>
    .dvonn-board {
        overflow: visible;
        user-select: none;
    }

    .sand {
        fill: var(--dvonn-sand);
        stroke: var(--dvonn-sand-edge);
        stroke-width: 1.5;
    }

    .grain,
    .imprints {
        pointer-events: none;
    }

    .imprint {
        fill: none;
        stroke-width: 2.2;
    }

    .play-area {
        fill: var(--dvonn-play);
    }

    .lines line {
        stroke-linecap: butt;
        stroke: var(--dvonn-line);
        stroke-width: 1.4;
    }

    .coordinate-label {
        fill: var(--dvonn-label);
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-anchor: middle;
        dominant-baseline: central;
        pointer-events: none;
    }

    .piece,
    .flier {
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
        stroke: var(--dvonn-mark);
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
        stroke: var(--dvonn-mark);
        stroke-width: 1.4;
    }
</style>
