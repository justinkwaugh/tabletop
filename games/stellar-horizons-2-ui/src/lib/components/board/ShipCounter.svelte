<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { isCrippled, shipDefinition, type ShipState } from '@tabletop/stellar-horizons-2'
    import { SHIP_ART } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { SHIP_HEIGHT, SHIP_WIDTH } from '$lib/utils/boardLayout.js'

    let { ship, position, scale }: { ship: ShipState; position: Point; scale: number } = $props()

    const gameSession = getGameSession()
    const width = $derived(SHIP_WIDTH * scale)
    const height = $derived(SHIP_HEIGHT * scale)
    const selectable = $derived(gameSession.selectableShipIds.includes(ship.shipId))
    const selected = $derived(gameSession.selectedShip?.shipId === ship.shipId)
    const inTransit = $derived(ship.transit > 0)

    function onclick(event: MouseEvent) {
        if (!selectable) {
            return
        }
        event.stopPropagation()
        gameSession.selectShip(ship.shipId)
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<g
    class="ship"
    class:selectable
    class:in-transit={inTransit}
    transform="translate({position.x} {position.y})"
    role="button"
    tabindex="-1"
    aria-label={shipDefinition(ship.shipId).name}
    {onclick}
>
    <image
        href={SHIP_ART[ship.shipId]}
        {width}
        {height}
        filter="url(#sh-piece-shadow)"
        opacity={inTransit ? 0.6 : 1}
    ></image>
    {#if selected}
        <rect class="selection" x="-4" y="-4" width={width + 8} height={height + 8} rx="8"></rect>
    {/if}
    {#if inTransit}
        <g transform="translate({width - 10} 10)">
            <circle r="14" class="transit"></circle>
            <text class="badge-text" y="6" text-anchor="middle">{ship.transit}</text>
        </g>
    {/if}
    {#if ship.damage > 0}
        <g transform="translate({width - 10} {height - 10})">
            <rect x="-14" y="-12" width="28" height="24" rx="4" class="damage"></rect>
            <text class="badge-text" y="6" text-anchor="middle">-{ship.damage}</text>
        </g>
    {/if}
    {#if ship.settlements > 0}
        <g transform="translate(12 {height - 10})">
            <rect x="-12" y="-12" width="24" height="24" rx="12" class="cargo"></rect>
            <text class="badge-text" y="6" text-anchor="middle">{ship.settlements}</text>
        </g>
    {/if}
    {#if isCrippled(ship)}
        <title>Crippled: cannot explore until repaired</title>
    {/if}
</g>

<style>
    .ship.selectable {
        cursor: pointer;
    }

    .ship.selectable:hover image {
        filter: brightness(1.2) drop-shadow(0 0 6px #7fd3ff);
    }

    .selection {
        fill: none;
        stroke: #ffd65a;
        stroke-width: 5px;
    }

    .transit {
        fill: #10141f;
        stroke: #f2c94c;
        stroke-width: 3px;
    }

    .damage {
        fill: #b3261e;
        stroke: #ffffff;
        stroke-width: 2px;
    }

    .cargo {
        fill: #f5f1e6;
        stroke: #1d1a14;
        stroke-width: 2px;
    }

    .cargo + .badge-text {
        fill: #1d1a14;
        stroke: none;
    }

    .badge-text {
        font-size: 17px;
        font-weight: 800;
        fill: #ffffff;
    }
</style>
