<script lang="ts">
    import { assetUrl, ReeveAsset } from '$lib/art/assetMap.js'
    import type { SeatPaint, SeatPieceKind } from '$lib/model/seatPaint.js'

    let {
        kind,
        paint,
        size = 24,
        x,
        y,
        label: named
    }: {
        kind: SeatPieceKind
        paint: SeatPaint
        size?: number
        x?: number
        y?: number
        label?: string
    } = $props()

    const Names = { marker: 'influence marker', disc: 'player disc', reeve: 'reeve' } as const
    /** R-4.7 A reeve is a player disc showing its printed point. */
    const DiscRadius = 10.5
    const DrawnReeveRadius = 7.5
    const PrintBox = { x: 1.5, y: 1.5, width: 21, height: 21 } as const
    const Hexagon = '12,1 21.6,6.5 21.6,17.5 12,23 2.4,17.5 2.4,6.5'

    const OutlineWidth = 4
    const ShadowDrop = 2.5

    let label = $derived(named ?? `${paint.owner} ${Names[kind]}`)
    let reevePrint = $derived(kind === 'reeve' && paint.printed ? assetUrl(ReeveAsset) : undefined)
    let radius = $derived(kind === 'reeve' && !reevePrint ? DrawnReeveRadius : DiscRadius)
</script>

{#snippet silhouette(lift: Record<string, string | number | boolean>)}
    {#if kind === 'marker'}
        <polygon points={Hexagon} {...lift}></polygon>
    {:else}
        <circle cx="12" cy="12" r={DiscRadius} {...lift}></circle>
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
    {#if kind === 'marker'}
        <polygon points={Hexagon} fill={paint.fill} stroke={paint.edge} stroke-width="1"></polygon>
    {:else}
        <circle cx="12" cy="12" r={radius} fill={paint.fill} stroke={paint.edge} stroke-width="1"
        ></circle>
    {/if}
    {#if reevePrint}
        <image
            href={reevePrint}
            x={PrintBox.x}
            y={PrintBox.y}
            width={PrintBox.width}
            height={PrintBox.height}
            preserveAspectRatio="xMidYMid meet"
        ></image>
    {/if}
</svg>
