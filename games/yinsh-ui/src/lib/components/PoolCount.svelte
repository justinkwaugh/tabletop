<script lang="ts">
    import { VIEW } from '$lib/board/geometry.js'
    import { MARKER_HEIGHT, MARKER_RADIUS } from '$lib/board/pieceGeometry.js'
    import PieceDefs from './PieceDefs.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import MarkerShape from './MarkerShape.svelte'

    const session = getGameSession()

    const count = $derived(session.gameState.markersInPool())

    // Two markers from the pool, a white one lying across a black one below and to its left.
    const OFFSET = MARKER_RADIUS * 0.45
    const reach = MARKER_RADIUS + OFFSET + 1
    const lift = VIEW.height(MARKER_HEIGHT)
</script>

<div class="pool" title="Markers left in the pool">
    <svg
        width="26"
        height="26"
        viewBox="{-reach} {-reach - lift} {reach * 2} {reach * 2 + lift}"
        aria-hidden="true"
    >
        <defs><PieceDefs prefix="pool" /></defs>
        <g transform="translate({-OFFSET} {OFFSET})">
            <MarkerShape tone="black" seedKey="pool-under" prefix="pool" />
        </g>
        <g transform="translate({OFFSET} {-OFFSET})">
            <MarkerShape tone="white" seedKey="pool-top" prefix="pool" />
        </g>
    </svg>
    <strong>{count}</strong>
    <span class="max-sm:hidden">{count === 1 ? 'marker' : 'markers'} left</span>
</div>

<style>
    .pool {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 15px;
        letter-spacing: 0.04em;
        color: var(--yinsh-table-ink-quiet);
        white-space: nowrap;
    }

    .pool strong {
        font-size: 17px;
        color: var(--yinsh-table-ink);
        font-variant-numeric: tabular-nums;
    }

    @media (max-width: 639px) {
        .pool strong {
            font-size: 14px;
        }
    }
</style>
