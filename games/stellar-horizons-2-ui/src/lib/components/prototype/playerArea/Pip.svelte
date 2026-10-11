<script lang="ts">
    // PROTOTYPE: a ship drawn as on the map (CV square with its size, RE diamond with its value).
    import { ShipKind, type Faction } from '@tabletop/stellar-horizons-2'
    import { FACTION_FILL } from '$lib/utils/presentation.js'
    import type { MockShip } from './campaignMock.svelte.js'

    let { ship, faction, size = 22 }: { ship: MockShip; faction: Faction; size?: number } = $props()
    const fill = $derived(FACTION_FILL[faction])
    const moving = $derived(ship.transit > 0)
    const cv = $derived(ship.ship.kind === ShipKind.CV)
    const title = $derived(
        `${cv ? `CV${ship.ship.size}` : 'RE'} ${ship.ship.name}, ${moving ? `arriving at ${ship.system} in ${ship.transit}` : `at ${ship.system}`}${ship.damage ? `, ${ship.damage} damage` : ''}${ship.settlements ? `, carrying ${ship.settlements} settlements` : ''}${ship.goods ? `, carrying ${ship.goods} goods` : ''}`
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
            stroke={ship.damage ? '#e53935' : moving ? fill : 'rgba(0,0,0,0.7)'}
            stroke-width={ship.damage || moving ? 2 : 1.2}
        ></rect>
        <text y="4.2" text-anchor="middle" class="num">{ship.ship.size}</text>
    {:else}
        <polygon
            points="0,-9.4 9.4,0 0,9.4 -9.4,0"
            fill={moving ? '#0b0f18' : fill}
            stroke={moving ? fill : 'rgba(0,0,0,0.7)'}
            stroke-width={moving ? 2 : 1.2}
            stroke-linejoin="round"
        ></polygon>
        <circle r="4.2" fill="#008ec3" stroke="#fff" stroke-width="0.8"></circle>
        <text y="2.4" text-anchor="middle" class="small">{ship.ship.exploration}</text>
    {/if}
    {#if moving}
        <circle cx="8" cy="-8" r="4" fill="#f2c94c" stroke="#000" stroke-width="0.6"></circle>
        <text x="8" y="-5.7" text-anchor="middle" class="eta">{ship.transit}</text>
    {/if}
    {#if ship.settlements + ship.goods > 0}
        <circle cx="-8" cy="-8" r="3" fill="#f5f1e6" stroke="#1d1a14" stroke-width="0.6"></circle>
    {/if}
</svg>

<style>
    svg {
        display: block;
        flex-shrink: 0;
    }
    .num {
        font-size: 12px;
        font-weight: 800;
        fill: #fff;
        paint-order: stroke;
        stroke: rgba(0, 0, 0, 0.55);
        stroke-width: 1.4px;
    }
    .small {
        font-size: 6.5px;
        font-weight: 800;
        fill: #fff;
    }
    .eta {
        font-size: 6.5px;
        font-weight: 900;
        fill: #111;
    }
</style>
