<script lang="ts">
    // The badges on a ship pip's top corners: cargo aboard on the left, turns until arrival on
    // the right. The tile draws them above every pip, so no ship hides another's badge.
    import { ShipKind, shipDefinition, type ShipState } from '@tabletop/stellar-horizons-2'
    import { PROBE_SCALE } from './pipGeometry.js'

    let {
        ship,
        x,
        y,
        r: cellRadius
    }: { ship: ShipState; x: number; y: number; r: number } = $props()

    const r = $derived(
        shipDefinition(ship.shipId).kind === ShipKind.RE ? cellRadius * PROBE_SCALE : cellRadius
    )
</script>

{#if ship.settlements > 0 || ship.transit > 0}
    <g class="badges" transform="translate({x} {y})">
        {#if ship.settlements > 0}
            <circle
                cx={-r * 0.8}
                cy={-r * 0.8}
                r={r * 0.34}
                stroke-width={Math.max(0.6, r * 0.05)}
                class="cargo"
            ></circle>
        {/if}
        {#if ship.transit > 0}
            <circle
                cx={r * 0.8}
                cy={-r * 0.8}
                r={r * 0.34}
                stroke-width={Math.max(0.6, r * 0.05)}
                class="eta"
            ></circle>
            <text
                x={r * 0.8}
                y={-r * 0.8 + r * 0.15}
                text-anchor="middle"
                font-size={r * 0.45}
                class="eta-text">{ship.transit}</text
            >
        {/if}
    </g>
{/if}

<style>
    /* Clicks pass through to the clump underneath. */
    .badges {
        pointer-events: none;
    }

    .cargo {
        fill: #f5f1e6;
        stroke: #1d1a14;
    }

    .eta {
        fill: #f2c94c;
        stroke: #000000;
    }

    .eta-text {
        font-weight: 900;
        fill: #111111;
    }
</style>
