<script lang="ts">
    import type { SeatPaint } from '$lib/model/seatPaint.js'

    /**
     * A seat's own wooden pieces. They take a seat colour, so they are always drawn (S71), each with
     * the seat's initial so colour never stands alone: an influence marker, a player disc, a reeve.
     */
    let {
        kind,
        paint,
        size = 24,
        x,
        y
    }: {
        kind: 'marker' | 'disc' | 'reeve'
        paint: SeatPaint
        size?: number
        x?: number
        y?: number
    } = $props()

    const Names = { marker: 'influence marker', disc: 'player disc', reeve: 'reeve' } as const
    let label = $derived(`${paint.initial} ${Names[kind]}`)
</script>

<svg {x} {y} width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
    <title>{label}</title>
    {#if kind === 'marker'}
        <path
            d="M3 10 L3 15 A9 5 0 0 0 21 15 L21 10 Z"
            fill={paint.fill}
            stroke={paint.edge}
            stroke-width="1"
        ></path>
        <ellipse
            cx="12"
            cy="10"
            rx="9"
            ry="5"
            fill={paint.fill}
            stroke={paint.edge}
            stroke-width="1"
        ></ellipse>
        <text x="12" y="13" text-anchor="middle" font-size="8" font-weight="700" fill={paint.ink}
            >{paint.initial}</text
        >
    {:else if kind === 'disc'}
        <circle cx="12" cy="12" r="10.5" fill={paint.fill} stroke={paint.edge} stroke-width="1"
        ></circle>
        <text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill={paint.ink}
            >{paint.initial}</text
        >
    {:else}
        <circle cx="12" cy="12" r="7.5" fill={paint.fill} stroke={paint.edge} stroke-width="1"
        ></circle>
        <text x="12" y="15" text-anchor="middle" font-size="8" font-weight="700" fill={paint.ink}
            >{paint.initial}</text
        >
    {/if}
</svg>
