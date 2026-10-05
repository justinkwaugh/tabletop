<script lang="ts">
    import { SOL_SYSTEM_ID, WorldSide, starSystemDefinition } from '@tabletop/stellar-horizons-2'
    import { EXPLORATION_MARKER_ART, SYSTEM_ART, WORLD_ART } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { tileOutline, type SystemFrame } from '$lib/utils/boardLayout.js'
    import type { ShipPipLayout } from '$lib/utils/shipPipLayout.js'
    import { plural, systemName } from '$lib/utils/presentation.js'
    import ShipClump from './ShipClump.svelte'
    import BaseTab from './BaseTab.svelte'
    import type { BaseTab as BaseTabLayout } from '$lib/utils/baseTabLayout.js'

    const WORLD_SIZE = 112
    const MARKER_SIZE = 74

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
    const moveTarget = $derived(
        gameSession.moveTargets.find((target) => target.systemId === frame.systemId)
    )

    function onTitleClick(event: MouseEvent) {
        event.stopPropagation()
        if (gameSession.focusedSystemId !== frame.systemId) {
            gameSession.focusSystem(frame.systemId)
        }
    }

    async function onTileClick() {
        if (moveTarget) {
            await gameSession.moveSelectedShip(frame.systemId)
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

    {#if explorationField && system.explorationMarker > 0}
        <g transform="translate({frame.marker.x} {frame.marker.y})" pointer-events="none">
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

    {#if moveTarget}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <g
            class="move-target"
            role="button"
            tabindex="-1"
            aria-label="Move to {systemName(frame.systemId)}"
            onclick={onTileClick}
        >
            <polygon points={tileOutline(frame, 6)}></polygon>
            <text class="move-label" y={-frame.height * 0.3} text-anchor="middle"
                >{plural(moveTarget.turns, 'turn')}</text
            >
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
