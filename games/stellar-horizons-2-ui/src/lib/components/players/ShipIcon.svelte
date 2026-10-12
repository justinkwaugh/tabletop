<script lang="ts">
    // A ship drawn as on the star map: a CV square with its size, an RE diamond with its
    // exploration value, outlined while in transit, with a red edge when damaged.
    import {
        ShipKind,
        shipDefinition,
        type Faction,
        type ShipState
    } from '@tabletop/stellar-horizons-2'
    import { FACTION_FILL, plural, systemName } from '$lib/utils/presentation.js'

    let {
        ship,
        faction,
        size = 20
    }: { ship: ShipState; faction: Faction; size?: number } = $props()
    const definition = $derived(shipDefinition(ship.shipId))
    const fill = $derived(FACTION_FILL[faction])
    const moving = $derived(ship.transit > 0)
    const cv = $derived(definition.kind === ShipKind.CV)
    const title = $derived(
        [
            `${cv ? `CV${definition.size}` : 'RE'} ${definition.name}`,
            moving
                ? `arriving at ${systemName(ship.systemId)} in ${plural(ship.transit, 'turn')}`
                : `at ${systemName(ship.systemId)}`,
            ship.damage > 0 ? `${ship.damage} damage` : '',
            ship.settlements > 0 ? `carrying ${plural(ship.settlements, 'settlement')}` : ''
        ]
            .filter(Boolean)
            .join(', ')
    )
</script>

<svg width={size} height={size} viewBox="-12 -12 24 24" role="img" aria-label={title}>
    <title>{title}</title>
    {#if cv}
        <rect
            x="-9"
            y="-9"
            width="18"
            height="18"
            rx="3.5"
            fill={moving ? '#0b0f18' : fill}
            stroke={ship.damage > 0 ? '#e53935' : moving ? fill : 'rgba(0,0,0,0.7)'}
            stroke-width={ship.damage > 0 || moving ? 2 : 1.2}
        ></rect>
        <text y="4.2" text-anchor="middle" class="size">{definition.size}</text>
    {:else}
        <polygon
            points="0,-9.4 9.4,0 0,9.4 -9.4,0"
            fill={moving ? '#0b0f18' : fill}
            stroke={moving ? fill : 'rgba(0,0,0,0.7)'}
            stroke-width={moving ? 2 : 1.2}
            stroke-linejoin="round"
        ></polygon>
        <circle r="4.2" fill="#008ec3" stroke="#fff" stroke-width="0.8"></circle>
        <text y="2.4" text-anchor="middle" class="value">{definition.exploration}</text>
    {/if}
    {#if ship.settlements > 0}
        <circle cx="-8" cy="-8" r="3" fill="#f5f1e6" stroke="#1d1a14" stroke-width="0.6"></circle>
    {/if}
</svg>

<style>
    svg {
        display: block;
        flex-shrink: 0;
    }

    .size {
        font-size: 12px;
        font-weight: 800;
        fill: #fff;
        paint-order: stroke;
        stroke: rgba(0, 0, 0, 0.55);
        stroke-width: 1.4px;
    }

    .value {
        font-size: 6.5px;
        font-weight: 800;
        fill: #fff;
    }
</style>
