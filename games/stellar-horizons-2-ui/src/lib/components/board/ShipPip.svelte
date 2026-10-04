<script lang="ts">
    import {
        Faction,
        ShipKind,
        isCrippled,
        shipDefinition,
        type ShipState
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { FACTION_FILL } from '$lib/utils/presentation.js'

    const APPROACHING_FILL = 'rgba(0,0,0,0.55)'
    const PROBE_SCALE = 0.8

    let {
        ship,
        x,
        y,
        r: cellRadius
    }: { ship: ShipState; x: number; y: number; r: number } = $props()

    const gameSession = getGameSession()
    const definition = $derived(shipDefinition(ship.shipId))
    const r = $derived(definition.kind === ShipKind.RE ? cellRadius * PROBE_SCALE : cellRadius)
    const faction = $derived(gameSession.gameState.getPlayerState(ship.playerId).faction)
    const fill = $derived(faction ? FACTION_FILL[faction] : '#6f84a3')
    const outline = $derived(
        faction === Faction.Transhumanists ? 'rgba(220,228,240,0.85)' : 'rgba(0,0,0,0.7)'
    )
    const approaching = $derived(ship.transit > 0)
    const halfSide = $derived(r * 0.85)
    const selected = $derived(gameSession.selectedShip?.shipId === ship.shipId)
</script>

<g class="pip" transform="translate({x} {y})">
    {#if selected}
        <circle r={r + 6} class="selection"></circle>
    {/if}
    {#if definition.kind === ShipKind.RE}
        <circle
            {r}
            fill={approaching ? APPROACHING_FILL : fill}
            stroke={approaching ? fill : outline}
            stroke-width={approaching ? 3 : 2.5}
        ></circle>
        <circle r={r * 0.5} stroke-width={Math.max(1.2, r * 0.08)} class="exploration"></circle>
        <text y={r * 0.22} text-anchor="middle" font-size={r * 0.62} class="exploration-value"
            >{definition.exploration}</text
        >
    {:else}
        <rect
            x={-halfSide}
            y={-halfSide}
            width={halfSide * 2}
            height={halfSide * 2}
            rx={r * 0.32}
            fill={approaching ? APPROACHING_FILL : fill}
            stroke={approaching ? fill : outline}
            stroke-width={approaching ? 3 : 2.5}
        ></rect>
        <text y={r * 0.38} text-anchor="middle" font-size={r * 1.05} class="size"
            >{definition.size}</text
        >
    {/if}
    {#if ship.damage > 0}
        <rect
            x={-r * 0.45}
            y={r * 0.7}
            width={r * 0.9}
            height={r * 0.32}
            rx="1"
            class="damage"
            class:crippled={isCrippled(ship)}
        ></rect>
    {/if}
    {#if ship.settlements > 0}
        <circle cx={-r * 0.95} cy={-r * 0.7} r={r * 0.32} class="cargo"></circle>
    {/if}
    {#if approaching}
        <circle cx={r * 0.85} cy={-r * 0.85} r={r * 0.55} class="eta"></circle>
        <text
            x={r * 0.85}
            y={-r * 0.85 + r * 0.22}
            text-anchor="middle"
            font-size={r * 0.7}
            class="eta-text">{ship.transit}</text
        >
    {/if}
</g>

<style>
    .selection {
        fill: none;
        stroke: #ffd65a;
        stroke-width: 4px;
    }

    .size {
        font-weight: 800;
        fill: #ffffff;
        paint-order: stroke;
        stroke: rgba(0, 0, 0, 0.55);
        stroke-width: 2.5px;
    }

    .exploration {
        fill: #008ec3;
        stroke: #ffffff;
    }

    .exploration-value {
        font-weight: 800;
        fill: #ffffff;
    }

    .damage {
        fill: #e53935;
    }

    .damage.crippled {
        stroke: #ffffff;
        stroke-width: 1.5px;
    }

    .cargo {
        fill: #f5f1e6;
        stroke: #1d1a14;
        stroke-width: 1px;
    }

    .eta {
        fill: #f2c94c;
        stroke: #000000;
        stroke-width: 1.5px;
    }

    .eta-text {
        font-weight: 900;
        fill: #111111;
    }
</style>
