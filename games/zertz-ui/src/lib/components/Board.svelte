<script lang="ts">
    import { fade } from 'svelte/transition'
    import { coordinatesToNumber, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
    import type { MarbleColor, Ring } from '@tabletop/zertz'
    import MarbleDefs from './MarbleDefs.svelte'
    import MarbleShape from './MarbleShape.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'
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

    const animator = new BoardAnimator(session)

    const frame = $derived(boardFrame(session.gameState.setup))
    const rings = $derived(animator.rings)
    const removedPositions = $derived.by(() => {
        const present = new Set(rings.map((ring) => coordsKey(ring.coords)))
        return frame.positions.filter((coords) => !present.has(coordsKey(coords)))
    })

    let hoveredKey: string | undefined = $state()
    let focusedKey: string | undefined = $state()

    // Outlines sit just inside a ring's outer edge, so they never reach the touching neighbours.
    const HIGHLIGHT_INSET = 0.5
    const HIGHLIGHT_WIDTH = 1.4
    const EMPHASIZED_HIGHLIGHT_WIDTH = 2
    const HIGHLIGHT_FADE_IN = 120
    const HIGHLIGHT_FADE_OUT = 280

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
    {@attach animator.attach}
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

    {#snippet marble(color: MarbleColor, coords: AxialCoordinates, seed: number)}
        <circle r={MARBLE_RADIUS} cy="3" class="shadow" filter="url(#zertz-soft)"></circle>
        <MarbleShape prefix="zertz-board" {color} radius={MARBLE_RADIUS} {seed} />
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
            <g {@attach animator.shadow(coordsKey(coords))}>
                {@render ringShadow(coords)}
            </g>
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
        <g transform="translate({center.x} {center.y})">
            <g
                class="ring role-{role ?? 'none'}"
                class:interactive
                class:hovered={interactive && isHovered(ring.coords)}
                {@attach animator.ring(coordsKey(ring.coords))}
                role="button"
                tabindex={interactive ? 0 : -1}
                aria-disabled={!interactive}
                aria-label="{role ?? 'ring'} {session.notation.name(ring.coords)}"
                onclick={() => activate(ring, role)}
                onkeydown={(event) => onKey(event, ring, role)}
                onpointerenter={(event) => {
                    // A tap enters and leaves at once, so touch would only flash the preview.
                    if (event.pointerType !== 'touch') hoveredKey = coordsKey(ring.coords)
                }}
                onpointerleave={() => (hoveredKey = undefined)}
                onfocus={(event) => {
                    if (event.currentTarget.matches(':focus-visible'))
                        focusedKey = coordsKey(ring.coords)
                }}
                onblur={() => (focusedKey = undefined)}
            >
                <circle r={RING_OUTER_RADIUS} class="ring-hit"></circle>
                <circle r={RING_MID_RADIUS} stroke-width={RING_WIDTH} class="ring-body"></circle>
                <circle r={RING_OUTER_RADIUS - 1.5} class="ring-rim"></circle>
                {#if ring.marble}
                    <g {@attach animator.marble(coordsKey(ring.coords))}>
                        {@render marble(ring.marble, ring.coords, coordinatesToNumber(ring.coords))}
                    </g>
                {:else if role === 'place' && session.chosenColor && isHovered(ring.coords)}
                    <g class="preview">
                        <MarbleShape
                            prefix="zertz-board"
                            color={session.chosenColor}
                            radius={MARBLE_RADIUS}
                            seed={coordinatesToNumber(ring.coords)}
                        />
                    </g>
                {/if}
            </g>
        </g>
    {/each}

    <!-- Outlines sit above the rings rather than in them, so a ring sinks without its outline. The
         animator fades the whole layer with each move, and every new position gets a fresh one. -->
    {#key session.gameState}
        <g {@attach animator.outlines()}>
            {#each rings as ring (coordsKey(ring.coords))}
                {@const role = roleOf(ring)}
                {#if role !== undefined}
                    {@const center = ringCenter(ring.coords)}
                    {@const emphasized =
                        isHovered(ring.coords) || focusedKey === coordsKey(ring.coords)}
                    {@const width = highlightWidth(role, emphasized)}
                    <circle
                        cx={center.x}
                        cy={center.y}
                        r={RING_OUTER_RADIUS - HIGHLIGHT_INSET - width / 2}
                        stroke-width={width}
                        class="ring-highlight role-{role}"
                        class:emphasized
                        in:fade|global={{ duration: HIGHLIGHT_FADE_IN }}
                        out:fade={{ duration: HIGHLIGHT_FADE_OUT }}
                    ></circle>
                {/if}
            {/each}
        </g>
    {/key}

    {#if animator.flight}
        {@const center = ringCenter(animator.flight.from)}
        <g transform="translate({center.x} {center.y})" class="flight">
            <g {@attach animator.flier()}>
                {@render marble(animator.flight.color, animator.flight.from, animator.flight.seed)}
            </g>
        </g>
    {/if}
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

    .ring-highlight.role-place {
        stroke: var(--zertz-place);
        stroke-opacity: 0.55;
    }

    .ring-highlight.role-remove {
        stroke: var(--zertz-remove);
        stroke-dasharray: 5 3.5;
    }

    .ring-highlight.role-land,
    .ring-highlight.role-jumper,
    .ring-highlight.role-chosen-jumper {
        stroke: var(--zertz-capture);
    }

    .ring-highlight.role-jumper {
        stroke-opacity: 0.6;
    }

    .ring-highlight.emphasized {
        stroke-opacity: 1;
    }

    .role-remove.hovered .ring-body {
        opacity: 0.5;
    }

    .preview {
        opacity: 0.55;
        pointer-events: none;
    }

    .flight {
        pointer-events: none;
    }
</style>
