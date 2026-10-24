<script lang="ts">
    import {
        SOL_SYSTEM_ID,
        WorldSide,
        anomalyDifficulty,
        demandedGoods,
        eventDefinition,
        eventsIn,
        starSystemDefinition
    } from '@tabletop/stellar-horizons-2'
    import {
        DEMAND_ART,
        EVENT_ART,
        EXPLORATION_MARKER_ART,
        SYSTEM_ART,
        WORLD_ART
    } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { tileOutline, type SystemFrame } from '$lib/utils/boardLayout.js'
    import type { ShipPipLayout } from '$lib/utils/shipPipLayout.js'
    import { systemName } from '$lib/utils/presentation.js'
    import { goodName } from '$lib/utils/trade.js'
    import {
        ANOMALY_SIZE,
        DEMAND_SIZE,
        MARKER_SCALE_ON_ANOMALY,
        WORLD_SIZE,
        anomalyOutline
    } from '$lib/utils/tileFeatures.js'
    import AnomalyTile from '../AnomalyTile.svelte'
    import ShipClump from './ShipClump.svelte'
    import ShipPipBadges from './ShipPipBadges.svelte'
    import BaseTab from './BaseTab.svelte'
    import type { BaseTab as BaseTabLayout } from '$lib/utils/baseTabLayout.js'

    const MARKER_SIZE = 74
    // Events sit to the left of the anomaly's place, one after another.
    const EVENT_SIZE = 96
    const EVENT_SPACING = 104

    let {
        frame,
        bases,
        ships,
        dimmed = false
    }: {
        frame: SystemFrame
        bases: BaseTabLayout[]
        ships: ShipPipLayout
        dimmed?: boolean
    } = $props()

    const gameSession = getGameSession()
    const system = $derived(gameSession.gameState.systemState(frame.systemId))
    const events = $derived(eventsIn(gameSession.gameState, frame.systemId))
    const demand = $derived(demandedGoods(gameSession.gameState, frame.systemId))
    const explorationField = $derived(
        frame.systemId === SOL_SYSTEM_ID
            ? undefined
            : starSystemDefinition(frame.systemId).exploration.field
    )
    const clumps = $derived(
        [...new Set(ships.pips.map((pip) => pip.ship.playerId))].map((playerId) => ({
            playerId,
            pips: ships.pips.filter((pip) => pip.ship.playerId === playerId)
        }))
    )
    const mapTarget = $derived(
        gameSession.mapTargets.find((target) => target.systemId === frame.systemId)
    )

    function onTitleClick(event: MouseEvent) {
        event.stopPropagation()
        if (gameSession.focusedSystemId !== frame.systemId) {
            gameSession.focusSystem(frame.systemId)
        }
    }

    async function onTileClick() {
        if (mapTarget) {
            await gameSession.chooseMapTarget(frame.systemId)
        }
    }
</script>

<g
    transform="translate({frame.center.x} {frame.center.y})"
    data-system-id={frame.systemId}
    class="tile"
    class:dimmed
