<script lang="ts">
    import type { Point } from '@tabletop/common'
    import {
        ActionType,
        WorkerActionType,
        isSiteId,
        type Building,
        type BuildingSiteId,
        type BusNodeId
    } from '@tabletop/bus'
    import BuildingTypePicker from './BuildingTypePicker.svelte'
    import BuildingSiteHighlight from './BuildingSiteHighlight.svelte'
    import BusLineLayer from './BusLineLayer.svelte'
    import PlacedBuilding from './PlacedBuilding.svelte'
    import Passenger from './Passenger.svelte'
    import WorkerCylinder from './WorkerCylinder.svelte'
    import {
        BUS_BOARD_NODE_POINTS,
        BUS_BUILDING_SITE_POINTS,
        BUS_EXPANSION_ACTION_SPOT_POINTS,
        BUS_BUSES_ACTION_SPOT_POINT,
        BUS_PASSENGERS_ACTION_SPOT_POINTS,
        BUS_BUILDINGS_ACTION_SPOT_POINTS,
        BUS_CLOCK_ACTION_SPOT_POINT,
        BUS_VROOM_ACTION_SPOT_POINTS,
        BUS_STARTING_PLAYER_ACTION_SPOT_POINT
    } from '$lib/definitions/busBoardGraph.js'
    import boardImg from '$lib/images/bus_board.jpg'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const BOARD_WIDTH = 1839
    const BOARD_HEIGHT = 1300
    const ACTION_CYLINDER_X_OFFSET = 0
    const ACTION_CYLINDER_Y_OFFSET = -3

    type ActionWorkerPlacement = {
        key: string
        playerId: string
        point: Point
    }

    type ActionSpotHighlight = {
        key: string
        actionType: WorkerActionType
        point: Point
    }

    // This is mildly more efficient than iterating by node and calculating passengers for each node.
    let passengersByNodeId = $derived.by(() => {
        return gameSession.gameState.board.passengersByNode()
    })

    let highlightedBuildingSiteIds: BuildingSiteId[] = $derived.by(() => {
        if (!gameSession.isInitialBuildingPlacement) {
            return []
        }
        return gameSession.gameState.board
            .openSitesForPhase(gameSession.gameState.currentBuildingPhase)
            .map((site) => site.id)
            .filter((siteId) => isSiteId(siteId))
    })

    let placedBuildings: (Building & { site: BuildingSiteId })[] = $derived.by(() => {
        return Object.values(gameSession.gameState.board.buildings).filter((building) =>
            isSiteId(building.site)
        ) as (Building & { site: BuildingSiteId })[]
    })

    let chosenBuildingSiteId = $derived.by(() => {
        const chosenSite = gameSession.chosenSite
        if (!chosenSite || !isSiteId(chosenSite)) {
            return undefined
        }
        return chosenSite
    })

    let buildingTypePickerPoint = $derived.by(() => {
        if (!chosenBuildingSiteId) {
            return { x: 0, y: 0 }
        }

        return BUS_BUILDING_SITE_POINTS[chosenBuildingSiteId]
    })

    let actionWorkerPlacements: ActionWorkerPlacement[] = $derived.by(() => {
        const placements: ActionWorkerPlacement[] = []
        const state = gameSession.gameState

        pushQueuePlacements(
            placements,
            WorkerActionType.Expansion,
            state.lineExpansionAction,
            BUS_EXPANSION_ACTION_SPOT_POINTS,
            true
        )
        pushSinglePlacement(placements, WorkerActionType.Buses, state.busAction, BUS_BUSES_ACTION_SPOT_POINT)
        pushQueuePlacements(
            placements,
            WorkerActionType.Passengers,
            state.passengersAction,
            BUS_PASSENGERS_ACTION_SPOT_POINTS
        )
        pushQueuePlacements(
            placements,
            WorkerActionType.Buildings,
            state.buildingAction,
            BUS_BUILDINGS_ACTION_SPOT_POINTS,
            true
        )
        pushSinglePlacement(placements, WorkerActionType.Clock, state.clockAction, BUS_CLOCK_ACTION_SPOT_POINT)
        pushQueuePlacements(placements, WorkerActionType.Vroom, state.vroomAction, BUS_VROOM_ACTION_SPOT_POINTS)
        pushSinglePlacement(
            placements,
            WorkerActionType.StartingPlayer,
            state.startingPlayerAction,
            BUS_STARTING_PLAYER_ACTION_SPOT_POINT
        )

        return placements
    })

    let availableActionSpotHighlights: ActionSpotHighlight[] = $derived.by(() => {
        if (!gameSession.isMyTurn || !gameSession.validActionTypes.includes(ActionType.ChooseWorkerAction)) {
            return []
        }

        const state = gameSession.gameState
        const highlights: ActionSpotHighlight[] = []

        pushAvailableQueueSpot(
            highlights,
            WorkerActionType.Expansion,
            BUS_EXPANSION_ACTION_SPOT_POINTS,
            state.lineExpansionAction.length,
            true
        )
        pushAvailableSingleSpot(
            highlights,
            WorkerActionType.Buses,
            BUS_BUSES_ACTION_SPOT_POINT,
            !state.busAction
        )
        pushAvailableQueueSpot(
            highlights,
            WorkerActionType.Passengers,
            BUS_PASSENGERS_ACTION_SPOT_POINTS,
            state.passengersAction.length
        )
        pushAvailableQueueSpot(
            highlights,
            WorkerActionType.Buildings,
            BUS_BUILDINGS_ACTION_SPOT_POINTS,
            state.buildingAction.length,
            true
        )
        pushAvailableSingleSpot(highlights, WorkerActionType.Clock, BUS_CLOCK_ACTION_SPOT_POINT, !state.clockAction)
        pushAvailableQueueSpot(
            highlights,
            WorkerActionType.Vroom,
            BUS_VROOM_ACTION_SPOT_POINTS,
            state.vroomAction.length
        )
        pushAvailableSingleSpot(
            highlights,
            WorkerActionType.StartingPlayer,
            BUS_STARTING_PLAYER_ACTION_SPOT_POINT,
            !state.startingPlayerAction
        )

        return highlights
    })

    const actionHighlightColor = $derived.by(() => {
        return gameSession.colors.getPlayerUiColor(gameSession.myPlayer?.id)
    })

    function handleBuildingSiteChoose(siteId: BuildingSiteId) {
        gameSession.chosenSite = siteId
    }

    function handleActionSpotChoose(actionType: WorkerActionType) {
        void gameSession.chooseWorkerAction(actionType)
    }

    function pushSinglePlacement(
        placements: ActionWorkerPlacement[],
        actionType: WorkerActionType,
        playerId: string | undefined,
        point: Point
    ) {
        if (!playerId) {
            return
        }

        placements.push({
            key: `${actionType}:${playerId}`,
            playerId,
            point
        })
    }

    function pushQueuePlacements(
        placements: ActionWorkerPlacement[],
        actionType: WorkerActionType,
        playerIds: string[],
        points: Point[],
        reversePhysicalRow = false
    ) {
        const max = Math.min(playerIds.length, points.length)
        for (let selectionIndex = 0; selectionIndex < max; selectionIndex += 1) {
            const playerId = playerIds[selectionIndex]
            const point = reversePhysicalRow
                ? points[points.length - 1 - selectionIndex]
                : points[selectionIndex]

            placements.push({
                // selectionIndex matches A(0),B(1),...,F(5) regardless of row direction.
                key: `${actionType}:${selectionIndex}:${playerId}`,
                playerId,
                point
            })
        }
    }

    function pushAvailableSingleSpot(
        highlights: ActionSpotHighlight[],
        actionType: WorkerActionType,
        point: Point,
        isAvailable: boolean
    ) {
        if (!isAvailable) {
            return
        }

        highlights.push({
            key: `${actionType}:available`,
            actionType,
            point
        })
    }

    function pushAvailableQueueSpot(
        highlights: ActionSpotHighlight[],
        actionType: WorkerActionType,
        points: Point[],
        nextSelectionIndex: number,
        reversePhysicalRow = false
    ) {
        if (nextSelectionIndex < 0 || nextSelectionIndex >= points.length) {
            return
        }

        const pointIndex = reversePhysicalRow ? points.length - 1 - nextSelectionIndex : nextSelectionIndex
        const point = points[pointIndex]
        if (!point) {
            return
        }

        highlights.push({
            // Selection index is A(0), B(1), ... regardless of physical direction.
            key: `${actionType}:${nextSelectionIndex}:available`,
            actionType,
            point
        })
    }
