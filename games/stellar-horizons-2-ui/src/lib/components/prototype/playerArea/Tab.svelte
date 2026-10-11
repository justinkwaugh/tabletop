<script lang="ts">
    // PROTOTYPE: a base drawn as its map tab: faction colour, settlement count, angled end.
    import type { Faction } from '@tabletop/stellar-horizons-2'
    import { FACTION_FILL } from '$lib/utils/presentation.js'

    let {
        faction,
        settlements,
        height = 20,
        blockaded = false
    }: { faction: Faction; settlements: number; height?: number; blockaded?: boolean } = $props()
    const width = $derived(height * (0.9 + String(settlements).length * 0.5))
    const slant = $derived(height * 0.42)
</script>

<svg
    {width}
    {height}
    viewBox="0 0 {width} {height}"
    role="img"
    aria-label="{settlements} settlements"
>
    <polygon
        points="0.8,0.8 {width - slant},0.8 {width - 0.8},{height - 0.8} 0.8,{height - 0.8}"
        fill={FACTION_FILL[faction]}
        stroke={blockaded ? '#e53935' : 'rgba(0,0,0,0.75)'}
        stroke-width={blockaded ? 2 : 1.2}
        stroke-linejoin="round"
    ></polygon>
    <text
        x={(width - slant * 0.6) / 2}
        y={height * 0.74}
        text-anchor="middle"
        font-size={height * 0.7}>{settlements}</text
    >
</svg>

<style>
    svg {
        display: block;
        flex-shrink: 0;
    }
    text {
        font-weight: 900;
        fill: #fff;
        paint-order: stroke;
        stroke: rgba(0, 0, 0, 0.65);
        stroke-width: 2px;
    }
</style>
