<script lang="ts">
    import {
        SOL_SYSTEM_ID,
        WorldSide,
        starSystemDefinition,
        type Base
    } from '@tabletop/stellar-horizons-2'
    import {
        EXPLORATION_MARKER_ART,
        SETTLEMENT_ART,
        SYSTEM_ART,
        WORLD_ART
    } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexPoints, shipScale, shipSlots, type SystemFrame } from '$lib/utils/boardLayout.js'
    import { plural, systemName } from '$lib/utils/presentation.js'
    import ShipCounter from './ShipCounter.svelte'
    import { factionGroups, shipPrototype } from './prototype/prototypeState.svelte.js'
    import ShipsVariantOrbitClumps from './prototype/ShipsVariantOrbitClumps.svelte'

    const WORLD_SIZE = 112
    const MARKER_SIZE = 74
    const BASE_SIZE = 58

    let { frame }: { frame: SystemFrame } = $props()

    const gameSession = getGameSession()
    const system = $derived(gameSession.gameState.systemState(frame.systemId))
    const ships = $derived(
        gameSession.gameState.ships.filter((ship) => ship.systemId === frame.systemId)
    )
    const bases = $derived(
        gameSession.gameState.bases.filter((base) => base.systemId === frame.systemId)
    )
    const slots = $derived(shipSlots(ships.length, frame))
    const scale = $derived(shipScale(ships.length))
    const explorationField = $derived(
        frame.systemId === SOL_SYSTEM_ID
            ? undefined
            : starSystemDefinition(frame.systemId).exploration.field
    )
    const moveTarget = $derived(
        gameSession.moveTargets.find((target) => target.systemId === frame.systemId)
    )

    function baseFaction(base: Base) {
        return gameSession.gameState.getPlayerState(base.playerId).faction
    }

    function baseOffset(index: number): number {
        return (index - (bases.length - 1) / 2) * (BASE_SIZE + 6)
    }

    async function onTileClick() {
        if (moveTarget) {
            await gameSession.moveSelectedShip(frame.systemId)
        }
    }
</script>

<g transform="translate({frame.center.x} {frame.center.y})">
    <image
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
        ></image>
    {/each}

    {#if explorationField && system.explorationMarker > 0}
        <g transform="translate({frame.marker.x} {frame.marker.y})">
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

    {#each bases as base, index (base.playerId)}
        {@const faction = baseFaction(base)}
        {#if faction}
            <g transform="translate({frame.bases.x + baseOffset(index)} {frame.bases.y})">
                <image
                    href={SETTLEMENT_ART[faction]}
                    x={-BASE_SIZE / 2}
                    y={-BASE_SIZE / 2}
                    width={BASE_SIZE}
                    height={BASE_SIZE}
                    filter="url(#sh-piece-shadow)"
                >
                    <title>{plural(base.settlements, 'settlement')}</title>
                </image>
                <text class="base-count" y={BASE_SIZE / 2 + 2} text-anchor="middle"
                    >{base.settlements}</text
                >
            </g>
        {/if}
    {/each}

    {#if shipPrototype.variant}
        {@const groups = factionGroups(gameSession.gameState, frame.systemId, shipPrototype.crowd)}
        <ShipsVariantOrbitClumps
            {frame}
            {groups}
            backing={shipPrototype.variant === 'H'
                ? 'ring'
                : shipPrototype.variant === 'J'
                  ? 'disc'
                  : 'none'}
        />
    {:else}
        {#each ships as ship, index (ship.shipId)}
            <ShipCounter {ship} position={slots[index]} {scale} />
        {/each}
    {/if}

    {#if moveTarget}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <g
            class="move-target"
            role="button"
            tabindex="-1"
            aria-label="Move to {systemName(frame.systemId)}"
            onclick={onTileClick}
        >
            <polygon points={hexPoints(frame.width, frame.height, 6)}></polygon>
            <text class="move-label" y={-frame.height * 0.3} text-anchor="middle"
                >{plural(moveTarget.turns, 'turn')}</text
            >
        </g>
    {/if}
</g>

<style>
    .marker-value {
        font-size: 34px;
        font-weight: 800;
        fill: #ffffff;
        paint-order: stroke;
        stroke: #10301a;
        stroke-width: 4px;
    }

    .base-count {
        font-size: 26px;
        font-weight: 800;
        fill: #ffffff;
        paint-order: stroke;
        stroke: #000000;
        stroke-width: 5px;
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
