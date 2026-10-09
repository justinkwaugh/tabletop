<script lang="ts">
    import { ROUTE_TILES, ROUTE_TILE_BACK } from '$lib/utils/redesignArt.js'

    let {
        value,
        knownValue,
        x,
        y,
        size
    }: { value?: number; knownValue?: number; x: number; y: number; size: number } = $props()
</script>

<!-- Centred on (x, y). -->
<g transform="translate({x - size / 2} {y - size / 2})">
    <rect x="1.5" y="2.5" width={size} height={size} rx="4" fill="#2a1a0c" opacity="0.35"></rect>
    <image
        href={value === undefined ? ROUTE_TILE_BACK : ROUTE_TILES[value]}
        width={size}
        height={size}
        clip-path="inset(0 round 4px)"
    ></image>
    {#if value === undefined && knownValue !== undefined}
        <circle cx={size - 11} cy={size - 11} r="10" fill="#2a1a0c"></circle>
        <text
            x={size - 11}
            y={size - 6.5}
            text-anchor="middle"
            font-family="Libre Baskerville"
            font-weight="700"
            font-size="13"
            fill="#f6e7b8">{knownValue}</text
        >
    {/if}
</g>
