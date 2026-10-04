<script lang="ts">
    // PROTOTYPE: full ship counter with badges, sized freely.
    import { SHIP_ART } from '$lib/art/manifest.js'
    import type { DisplayShip } from './prototypeState.svelte.js'

    let { ship, x, y, width }: { ship: DisplayShip; x: number; y: number; width: number } = $props()
    const height = $derived((width * 172) / 208)
    const badge = $derived(width * 0.13)
</script>

<g transform="translate({x} {y})">
    <image href={SHIP_ART[ship.shipId]} {width} {height} opacity={ship.transit > 0 ? 0.65 : 1}
    ></image>
    {#if ship.transit > 0}
        <circle
            cx={width - badge}
            cy={badge}
            r={badge}
            fill="#10141f"
            stroke="#f2c94c"
            stroke-width="2"
        ></circle>
        <text
            x={width - badge}
            y={badge * 1.45}
            text-anchor="middle"
            font-size={badge * 1.3}
            font-weight="800"
            fill="#fff">{ship.transit}</text
        >
    {/if}
    {#if ship.damage > 0}
        <rect
            x={width - badge * 2}
            y={height - badge * 1.8}
            width={badge * 2}
            height={badge * 1.6}
            rx="3"
            fill="#b3261e"
        ></rect>
        <text
            x={width - badge}
            y={height - badge * 0.6}
            text-anchor="middle"
            font-size={badge * 1.2}
            font-weight="800"
            fill="#fff">-{ship.damage}</text
        >
    {/if}
    {#if ship.settlements > 0}
        <circle cx={badge * 1.1} cy={height - badge * 1.1} r={badge} fill="#f5f1e6" stroke="#1d1a14"
        ></circle>
        <text
            x={badge * 1.1}
            y={height - badge * 0.65}
            text-anchor="middle"
            font-size={badge * 1.3}
            font-weight="800"
            fill="#1d1a14">{ship.settlements}</text
        >
    {/if}
</g>