>
    <image
        class="system-art"
        pointer-events="none"
        href={SYSTEM_ART[frame.systemId]}
        x={-frame.width / 2}
        y={-frame.height / 2}
        width={frame.width}
        height={frame.height}
    ></image>

    {#each system.worlds as world, slot (`${slot}:${world.tileId}`)}
        {@const point = frame.slots[slot]}
        {@const art = WORLD_ART[world.tileId]}
        <image
            href={world.side === WorldSide.II && art.II ? art.II : art.I}
            x={point.x - WORLD_SIZE / 2}
            y={point.y - WORLD_SIZE / 2}
            width={WORLD_SIZE}
            height={WORLD_SIZE}
            clip-path="url(#sh-world-clip)"
            pointer-events="none"
        ></image>
    {/each}

    {#if frame.anomaly && system.anomaly}
        <g
            transform="translate({frame.anomaly.x} {frame.anomaly.y})"
            pointer-events="none"
            filter="url(#sh-piece-shadow)"
        >
            <polygon class="anomaly-edge" points={anomalyOutline()}></polygon>
            <AnomalyTile
                anomalyId={system.anomaly}
                turned={system.anomalyResolved ?? false}
                difficulty={anomalyDifficulty(
                    gameSession.gameState,
                    system.anomaly,
                    gameSession.myPlayerId
                )}
                width={ANOMALY_SIZE.width}
                x={-ANOMALY_SIZE.width / 2}
                y={-ANOMALY_SIZE.height / 2}
            />
        </g>
    {/if}

    {#each events as event, index (event.eventId)}
        {@const frameX = frame.anomaly ? frame.anomaly.x : frame.marker.x}
        {@const frameY = frame.anomaly ? frame.anomaly.y : frame.marker.y}
        <g
            transform="translate({frameX - (index + 1) * EVENT_SPACING} {frameY})"
            pointer-events="none"
            filter="url(#sh-piece-shadow)"
        >
            <image
                href={EVENT_ART[event.eventId]}
                x={-EVENT_SIZE / 2}
                y={-EVENT_SIZE / 2}
                width={EVENT_SIZE}
                height={EVENT_SIZE}><title>{eventDefinition(event.eventId).name}</title></image
            >
        </g>
    {/each}

    {#if explorationField && system.explorationMarker > 0}
        <g
            transform="translate({frame.marker.x} {frame.marker.y}) scale({frame.anomaly
                ? MARKER_SCALE_ON_ANOMALY
                : 1})"
            pointer-events="none"
        >
            <image
                href={EXPLORATION_MARKER_ART[explorationField]}
                x={-MARKER_SIZE / 2}
                y={-MARKER_SIZE / 2}
                width={MARKER_SIZE}
                height={MARKER_SIZE}
                filter="url(#sh-piece-shadow)"
            ></image>
            <text class="marker-value" y="16" text-anchor="middle">{system.explorationMarker}</text>
        </g>
    {/if}

    {#if demand.length > 0}
        <image
            href={DEMAND_ART[frame.systemId === SOL_SYSTEM_ID ? 'Sol' : demand[0]]}
            x={frame.demand.x - DEMAND_SIZE / 2}
            y={frame.demand.y - DEMAND_SIZE / 2}
            width={DEMAND_SIZE}
            height={DEMAND_SIZE}
            pointer-events="none"
            filter="url(#sh-piece-shadow)"
            ><title>Demand: {demand.map(goodName).join(', ')}</title></image
        >
    {/if}

    {#each bases as tab (tab.base.playerId)}
        <BaseTab {tab} />
    {/each}

    {#each clumps as clump (clump.playerId)}
        <ShipClump
            systemId={frame.systemId}
            playerId={clump.playerId}
            pips={clump.pips}
            r={ships.radius}
        />
    {/each}
    {#each clumps as clump (clump.playerId)}
        {#each clump.pips as pip (pip.ship.shipId)}
            <ShipPipBadges ship={pip.ship} x={pip.x} y={pip.y} r={ships.radius} />
        {/each}
    {/each}

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <rect
        class="title"
        x={-frame.width * 0.28}
        y={-frame.height * 0.47}
        width={frame.width * 0.56}
        height={frame.height * 0.11}
        rx="8"
        role="button"
        tabindex="-1"
        aria-label="Zoom into {systemName(frame.systemId)}"
        onclick={onTitleClick}
    ></rect>

    {#if mapTarget}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <g
            class="move-target"
            role="button"
            tabindex="-1"
            aria-label={mapTarget.action}
            onclick={onTileClick}
        >
            <polygon points={tileOutline(frame, 6)}></polygon>
            {#if mapTarget.besideDemand}
                <text
                    class="move-label"
                    x={frame.demand.x}
                    y={frame.demand.y + DEMAND_SIZE / 2 + 4}
                    dy="0.8em"
                    text-anchor="middle">{mapTarget.label}</text
                >
            {:else}
                <text class="move-label" y={-frame.height * 0.3} text-anchor="middle"
                    >{mapTarget.label}</text
                >
            {/if}
        </g>
    {/if}
</g>

<style>
    .tile {
        transition: opacity 650ms cubic-bezier(0.65, 0, 0.35, 1);
    }

    .tile.dimmed {
        opacity: 0.35;
    }

    .title {
        fill: transparent;
        stroke: transparent;
        stroke-width: 2px;
        cursor: zoom-in;
    }

    .title:hover {
        fill: rgba(127, 211, 255, 0.1);
        stroke: rgba(127, 211, 255, 0.6);
    }

    .anomaly-edge {
        fill: #05070c;
        stroke: #55637c;
        stroke-width: 2px;
        stroke-linejoin: round;
    }

    .marker-value {
        font-size: 34px;
        font-weight: 800;
        fill: #ffffff;
        paint-order: stroke;
        stroke: #10301a;
        stroke-width: 4px;
    }

    .move-target {
        cursor: pointer;
    }

    .move-target polygon {
        fill: rgba(127, 211, 255, 0.16);
        stroke: #7fd3ff;
        stroke-width: 6px;
    }

    .move-target:hover polygon {
        fill: rgba(127, 211, 255, 0.3);
    }

    .move-label {
        font-size: 36px;
        font-weight: 800;
        fill: #e8f7ff;
        paint-order: stroke;
        stroke: #05070d;
        stroke-width: 6px;
    }
</style>
