<script lang="ts">
    import { MediaQuery } from 'svelte/reactivity'
    import { addAxial, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
    import { isSpace, SPACES, spaceName } from '@tabletop/dvonn'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import {
        coordsKey,
        GRAPH_VIEW,
        UNLABELLED_GRAPH_VIEW,
        UNLABELLED_VIEW,
        VIEW
    } from '$lib/board/geometry.js'
    import { PIECE_MODEL, stackDiscs, TILT, topFaceY } from '$lib/board/pieceGeometry.js'
    import { markRing, outlinePath } from '$lib/board/pieceShape.js'
    import sand from '$lib/images/sand.webp'
    import { BoardAnimator, type DrawnStack } from '$lib/animators/boardAnimator.svelte.js'
    import PieceDefs from './PieceDefs.svelte'
    import StackShape from './StackShape.svelte'

    const session = getGameSession()

    // On a phone the board grows into the labels' room while they are hidden.
    const phone = new MediaQuery('width < 40rem')
    const layout = $derived.by(() => {
        const labelled = session.showCoordinates || !phone.current
        if (session.graphBoard) return labelled ? GRAPH_VIEW : UNLABELLED_GRAPH_VIEW
        return labelled ? VIEW : UNLABELLED_VIEW
    })
    const radius = VIEW.radius

    // The graph board: lines along the three directions through every space, running a short
    // whisker on past the outer spaces, as on the printed board.
    const AXES: AxialCoordinates[] = [
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: -1, r: 1 }
    ]
    const WHISKER = 0.225
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

    function stackId(key: string): string {
        return `dvonn-stack-${key.replace(',', '_')}`
    }

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
        const base = stackDiscs(1, radius)[0].base
        return outlinePath(base, topFaceY(height, radius), radius)
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
    // A mark recolors a ring just inside the rim of the stack's top piece.
    function markOn(height: number) {
        const ring = markRing(radius)
        const base = stackDiscs(Math.max(height, 1), radius).at(-1)?.base ?? 0
        return { ...ring, y: ring.y + base }
    }
</script>

<!-- A stack's shadow on the board, and right under it the board in its shade, which shows through
     the gap under the bottom piece. -->
{#snippet shadow()}
    <ellipse cx="1.5" cy="2" rx={shadowRx} ry={shadowRx * TILT} fill="url(#dvonn-shadow)"></ellipse>
    <ellipse rx={radius} ry={radius * TILT} fill="url(#dvonn-board-contact)"></ellipse>
{/snippet}

{#snippet drawn(stack: DrawnStack)}
    {@const center = layout.center(stack.coords)}
    {@const role = roleOf(stack.coords)}
    <g id={stackId(stack.key)} transform="translate({center.x} {center.y})" class="piece">
        <g {@attach animator.stack(stack.key, 'whole')}>
            <g {@attach animator.stack(stack.key, 'shadow')}>
                {@render shadow()}
            </g>
            <g {@attach animator.stack(stack.key, 'body')}>
                <StackShape
                    tones={stack.pieces.map((piece) => session.toneOfPiece(piece))}
                    seedKeys={stack.pieces.map((piece) => coordsKey(piece.placedAt))}
                    {radius}
                    prefix="dvonn-board"
                    model={animator.modelAt(stack.key)}
                />
            </g>
        </g>
        <!-- A mark recolors a ring on top of the stack. It is drawn with its stack, so
             nearer stacks cover it as they cover the pieces, but outside the stack's moving
             group: it fades with the move rather than travelling with the stack. -->
        {#if role}
            {@const ring = markOn(stack.pieces.length)}
            <g class="rim role-{role}" {@attach animator.mark()}>
                {#each ['under', 'over'] as layer (layer)}
                    <ellipse cy={ring.y} rx={ring.rx} ry={ring.ry} class={layer}></ellipse>
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
        <PieceDefs prefix="dvonn-board" />
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
        <!-- The grain, rendered once by scripts/render-sand.mjs, covering the whole frame. -->
        <image
            href={sand}
            x={layout.frame.x}
            y={layout.frame.y}
            width={layout.frame.width}
            height={layout.frame.height}
            preserveAspectRatio="xMidYMid slice"
            clip-path="url(#dvonn-sand-clip)"
            class="grain"
        ></image>
        <g class="imprints">
            {#each SPACES as coords (coordsKey(coords))}
                {@const center = layout.center(coords)}
                <g transform="translate({center.x} {center.y})">
                    <ellipse
                        rx={imprintRadius}
                        ry={imprintRadius * TILT}
                        stroke="url(#dvonn-imprint)"
                        class="imprint"
                    ></ellipse>
                    <ellipse
                        rx={imprintRadius * PIECE_MODEL.hole}
                        ry={imprintRadius * PIECE_MODEL.hole * TILT}
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
        {@const flier = animator.flier}
        {@const center = layout.center(flier.coords)}
        <g transform="translate({center.x} {center.y})" class="flier">
            <g {@attach animator.flierNode('whole')}>
                <g {@attach animator.flierNode('shadow')}>
                    {@render shadow()}
                </g>
                <g {@attach animator.flierNode('body')}>
                    <StackShape
                        tones={flier.pieces.map((piece) => session.toneOfPiece(piece))}
                        seedKeys={flier.pieces.map((piece) => coordsKey(piece.placedAt))}
                        {radius}
                        prefix="dvonn-board"
                    />
                </g>
            </g>
        </g>
        <!-- Each stack again over the flier, shown while it stands in front of it. -->
        <g class="occluders" aria-hidden="true">
            {#each stacks as stack (stack.key)}
                {#if !flier.passes.includes(stack.key)}
                    <use href="#{stackId(stack.key)}" {@attach animator.occluder(stack)}></use>
                {/if}
            {/each}
        </g>
    {/if}

    <g class="targets">
        {#each clickable as coords (coordsKey(coords))}
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
