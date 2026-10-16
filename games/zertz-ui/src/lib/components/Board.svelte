<script lang="ts">
    import { coordinatesToNumber, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
    import type { MarbleColor, Ring } from '@tabletop/zertz'
    import MarbleDefs from './MarbleDefs.svelte'
    import MarbleShape from './MarbleShape.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import {
        boardFrame,
        coordsKey,
        MARBLE_RADIUS,
        RING_MID_RADIUS,
        RING_OUTER_RADIUS,
        RING_WIDTH,
        ringCenter
    } from '$lib/board/geometry.js'

    const session = getGameSession()

    const frame = $derived(boardFrame(session.gameState.setup))
    const rings = $derived(session.gameState.board.rings)
    const removedPositions = $derived(
        frame.positions.filter((coords) => !session.gameState.board.hasRing(coords))
    )

    let hoveredKey: string | undefined = $state()

    // The outline grows outward from a fixed gap, so a thicker line never covers the ring, and
    // stays within half the space between rings, so neighbouring outlines never meet.
    const HIGHLIGHT_GAP = 0.5
    const HIGHLIGHT_WIDTH = 1.4
    const EMPHASIZED_HIGHLIGHT_WIDTH = 2

    function highlightWidth(role: RingRole, hovered: boolean): number {
        return hovered || role === 'chosen-jumper' ? EMPHASIZED_HIGHLIGHT_WIDTH : HIGHLIGHT_WIDTH
    }

    type RingRole = 'place' | 'remove' | 'land' | 'jumper' | 'chosen-jumper' | undefined

    function roleOf(ring: Ring): RingRole {
        const { coords } = ring
        if (includesCoords(session.removableRings, coords)) return 'remove'
        if (includesCoords(session.landingRings, coords)) return 'land'
        if (session.chosenJumper && sameCoordinates(session.chosenJumper, coords))
            return 'chosen-jumper'
        if (includesCoords(session.jumpers, coords)) return 'jumper'
        if (includesCoords(session.placementRings, coords)) return 'place'
        return undefined
    }

    function activate(ring: Ring, role: RingRole) {
        if (role === 'jumper' || role === 'chosen-jumper') {
            session.chooseJumper(ring.coords)
        } else if (role !== undefined) {
            void session.chooseRing(ring.coords)
        }
    }

    function onKey(event: KeyboardEvent, ring: Ring, role: RingRole) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            activate(ring, role)
        }
    }

    function isHovered(coords: AxialCoordinates): boolean {
        return hoveredKey === coordsKey(coords)
    }
</script>

<svg
    class="zertz-board"
    viewBox={frame.viewBox}
    width={frame.width}
    height={frame.height}
    role="group"
    aria-label="ZÈRTZ board"
