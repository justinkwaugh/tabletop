<script lang="ts">
    // PROTOTYPE: compact ship glyph. CV = circle with its size, RE = diamond; a ship still on its
    // way is drawn as a faction-coloured outline with a gold badge giving the turns until
    // arrival; red bar = damage; white dot = cargo.
    import { Faction, ShipKind, shipDefinition } from '@tabletop/stellar-horizons-2'
    import { FACTION_FILL } from '$lib/utils/presentation.js'
    import type { DisplayShip } from './prototypeState.svelte.js'

    const APPROACHING_FILL = 'rgba(0,0,0,0.55)'

    let { ship, x, y, r }: { ship: DisplayShip; x: number; y: number; r: number } = $props()
    const definition = $derived(shipDefinition(ship.shipId))
    const isProbe = $derived(definition.kind === ShipKind.RE)
    const fill = $derived(FACTION_FILL[ship.faction])
    const moving = $derived(ship.transit > 0)
    const d = $derived(r * 0.78)
    const outline = $derived(
        ship.faction === Faction.Transhumanists ? 'rgba(220,228,240,0.85)' : 'rgba(0,0,0,0.7)'
    )
</script>

<g transform="translate({x} {y})">
    <title>{definition.name}{moving ? ` (arrives in ${ship.transit})` : ''}</title>
    <g>
        {#if isProbe}
            <rect
                x={-d}
                y={-d}
                width={d * 2}
                height={d * 2}
                rx="2"
                transform="rotate(45)"
                fill={moving ? APPROACHING_FILL : fill}
                stroke={moving ? fill : outline}
                stroke-width={moving ? 3 : 2.5}
            ></rect>
        {:else}
            <circle
                {r}
                fill={moving ? APPROACHING_FILL : fill}
                stroke={moving ? fill : outline}
                stroke-width={moving ? 3 : 2.5}
            ></circle>
            <text
                y={r * 0.38}
                text-anchor="middle"
                font-size={r * 1.05}
                font-weight="800"
                fill="#fff"
                class="size">{definition.size}</text
            >
        {/if}
        {#if ship.damage > 0}
            <rect x={-r * 0.45} y={r * 0.7} width={r * 0.9} height={r * 0.32} rx="1" fill="#e53935"
            ></rect>
        {/if}
        {#if ship.settlements > 0}
            <circle
                cx={-r * 0.95}
                cy={-r * 0.7}
                r={r * 0.32}
                fill="#f5f1e6"
                stroke="#1d1a14"
                stroke-width="1"
            ></circle>
        {/if}
    </g>
    {#if moving}
        <circle
            cx={r * 0.85}
            cy={-r * 0.85}
            r={r * 0.55}
            fill="#f2c94c"
            stroke="#000"
            stroke-width="1.5"
        ></circle>
        <text
            x={r * 0.85}
            y={-r * 0.85 + r * 0.22}
            text-anchor="middle"
            font-size={r * 0.7}
            font-weight="900"
            fill="#111">{ship.transit}</text
        >
    {/if}
</g>

<style>
    .size {
        paint-order: stroke;
        stroke: rgba(0, 0, 0, 0.55);
        stroke-width: 2.5px;
    }
</style>
