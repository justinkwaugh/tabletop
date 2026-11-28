<script lang="ts">
    import type { PointSettlementKind } from '@tabletop/south-african-railroads'
    import { SETTLEMENT_SYMBOLS } from '$lib/utils/settlementSymbols.js'
    import { polygonPoints } from '$lib/utils/shapes.js'

    let {
        kind,
        fill,
        size,
        strokeWidth = 1.6
    }: { kind: PointSettlementKind; fill?: string; size?: number; strokeWidth?: number } = $props()

    const shape = $derived(SETTLEMENT_SYMBOLS[kind].shape)
    const radius = $derived(size ?? SETTLEMENT_SYMBOLS[kind].size)
    const stroke = $derived(fill ? '#0d1219' : undefined)
    const width = $derived(fill ? strokeWidth : undefined)
</script>

{#if shape === 'square'}
    <rect
        x={-radius}
        y={-radius}
        width={radius * 2}
        height={radius * 2}
        rx="2"
        {fill}
        {stroke}
        stroke-width={width}
    ></rect>
{:else if shape === 'hexagon'}
    <polygon points={polygonPoints(6, radius)} {fill} {stroke} stroke-width={width}></polygon>
{:else if shape === 'circle'}
    <circle r={radius} {fill} {stroke} stroke-width={width}></circle>
{:else if shape === 'triangle'}
    <polygon points={polygonPoints(3, radius, 90)} {fill} {stroke} stroke-width={width}></polygon>
{:else}
    <polygon points={polygonPoints(5, radius)} {fill} {stroke} stroke-width={width}></polygon>
{/if}