>
    <defs>
        <MarbleDefs prefix="zertz-board" />
        <radialGradient id="zertz-ring-plastic" cx="0.4" cy="0.32" r="0.75">
            <stop offset="0" stop-color="#3d4448"></stop>
            <stop offset="0.6" stop-color="#16191b"></stop>
            <stop offset="1" stop-color="#050607"></stop>
        </radialGradient>
        <!-- Shadows are blurred on their own so the rings and marbles above them stay crisp. -->
        <filter id="zertz-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.5"></feGaussianBlur>
        </filter>
    </defs>

    {#snippet ringShadow(coords: AxialCoordinates)}
        {@const center = ringCenter(coords)}
        <circle
            cx={center.x}
            cy={center.y + 3}
            r={RING_MID_RADIUS}
            stroke-width={RING_WIDTH}
            class="ring-shadow"
        ></circle>
    {/snippet}

    {#snippet marble(color: MarbleColor, coords: AxialCoordinates, preview: boolean)}
        <g class:preview>
            {#if !preview}
                <circle r={MARBLE_RADIUS} cy="3" class="shadow" filter="url(#zertz-soft)"></circle>
            {/if}
            <MarbleShape
                prefix="zertz-board"
                {color}
                radius={MARBLE_RADIUS}
                seed={coordinatesToNumber(coords)}
            />
        </g>
    {/snippet}

    {#if session.showCoordinates}
        <g class="coordinate-labels">
            {#each session.notation.labels as label (label.key)}
                <text x={label.at.x} y={label.at.y}>{label.text}</text>
            {/each}
        </g>
    {/if}

    <!-- A removed ring leaves its shadow for the turn it sank in. -->
    <g filter="url(#zertz-soft)">
        {#each session.sinkingRings as coords (coordsKey(coords))}
            {@render ringShadow(coords)}
        {/each}
        {#each rings as ring (coordsKey(ring.coords))}
            {@render ringShadow(ring.coords)}
        {/each}
    </g>

    {#each removedPositions as coords (coordsKey(coords))}
        {@const center = ringCenter(coords)}
        <circle cx={center.x} cy={center.y} r={RING_MID_RADIUS} class="ghost"></circle>
    {/each}

    {#each rings as ring (coordsKey(ring.coords))}
        {@const center = ringCenter(ring.coords)}
        {@const role = roleOf(ring)}
        {@const interactive = role !== undefined}
        <g
            class="ring role-{role ?? 'none'}"
            class:interactive
            class:hovered={interactive && isHovered(ring.coords)}
            transform="translate({center.x} {center.y})"
            role="button"
            tabindex={interactive ? 0 : -1}
            aria-disabled={!interactive}
            aria-label="{role ?? 'ring'} {session.notation.name(ring.coords)}"
            onclick={() => activate(ring, role)}
            onkeydown={(event) => onKey(event, ring, role)}
            onpointerenter={() => (hoveredKey = coordsKey(ring.coords))}
            onpointerleave={() => (hoveredKey = undefined)}
        >
            <circle r={RING_OUTER_RADIUS} class="ring-hit"></circle>
            <circle r={RING_MID_RADIUS} stroke-width={RING_WIDTH} class="ring-body"></circle>
            <circle r={RING_OUTER_RADIUS - 1.5} class="ring-rim"></circle>
            {#if interactive}
                {@const width = highlightWidth(role, isHovered(ring.coords))}
                <circle
                    r={RING_OUTER_RADIUS + HIGHLIGHT_GAP + width / 2}
                    stroke-width={width}
                    class="ring-highlight"
                ></circle>
            {/if}
            {#if ring.marble}
                {@render marble(ring.marble, ring.coords, false)}
            {:else if role === 'place' && session.chosenColor && isHovered(ring.coords)}
                {@render marble(session.chosenColor, ring.coords, true)}
            {/if}
        </g>
    {/each}
</svg>

<style>
    .zertz-board {
        overflow: visible;
        user-select: none;
    }

    .ghost {
        fill: none;
        stroke: rgb(255 255 255 / 0.16);
        stroke-width: 2;
        stroke-dasharray: 4 5;
    }

    .coordinate-labels {
        pointer-events: none;
        fill: var(--zertz-ink-quiet);
        font-size: 17px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-anchor: middle;
        dominant-baseline: central;
    }

    .ring-shadow {
        fill: none;
        stroke: #021624;
        stroke-opacity: 0.6;
    }

    .shadow {
        fill: #021624;
        fill-opacity: 0.55;
    }

    .ring-hit {
        fill: transparent;
    }

    .ring-body {
        fill: none;
        stroke: url(#zertz-ring-plastic);
    }

    .ring-rim {
        fill: none;
        stroke: rgb(255 255 255 / 0.14);
        stroke-width: 1.5;
        pointer-events: none;
    }

    .ring-highlight {
        fill: none;
        pointer-events: none;
    }

    .ring {
        outline: none;
    }

    .interactive {
        cursor: pointer;
    }

    .role-place .ring-highlight {
        stroke: var(--zertz-place);
        stroke-opacity: 0.55;
    }

    .role-remove .ring-highlight {
        stroke: var(--zertz-remove);
        stroke-dasharray: 5 3.5;
    }

    .role-land .ring-highlight,
    .role-jumper .ring-highlight {
        stroke: var(--zertz-capture);
    }

    .role-jumper .ring-highlight {
        stroke-opacity: 0.6;
    }

    .role-chosen-jumper .ring-highlight {
        stroke: var(--zertz-capture);
    }

    .hovered .ring-highlight {
        stroke-opacity: 1;
    }

    .interactive:focus-visible .ring-highlight {
        stroke: var(--zertz-ink);
        stroke-opacity: 1;
    }

    .role-remove.hovered .ring-body {
        opacity: 0.5;
    }

    .preview {
        opacity: 0.55;
        pointer-events: none;
    }
</style>
