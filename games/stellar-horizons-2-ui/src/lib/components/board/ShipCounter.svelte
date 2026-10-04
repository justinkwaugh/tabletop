<script lang="ts">
    import type { ShipState } from '@tabletop/stellar-horizons-2'
    import { SHIP_ART } from '$lib/art/manifest.js'
    import { SHIP_COUNTER_ASPECT } from '$lib/utils/boardLayout.js'

    let { ship, width }: { ship: ShipState; width: number } = $props()
    const height = $derived(width * SHIP_COUNTER_ASPECT)
    const badge = $derived(width * 0.12)
</script>

<image href={SHIP_ART[ship.shipId]} {width} {height}></image>
{#if ship.transit > 0}
    <circle cx={width - badge} cy={badge} r={badge} class="eta"></circle>
    <text
        x={width - badge}
        y={badge * 1.42}
        text-anchor="middle"
        font-size={badge * 1.25}
        class="eta-text">{ship.transit}</text
    >
{/if}
{#if ship.damage > 0}
    <rect
        x={width - badge * 2.2}
        y={height - badge * 1.8}
        width={badge * 2.2}
        height={badge * 1.6}
        rx="3"
        class="damage"
    ></rect>
    <text
        x={width - badge * 1.1}
        y={height - badge * 0.55}
        text-anchor="middle"
        font-size={badge * 1.2}
        class="badge-text">-{ship.damage}</text
    >
{/if}
{#if ship.settlements > 0}
    <circle cx={badge * 1.1} cy={height - badge * 1.1} r={badge} class="cargo"></circle>
    <text
        x={badge * 1.1}
        y={height - badge * 0.65}
        text-anchor="middle"
        font-size={badge * 1.25}
        class="cargo-text">{ship.settlements}</text
    >
{/if}

<style>
    .eta {
        fill: #f2c94c;
        stroke: #000000;
        stroke-width: 2px;
    }

    .eta-text,
    .cargo-text {
        font-weight: 900;
        fill: #111111;
    }

    .damage {
        fill: #b3261e;
        stroke: #ffffff;
        stroke-width: 1.5px;
    }

    .badge-text {
        font-weight: 800;
        fill: #ffffff;
    }

    .cargo {
        fill: #f5f1e6;
        stroke: #1d1a14;
        stroke-width: 1.5px;
    }
</style>
