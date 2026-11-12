<script lang="ts">
    import { assetUrl, seatPieceAsset, type SeatPieceKind } from '$lib/art/assetMap.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'

    /**
     * A seat's own wooden pieces: an influence marker, a player disc, a reeve. While the seat shows
     * one of the publisher's printed colours and the folder holds the print, the piece is the
     * printed one in that colour: the hexagonal marker, a disc's blank face, and for a reeve the
     * face printed for its point. Otherwise it is drawn in the seat colour (S71). Neither carries a
     * letter: the seat is named in its accessible name and tooltip ("Ana's influence marker"), and
     * a player who needs more than colour turns on the platform's colour-blind palette, under which
     * every piece is drawn in the colour that palette chose. Printed or drawn, each piece has a dark
     * outline and a small shadow, drawn as shapes so a phone renders them.
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

    const OutlineWidth = 4
    const ShadowDrop = 2.5

    let label = $derived(`${paint.owner} ${Names[kind]}`)
    let printedUrl = $derived(
        paint.printed ? assetUrl(seatPieceAsset(kind, paint.printed)) : undefined
    )
    let print = $derived(PrintBox[kind])
</script>

{#snippet silhouette(lift: Record<string, string | number | boolean>)}
    {#if printedUrl && kind === 'marker'}
        <polygon points="12,1 21.6,6.5 21.6,17.5 12,23 2.4,17.5 2.4,6.5" {...lift}></polygon>
    {:else if kind === 'marker'}
        <path d="M3 10 A9 5 0 0 1 21 10 L21 15 A9 5 0 0 1 3 15 Z" {...lift}></path>
    {:else}
        <circle cx="12" cy="12" r={kind === 'disc' ? 10.5 : 7.5} {...lift}></circle>
    {/if}
{/snippet}

<svg
    {x}
    {y}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    overflow="visible"
    role="img"
    aria-label={label}
>
    <title>{label}</title>
    {@render silhouette({
        transform: `translate(0 ${ShadowDrop})`,
        fill: 'var(--feudum-halo)',
        'fill-opacity': 0.45,
        'data-piece-shadow': true
    })}
    {@render silhouette({
        fill: 'var(--feudum-map-ink)',
        stroke: 'var(--feudum-map-ink)',
        'stroke-width': OutlineWidth,
        'stroke-linejoin': 'round',
        'data-piece-outline': true
    })}
    {#if printedUrl}
        <image
            href={printedUrl}
            x={print.x}
            y={print.y}
            width={print.width}
            height={print.height}
            preserveAspectRatio="xMidYMid meet"
        ></image>
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
    {:else if kind === 'disc'}
        <circle cx="12" cy="12" r="10.5" fill={paint.fill} stroke={paint.edge} stroke-width="1"
        ></circle>
    {:else}
        <circle cx="12" cy="12" r="7.5" fill={paint.fill} stroke={paint.edge} stroke-width="1"
        ></circle>
    {/if}
</svg>
