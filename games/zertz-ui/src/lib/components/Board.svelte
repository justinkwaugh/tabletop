<script lang="ts">
    import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
    import type { Ring } from '@tabletop/zertz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import {
        boardFrame,
        coordsKey,
        MARBLE_RADIUS,
        RING_INNER_RADIUS,
        RING_OUTER_RADIUS,
        ringCenter
    } from '$lib/board/geometry.js'

    const session = getGameSession()

    const frame = $derived(boardFrame(session.gameState.setup))
    const rings = $derived(session.gameState.board.rings)
    const removedPositions = $derived(
        frame.positions.filter((coords) => !session.gameState.board.hasRing(coords))
    )

    let hoveredKey: string | undefined = $state()

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
        <radialGradient id="zertz-marble-white" cx="0.35" cy="0.32" r="0.75">
            <stop offset="0" stop-color="#ffffff"></stop>
            <stop offset="0.5" stop-color="#ece8df"></stop>
            <stop offset="1" stop-color="#b3ab9b"></stop>
        </radialGradient>
        <radialGradient id="zertz-marble-grey" cx="0.35" cy="0.32" r="0.75">
            <stop offset="0" stop-color="#dadddf"></stop>
            <stop offset="0.5" stop-color="#8e9497"></stop>
            <stop offset="1" stop-color="#4a5053"></stop>
        </radialGradient>
        <radialGradient id="zertz-marble-black" cx="0.35" cy="0.32" r="0.75">
            <stop offset="0" stop-color="#70777a"></stop>
            <stop offset="0.5" stop-color="#25292b"></stop>
            <stop offset="1" stop-color="#050606"></stop>
        </radialGradient>
        <radialGradient id="zertz-ring-surface" cx="0.4" cy="0.35" r="0.8">
            <stop offset="0" stop-color="#fbf8f1"></stop>
            <stop offset="1" stop-color="#d4ccb9"></stop>
        </radialGradient>
        <filter id="zertz-drop" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#000" flood-opacity="0.5"
            ></feDropShadow>
        </filter>
    </defs>

    {#each removedPositions as coords (coordsKey(coords))}
        {@const center = ringCenter(coords)}
        <circle cx={center.x} cy={center.y} r={RING_OUTER_RADIUS * 0.82} class="ghost"></circle>
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
            aria-label="{role ?? 'ring'} {ring.coords.q},{ring.coords.r}"
            onclick={() => activate(ring, role)}
            onkeydown={(event) => onKey(event, ring, role)}
            onpointerenter={() => (hoveredKey = coordsKey(ring.coords))}
            onpointerleave={() => (hoveredKey = undefined)}
        >
            <circle r={RING_OUTER_RADIUS} class="ring-body" filter="url(#zertz-drop)"></circle>
            <circle r={RING_INNER_RADIUS} class="ring-hole"></circle>
            {#if interactive}
                <circle r={RING_OUTER_RADIUS + 3} class="ring-highlight"></circle>
            {/if}
            {#if ring.marble}
                <circle
                    r={MARBLE_RADIUS}
                    fill="url(#zertz-marble-{ring.marble})"
                    filter="url(#zertz-drop)"
                ></circle>
            {:else if role === 'place' && session.chosenColor && isHovered(ring.coords)}
                <circle
                    r={MARBLE_RADIUS}
                    fill="url(#zertz-marble-{session.chosenColor})"
                    class="preview"
                ></circle>
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
        stroke: rgb(255 255 255 / 0.07);
        stroke-width: 2;
        stroke-dasharray: 4 5;
    }

    .ring-body {
        fill: url(#zertz-ring-surface);
        stroke: var(--zertz-ring-shade);
        stroke-width: 1;
    }

    .ring-hole {
        fill: var(--zertz-felt-deep);
    }

    .ring-highlight {
        fill: none;
        stroke-width: 4;
        pointer-events: none;
    }

    .interactive {
        cursor: pointer;
        outline: none;
    }

    .role-place .ring-highlight {
        stroke: var(--zertz-place);
        stroke-opacity: 0.55;
    }

    .role-remove .ring-highlight {
        stroke: var(--zertz-remove);
        stroke-dasharray: 7 5;
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
        stroke-width: 7;
    }

    .hovered .ring-highlight,
    .interactive:focus-visible .ring-highlight {
        stroke-width: 7;
        stroke-opacity: 1;
    }

    .role-remove.hovered .ring-body {
        opacity: 0.55;
    }

    .preview {
        opacity: 0.55;
        pointer-events: none;
    }
</style>
