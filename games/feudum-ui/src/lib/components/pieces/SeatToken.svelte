<script lang="ts">
    import { assetUrl, seatPieceAsset, type SeatPieceKind } from '$lib/art/assetMap.js'
    import { printedInk, type SeatPaint } from '$lib/model/seatPaint.js'

    /**
     * A seat's own wooden pieces: an influence marker, a player disc, a reeve. While the seat shows
     * one of the publisher's printed colours and the folder holds the print, the piece is the
     * printed one in that colour: the hexagonal marker, a disc's blank face, and for a reeve the
     * face printed for its point. Otherwise it is drawn in the seat colour (S71). Either way it
     * carries the seat's initial, so colour never stands alone.
     */
    let {
        kind,
        paint,
        size = 24,
        x,
        y
    }: {
        kind: SeatPieceKind
        paint: SeatPaint
        size?: number
        x?: number
        y?: number
    } = $props()

    const Names = { marker: 'influence marker', disc: 'player disc', reeve: 'reeve' } as const
    /** Where each print stands in the 24-unit box: the drawn piece's own extent. */
    const PrintBox = {
        marker: { x: 2.4, y: 1, width: 19.2, height: 22 },
        disc: { x: 1.5, y: 1.5, width: 21, height: 21 },
        reeve: { x: 4.5, y: 4.5, width: 15, height: 15 }
    } as const

    let label = $derived(`${paint.initial} ${Names[kind]}`)
    let printedUrl = $derived(
        paint.printed ? assetUrl(seatPieceAsset(kind, paint.printed)) : undefined
    )
    let print = $derived(PrintBox[kind])
</script>

<svg {x} {y} width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
    <title>{label}</title>
    {#if printedUrl}
        <image
            href={printedUrl}
            x={print.x}
            y={print.y}
            width={print.width}
            height={print.height}
            preserveAspectRatio="xMidYMid meet"
        ></image>
        {#if kind === 'reeve'}
            <!-- The reeve's printed face fills the disc, so its initial stands on a tab at its foot. -->
            <circle
                cx="19.5"
                cy="19.5"
                r="4.5"
                fill="var(--feudum-parchment)"
                stroke={paint.edge}
                stroke-width="0.75"
            ></circle>
            <text
                x="19.5"
                y="21.9"
                text-anchor="middle"
                font-size="6.5"
                font-weight="700"
                fill="var(--feudum-ink)">{paint.initial}</text
            >
        {:else}
            <text
                x="12"
                y={kind === 'marker' ? 15.5 : 16}
                text-anchor="middle"
                font-size={kind === 'marker' ? 9 : 11}
                font-weight="700"
                fill={paint.printed ? printedInk(paint.printed) : paint.ink}>{paint.initial}</text
            >
        {/if}
    {:else if kind === 'marker'}
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
