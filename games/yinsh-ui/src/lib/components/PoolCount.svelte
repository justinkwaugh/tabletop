<script lang="ts">
    import { MARKER_RADIUS, MARKER_SIDE } from '$lib/board/pieceGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import MarkerShape from './MarkerShape.svelte'

    const session = getGameSession()

    const count = $derived(session.gameState.markersInPool())

    // Two markers from the pool, a white one lying across a black one below and to its left.
    const OFFSET = MARKER_RADIUS * 0.45
    const reach = MARKER_RADIUS + OFFSET + 1
</script>

<div class="pool" title="Markers left in the pool">
    <svg
        width="26"
        height="26"
        viewBox="{-reach} {-reach} {reach * 2} {reach * 2 + MARKER_SIDE}"
        aria-hidden="true"
    >
        <g transform="translate({-OFFSET} {OFFSET})">
            <MarkerShape tone="black" seedKey="pool-under" />
        </g>
        <g transform="translate({OFFSET} {-OFFSET})">
            <MarkerShape tone="white" seedKey="pool-top" />
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
        color: var(--yinsh-ink-quiet);
        white-space: nowrap;
    }

    .pool strong {
        font-size: 17px;
        color: var(--yinsh-ink);
        font-variant-numeric: tabular-nums;
    }

    @media (max-width: 639px) {
        .pool strong {
            font-size: 14px;
        }
    }
</style>