</script>

<div class="board-shell">
    <div class="board-surface relative h-[1300px] w-[1839px]">
        <img src={boardImg} alt="game board" class="board-image absolute inset-0 h-full w-full" />
        <BusLineLayer />
        <svg
            class="absolute inset-0 z-[2] h-full w-full"
            viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
            aria-label="Passenger overlay"
        >
            <defs>
                <filter id="textshadow" x="-15%" y="-15%" width="130%" height="130%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="shadow"
                    ></feGaussianBlur>
                    <feOffset dx="2" dy="2"></feOffset>
                </filter>
                <linearGradient id="action-spot-sweep-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="1"></stop>
                    <stop offset="42%" stop-color="#ffffff" stop-opacity="0.5"></stop>
                    <stop offset="100%" stop-color={actionHighlightColor} stop-opacity="1"></stop>
                </linearGradient>
            </defs>

            <g
                id="bus-building-picker-ref"
                style="transform:translate({buildingTypePickerPoint.x}px, {buildingTypePickerPoint.y}px);"
            >
                <rect width="1" height="1" fill="transparent"></rect>
            </g>

            {#each placedBuildings as building (building.id)}
                <PlacedBuilding siteId={building.site} buildingType={building.type} />
            {/each}

            {#each actionWorkerPlacements as placement (placement.key)}
                <WorkerCylinder
                    x={placement.point.x + ACTION_CYLINDER_X_OFFSET}
                    y={placement.point.y + ACTION_CYLINDER_Y_OFFSET}
                    color={gameSession.colors.getPlayerUiColor(placement.playerId)}
                />
            {/each}

            {#each availableActionSpotHighlights as highlight (highlight.key)}
                <g class="action-spot-highlight">
                    <circle
                        cx={highlight.point.x}
                        cy={highlight.point.y}
                        r="16.2"
                        fill="none"
                        stroke={actionHighlightColor}
                        stroke-width="5.6"
                        opacity="0.9"
                        pointer-events="none"
                    />
                    <circle
                        class="action-spot-sweep"
                        cx={highlight.point.x}
                        cy={highlight.point.y}
                        r="16.2"
                        fill="none"
                        stroke="url(#action-spot-sweep-gradient)"
                        stroke-width="5.6"
                        stroke-linecap="round"
                        pointer-events="none"
                    />
                    <circle
                        cx={highlight.point.x}
                        cy={highlight.point.y}
                        r="21.5"
                        fill="transparent"
                        class="cursor-pointer"
                        onclick={() => handleActionSpotChoose(highlight.actionType)}
                    />
                </g>
            {/each}

            {#each highlightedBuildingSiteIds as siteId (siteId)}
                <BuildingSiteHighlight
                    {siteId}
                    isSelected={siteId === chosenBuildingSiteId}
                    onChoose={handleBuildingSiteChoose}
                />
            {/each}

            {#each Object.entries(passengersByNodeId) as [nodeId, passengers] (nodeId)}
                {@const point = BUS_BOARD_NODE_POINTS[nodeId as BusNodeId]}
                <Passenger x={point.x} y={point.y} count={passengers.length} />
            {/each}
        </svg>

        {#if chosenBuildingSiteId}
            <BuildingTypePicker />
        {/if}
    </div>
</div>

<style>
    .board-shell {
        position: relative;
        display: inline-flex;
        padding: 10px;
        border-radius: 20px;
        background:
            radial-gradient(980px 620px at 14% 10%, rgba(255, 255, 255, 0.4), transparent 64%),
            repeating-linear-gradient(
                -30deg,
                rgba(126, 134, 148, 0.018) 0 2px,
                rgba(255, 255, 255, 0.015) 2px 7px
            ),
            #eceae4;
    }

    .board-surface {
        border-radius: 14px;
        overflow: hidden;
        box-shadow:
            0 0 0 5px rgba(123, 131, 146, 0.24),
            0 10px 22px rgba(17, 24, 39, 0.12);
    }

    .board-image {
        filter: none;
    }

    .action-spot-sweep {
        opacity: 0.96;
        stroke-dasharray: 27 79;
        transform-origin: center;
        transform-box: fill-box;
        animation: action-spot-spin 2800ms linear infinite;
    }

    @keyframes action-spot-spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .action-spot-sweep {
            animation: none;
        }
    }
</style>
