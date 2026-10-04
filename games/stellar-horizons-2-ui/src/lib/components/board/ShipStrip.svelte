<script lang="ts">
    import { shipDefinition, type ShipState } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        SHIP_COUNTER_ASPECT,
        type BoardLayout,
        type SystemFrame
    } from '$lib/utils/boardLayout.js'
    import type { ShipPipLayout } from '$lib/utils/shipPipLayout.js'
    import { plural } from '$lib/utils/presentation.js'
    import ShipCounter from './ShipCounter.svelte'

    const COUNTER_WIDTH = 160
    const COUNTER_HEIGHT = COUNTER_WIDTH * SHIP_COUNTER_ASPECT
    const PADDING = 10
    const GAP = 10
    const CAPTION = 22
    const PER_ROW = 8
    const OFFSET = 12

    let {
        layout,
        systems
    }: { layout: BoardLayout; systems: { frame: SystemFrame; ships: ShipPipLayout }[] } = $props()

    const gameSession = getGameSession()

    const strip = $derived.by(() => {
        const clump = gameSession.inspectedClump
        if (!clump) return undefined
        const system = systems.find((candidate) => candidate.frame.systemId === clump.systemId)
        const pips = system?.ships.pips.filter((pip) => pip.ship.playerId === clump.playerId) ?? []
        if (!system || pips.length === 0) return undefined
        const columns = Math.min(PER_ROW, clump.ships.length)
        const rows = Math.ceil(clump.ships.length / PER_ROW)
        const cellHeight = COUNTER_HEIGHT + CAPTION
        const width = PADDING * 2 + columns * COUNTER_WIDTH + (columns - 1) * GAP
        const height = PADDING * 2 + rows * cellHeight + (rows - 1) * GAP
        const anchorX =
            system.frame.center.x + pips.reduce((sum, pip) => sum + pip.x, 0) / pips.length
        const top =
            system.frame.center.y + Math.min(...pips.map((pip) => pip.y)) - system.ships.radius
        const bottom =
            system.frame.center.y + Math.max(...pips.map((pip) => pip.y)) + system.ships.radius
        const x = Math.max(4, Math.min(layout.width - width - 4, anchorX - width / 2))
        const above = top - OFFSET - height
        const y = above >= 4 ? above : Math.min(layout.height - height - 4, bottom + OFFSET)
        return {
            x,
            y,
            width,
            height,
            cells: clump.ships.map((ship, index) => ({
                ship,
                x: PADDING + (index % PER_ROW) * (COUNTER_WIDTH + GAP),
                y: PADDING + Math.floor(index / PER_ROW) * (cellHeight + GAP)
            }))
        }
    })

    function caption(ship: ShipState): string {
        const name = shipDefinition(ship.shipId).name
        return ship.transit > 0 ? `${name} · in ${plural(ship.transit, 'turn')}` : name
    }

    function choose(event: MouseEvent, ship: ShipState) {
        event.stopPropagation()
        if (gameSession.selectableShipIds.includes(ship.shipId)) {
            gameSession.selectShipFromClump(ship.shipId)
        }
    }

    function onKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            gameSession.closeClump()
        }
    }
</script>

<svelte:window onkeydown={onKeydown} />

{#if strip}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <g
        transform="translate({strip.x} {strip.y})"
        aria-label="Ships here"
        onclick={(event) => event.stopPropagation()}
    >
        <rect width={strip.width} height={strip.height} rx="12" class="frame"></rect>
        {#each strip.cells as cell (cell.ship.shipId)}
            {@const selectable = gameSession.selectableShipIds.includes(cell.ship.shipId)}
            {@const selected = gameSession.selectedShip?.shipId === cell.ship.shipId}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <g
                transform="translate({cell.x} {cell.y})"
                class="cell"
                class:selectable
                role="button"
                tabindex="-1"
                aria-label={shipDefinition(cell.ship.shipId).name}
                aria-disabled={!selectable}
                onclick={(event) => choose(event, cell.ship)}
            >
                <ShipCounter ship={cell.ship} width={COUNTER_WIDTH} />
                {#if selected}
                    <rect
                        x="-3"
                        y="-3"
                        width={COUNTER_WIDTH + 6}
                        height={COUNTER_HEIGHT + 6}
                        rx="6"
                        class="selected"
                    ></rect>
                {/if}
                <text
                    x={COUNTER_WIDTH / 2}
                    y={COUNTER_HEIGHT + CAPTION - 5}
                    text-anchor="middle"
                    class="caption">{caption(cell.ship)}</text
                >
            </g>
        {/each}
    </g>
{/if}

<style>
    .frame {
        fill: rgba(6, 10, 20, 0.95);
        stroke: #7fd3ff;
        stroke-width: 2px;
    }

    .cell.selectable {
        cursor: pointer;
    }

    .cell.selectable:hover {
        filter: brightness(1.15) drop-shadow(0 0 6px #7fd3ff);
    }

    .selected {
        fill: none;
        stroke: #ffd65a;
        stroke-width: 4px;
    }

    .caption {
        font-size: 14px;
        font-weight: 600;
        fill: #e8f4ff;
    }
</style>
