<script lang="ts">
    import type { Point } from '@tabletop/common'
    import {
        ActionType,
        BUS_STATION_IDS,
        WorkerActionType,
        isSiteId,
        type Building,
        type BuildingSiteId,
        type BusNodeId,
        type BusStationId
    } from '@tabletop/bus'
    import AddPassengersPicker from './AddPassengersPicker.svelte'
    import BuildingTypePicker from './BuildingTypePicker.svelte'
    import BuildingSiteHighlight from './BuildingSiteHighlight.svelte'
    import BusLineLayer from './BusLineLayer.svelte'
    import PlacedBuilding from './PlacedBuilding.svelte'
    import Passenger from './Passenger.svelte'
    import StationSelectionHighlight from './StationSelectionHighlight.svelte'
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
    const ACTION_SPOT_HIGHLIGHT_RADIUS = 13.3
    const ACTION_VALUE_CYLINDER_TEXT_Y_OFFSET = 8
    const HIGHLIGHT_ACTION_VALUE_CIRCLE_RADIUS = 15.5
    const HIGHLIGHT_ACTION_VALUE_CIRCLE_STROKE_WIDTH = 1.6
    const HIGHLIGHT_ACTION_VALUE_TEXT_Y_OFFSET = 1.5
    const CYLINDER_ACTION_VALUE_FONT_SIZE = 20
    const HIGHLIGHT_ACTION_VALUE_FONT_SIZE = 18
    const SITE_PASSENGER_HEIGHT = 44
    const NODE_PASSENGER_HEIGHT = 74
    const VROOM_SOURCE_HOVER_PASSENGER_HEIGHT = 80
    const NON_SELECTED_VROOM_PASSENGER_MASK_OPACITY = 0.5
    const VROOM_PASSENGER_HIT_RADIUS = 34

    type ActionWorkerPlacement = {
        key: string
        actionType: WorkerActionType
        playerId: string
        point: Point
        selectionIndex?: number
    }

    type ActionSpotHighlight = {
        key: string
        actionType: WorkerActionType
        point: Point
        selectionIndex?: number
    }

    type ActionValueBadge = {
        key: string
        point: Point
        value?: number
        playerId?: string
        showText?: boolean
    }

    type SitePassengerPlacement = {
        id: string
        siteId: BuildingSiteId
    }

    // This is mildly more efficient than iterating by node and calculating passengers for each node.
    let passengersByNodeId = $derived.by(() => {
        return gameSession.gameState.board.passengersByNode()
    })

    let passengersAtSite: SitePassengerPlacement[] = $derived.by(() => {
        const placements: SitePassengerPlacement[] = []
        for (const passenger of gameSession.gameState.board.passengers) {
            if (!passenger.siteId || !isSiteId(passenger.siteId)) {
                continue
            }
            placements.push({
                id: passenger.id,
                siteId: passenger.siteId
            })
        }
        return placements
    })

    let highlightedBuildingSiteIds: BuildingSiteId[] = $derived.by(() => {
        if (!gameSession.isInitialBuildingPlacement && !gameSession.isAddingBuildings) {
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

    let highlightedPassengerStationIds: BusStationId[] = $derived.by(() => {
        if (
            !gameSession.isMyTurn ||
            !gameSession.validActionTypes.includes(ActionType.AddPassengers)
        ) {
            return []
        }
        return [...BUS_STATION_IDS]
    })

    let chosenPassengerStationId: BusStationId | undefined = $derived.by(() => {
        return gameSession.chosenPassengerStationId
    })

    let addPassengersPickerPoint = $derived.by(() => {
        if (!chosenPassengerStationId) {
            return { x: 0, y: 0 }
        }

        return BUS_BOARD_NODE_POINTS[chosenPassengerStationId]
    })

    let chosenVroomSourceNodeId: BusNodeId | undefined = $derived.by(() => {
        return gameSession.chosenVroomSourceNodeId
    })
    let hoveredVroomSourceNodeId: BusNodeId | undefined = $state()

    let highlightedVroomSourceNodeIds: BusNodeId[] = $derived.by(() => {
        if (chosenVroomSourceNodeId) {
            return []
        }
        return gameSession.deliverableVroomSourceNodeIds
    })

    let highlightedVroomDestinationSiteIds: BuildingSiteId[] = $derived.by(() => {
        if (!chosenVroomSourceNodeId) {
            return []
        }
        return gameSession.vroomDestinationSiteIds
    })

    const isChoosingVroomSourcePassenger = $derived.by(() => {
        return gameSession.canVroom && highlightedVroomSourceNodeIds.length > 0
    })

    const shouldMaskUnselectedVroomPassengers = $derived.by(() => {
        return isChoosingVroomSourcePassenger || !!chosenVroomSourceNodeId
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
        pushSinglePlacement(
            placements,
            WorkerActionType.Buses,
            state.busAction,
            BUS_BUSES_ACTION_SPOT_POINT
        )
        pushQueuePlacements(
            placements,
            WorkerActionType.Passengers,
            state.passengersAction,
            BUS_PASSENGERS_ACTION_SPOT_POINTS,
            false,
            state.passengerTurnsTaken ?? 0
        )
        pushQueuePlacements(
            placements,
            WorkerActionType.Buildings,
            state.buildingAction,
            BUS_BUILDINGS_ACTION_SPOT_POINTS,
            true
        )
        pushSinglePlacement(
            placements,
            WorkerActionType.Clock,
            state.clockAction,
            BUS_CLOCK_ACTION_SPOT_POINT
        )
        pushQueuePlacements(
            placements,
            WorkerActionType.Vroom,
            state.vroomAction,
            BUS_VROOM_ACTION_SPOT_POINTS,
            false,
            state.vroomTurnsTaken ?? 0
        )
        pushSinglePlacement(
            placements,
            WorkerActionType.StartingPlayer,
            state.startingPlayerAction,
            BUS_STARTING_PLAYER_ACTION_SPOT_POINT
        )

        return placements
    })

    const actionValueBadges: ActionValueBadge[] = $derived.by(() => {
        const state = gameSession.gameState
        const currentMaxBusValue = state.players.reduce((max, playerState) => {
            return Math.max(max, playerState.buses)
        }, 0)
        const busesActionPlayerState = state.players.find(
            (playerState) => playerState.playerId === state.busAction
        )
        const busesActionIncreasesMax =
            busesActionPlayerState !== undefined &&
            busesActionPlayerState.buses + 1 > currentMaxBusValue

        const projectedPassengerAndBuildingBase =
            state.roundStartMaxBusValue + (busesActionIncreasesMax ? 1 : 0)

        const playerBusValues = new Map<string, number>(
            state.players.map((playerState) => [playerState.playerId, playerState.buses])
        )
        const myPlayerId = gameSession.myPlayer?.id

        const resolveActionValue = (
            actionType: WorkerActionType,
            selectionIndex: number,
            playerId?: string
        ): number | undefined => {
            switch (actionType) {
                case WorkerActionType.Expansion:
                    return Math.max(0, state.roundStartMaxBusValue - selectionIndex)
                case WorkerActionType.Passengers:
                case WorkerActionType.Buildings:
                    return Math.max(0, projectedPassengerAndBuildingBase - selectionIndex)
                case WorkerActionType.Vroom: {
                    const effectivePlayerId = playerId ?? myPlayerId
                    if (!effectivePlayerId) {
                        return undefined
                    }
                    const baseBusValue = playerBusValues.get(effectivePlayerId) ?? 0
                    const playerGetsBusBonus = state.busAction === effectivePlayerId
                    return Math.max(0, baseBusValue + (playerGetsBusBonus ? 1 : 0) - selectionIndex)
                }
                default:
                    return undefined
            }
        }

        const badges: ActionValueBadge[] = []
        for (const placement of actionWorkerPlacements) {
            if (placement.selectionIndex === undefined) {
                continue
            }

            const value = resolveActionValue(
                placement.actionType,
                placement.selectionIndex,
                placement.playerId
            )
            if (value === undefined) {
                continue
            }

            badges.push({
                key: `${placement.key}:value`,
                point: {
                    x: placement.point.x + ACTION_CYLINDER_X_OFFSET,
                    y:
                        placement.point.y +
                        ACTION_CYLINDER_Y_OFFSET +
                        ACTION_VALUE_CYLINDER_TEXT_Y_OFFSET
                },
                value,
                playerId: placement.playerId
            })
        }

        for (const highlight of availableActionSpotHighlights) {
            if (highlight.selectionIndex === undefined) {
                continue
            }

            if (highlight.actionType === WorkerActionType.Vroom) {
                badges.push({
                    key: `highlight:${highlight.key}:value`,
                    point: {
                        x: highlight.point.x,
                        y: highlight.point.y
                    },
                    showText: false
                })
                continue
            }

            const value = resolveActionValue(highlight.actionType, highlight.selectionIndex)
            if (value === undefined) {
                continue
            }

            badges.push({
                key: `highlight:${highlight.key}:value`,
                point: {
                    x: highlight.point.x,
                    y: highlight.point.y
                },
                value,
                showText: true
            })
        }

        return badges
    })

    let availableActionSpotHighlights: ActionSpotHighlight[] = $derived.by(() => {
        if (
            !gameSession.isMyTurn ||
            !gameSession.validActionTypes.includes(ActionType.ChooseWorkerAction)
        ) {
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
        pushAvailableSingleSpot(
            highlights,
            WorkerActionType.Clock,
            BUS_CLOCK_ACTION_SPOT_POINT,
            !state.clockAction
        )
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
    const highlightValueCircleColor = $derived.by(() => {
        return gameSession.colors.getPlayerUiColor(gameSession.myPlayer?.id)
    })
    const highlightValueCircleFillColor = $derived.by(() => {
        return mixHex(highlightValueCircleColor, '#ffffff', 0.24)
    })
    const highlightValueTextColor = $derived.by(() => {
        return actionValueTextColor(gameSession.myPlayer?.id)
    })

    function handleBuildingSiteChoose(siteId: BuildingSiteId) {
        gameSession.chosenSite = siteId
    }

    function handlePassengerStationChoose(stationId: BusStationId) {
        gameSession.chosenPassengerStationId = stationId
    }

    function handleVroomSourceNodeChoose(nodeId: BusNodeId) {
        gameSession.chooseVroomSourceNode(nodeId)
    }

    function handleVroomDestinationSiteChoose(siteId: BuildingSiteId) {
        void gameSession.chooseVroomDestinationSite(siteId)
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
            actionType,
            playerId,
            point
        })
    }

    function pushQueuePlacements(
        placements: ActionWorkerPlacement[],
        actionType: WorkerActionType,
        playerIds: string[],
        points: Point[],
        reversePhysicalRow = false,
        skipSelectionCount = 0
    ) {
        const normalizedSkipSelectionCount = Math.max(0, skipSelectionCount)

        if (normalizedSkipSelectionCount >= points.length) {
            return
        }

        const availablePointCount = points.length - normalizedSkipSelectionCount
        const max = Math.min(playerIds.length, availablePointCount)
        for (let selectionIndex = 0; selectionIndex < max; selectionIndex += 1) {
            const playerId = playerIds[selectionIndex]
            const absoluteSelectionIndex = selectionIndex + normalizedSkipSelectionCount
            const point = reversePhysicalRow
                ? points[points.length - 1 - absoluteSelectionIndex]
                : points[absoluteSelectionIndex]

            placements.push({
                // absoluteSelectionIndex matches A(0),B(1),...,F(5) regardless of row direction.
                key: `${actionType}:${absoluteSelectionIndex}:${playerId}`,
                actionType,
                playerId,
                point,
                selectionIndex: absoluteSelectionIndex
            })
        }
    }

    function clamp255(value: number): number {
        return Math.max(0, Math.min(255, Math.round(value)))
    }

    function parseHexColor(input: string): [number, number, number] | undefined {
        const normalized = input.trim()
        const shortMatch = normalized.match(/^#([0-9a-fA-F]{3})$/)
        if (shortMatch) {
            const [r, g, b] = shortMatch[1].split('').map((channel) => {
                return parseInt(channel + channel, 16)
            })
            return [r, g, b]
        }

        const longMatch = normalized.match(/^#([0-9a-fA-F]{6})$/)
        if (!longMatch) {
            return undefined
        }

        const hex = longMatch[1]
        return [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16)
        ]
    }

    function mixHex(a: string, b: string, t: number): string {
        const parsedA = parseHexColor(a)
        const parsedB = parseHexColor(b)
        if (!parsedA || !parsedB) {
            return a
        }

        const blend = (from: number, to: number): number => clamp255(from + (to - from) * t)
        return (
            '#' +
            [blend(parsedA[0], parsedB[0]), blend(parsedA[1], parsedB[1]), blend(parsedA[2], parsedB[2])]
                .map((channel) => channel.toString(16).padStart(2, '0'))
                .join('')
        )
    }

    function actionValueTextColor(playerId?: string): string {
        if (!playerId) {
            return '#333'
        }

        const textColorClass = gameSession.colors.getPlayerTextColor(playerId)
        if (textColorClass.includes('text-black')) {
            return '#111'
        }
        if (textColorClass.includes('text-white')) {
            return '#ffffff'
        }

        const arbitraryMatch = textColorClass.match(/text-\[(#[0-9a-fA-F]{3,8})\]/)
        if (arbitraryMatch) {
            return arbitraryMatch[1]
        }

        return '#ffffff'
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

        const pointIndex = reversePhysicalRow
            ? points.length - 1 - nextSelectionIndex
            : nextSelectionIndex
        const point = points[pointIndex]
        if (!point) {
            return
        }

        highlights.push({
            // Selection index is A(0), B(1), ... regardless of physical direction.
            key: `${actionType}:${nextSelectionIndex}:available`,
            actionType,
            point,
            selectionIndex: nextSelectionIndex
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
            </defs>

            <g
                id="bus-building-picker-ref"
                style="transform:translate({buildingTypePickerPoint.x}px, {buildingTypePickerPoint.y}px);"
            >
                <rect width="1" height="1" fill="transparent"></rect>
            </g>
            <g
                id="bus-add-passengers-picker-ref"
                style="transform:translate({addPassengersPickerPoint.x}px, {addPassengersPickerPoint.y}px);"
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

            {#each actionValueBadges as badge (badge.key)}
                <g class="pointer-events-none" aria-hidden="true">
                    {#if !badge.playerId}
                        <circle
                            cx={badge.point.x}
                            cy={badge.point.y}
                            r={HIGHLIGHT_ACTION_VALUE_CIRCLE_RADIUS}
                            fill={highlightValueCircleFillColor}
                            stroke={highlightValueCircleColor}
                            stroke-width={HIGHLIGHT_ACTION_VALUE_CIRCLE_STROKE_WIDTH}
                        ></circle>
                    {/if}
                    {#if badge.showText !== false && badge.value !== undefined}
                        <text
                            x={badge.point.x}
                            y={badge.point.y +
                                (badge.playerId ? 0 : HIGHLIGHT_ACTION_VALUE_TEXT_Y_OFFSET)}
                            text-anchor="middle"
                            dominant-baseline="middle"
                            font-size={badge.playerId
                                ? CYLINDER_ACTION_VALUE_FONT_SIZE
                                : HIGHLIGHT_ACTION_VALUE_FONT_SIZE}
                            font-weight="700"
                            fill={badge.playerId
                                ? actionValueTextColor(badge.playerId)
                                : highlightValueTextColor}>{badge.value}</text
                        >
                    {/if}
                </g>
            {/each}

            {#each availableActionSpotHighlights as highlight (highlight.key)}
                <g class="action-spot-highlight">
                    <circle
                        class="action-spot-ring"
                        cx={highlight.point.x}
                        cy={highlight.point.y}
                        r={ACTION_SPOT_HIGHLIGHT_RADIUS}
                        fill="none"
                        stroke={actionHighlightColor}
                        stroke-width="5.6"
                        opacity="0.9"
                        pointer-events="none"
                    ></circle>
                    <circle
                        cx={highlight.point.x}
                        cy={highlight.point.y}
                        r="21.5"
                        fill="transparent"
                        class="cursor-pointer"
                        onclick={() => handleActionSpotChoose(highlight.actionType)}
                    ></circle>
                </g>
            {/each}

            {#each highlightedBuildingSiteIds as siteId (siteId)}
                <BuildingSiteHighlight
                    {siteId}
                    isSelected={siteId === chosenBuildingSiteId}
                    onChoose={handleBuildingSiteChoose}
                />
            {/each}

            {#each highlightedVroomDestinationSiteIds as siteId (siteId)}
                <BuildingSiteHighlight {siteId} onChoose={handleVroomDestinationSiteChoose} />
            {/each}

            {#each highlightedPassengerStationIds as stationId (stationId)}
                <StationSelectionHighlight
                    {stationId}
                    isSelected={stationId === chosenPassengerStationId}
                    onChoose={handlePassengerStationChoose}
                />
            {/each}

            {#each Object.entries(passengersByNodeId) as [nodeId, passengers] (nodeId)}
                {@const typedNodeId = nodeId as BusNodeId}
                {@const point = BUS_BOARD_NODE_POINTS[typedNodeId]}
                {@const isChosenVroomSource = chosenVroomSourceNodeId === typedNodeId}
                {@const isSelectableVroomSource =
                    highlightedVroomSourceNodeIds.includes(typedNodeId)}
                {@const isHoveredSelectableVroomSource =
                    isSelectableVroomSource &&
                    !isChosenVroomSource &&
                    hoveredVroomSourceNodeId === typedNodeId}
                {@const shouldMaskForVroom =
                    shouldMaskUnselectedVroomPassengers &&
                    !(isSelectableVroomSource || isChosenVroomSource)}
                <Passenger
                    x={point.x}
                    y={point.y}
                    height={isHoveredSelectableVroomSource
                        ? VROOM_SOURCE_HOVER_PASSENGER_HEIGHT
                        : NODE_PASSENGER_HEIGHT}
                    count={passengers.length}
                    maskOpacity={shouldMaskForVroom ? NON_SELECTED_VROOM_PASSENGER_MASK_OPACITY : 0}
                />
                {#if isChoosingVroomSourcePassenger && (isSelectableVroomSource || isChosenVroomSource)}
                    <circle
                        cx={point.x}
                        cy={point.y}
                        r={VROOM_PASSENGER_HIT_RADIUS}
                        fill="transparent"
                        class="cursor-pointer"
                        onmouseenter={() => (hoveredVroomSourceNodeId = typedNodeId)}
                        onmouseleave={() => {
                            if (hoveredVroomSourceNodeId === typedNodeId) {
                                hoveredVroomSourceNodeId = undefined
                            }
                        }}
                        onclick={() => handleVroomSourceNodeChoose(typedNodeId)}
                    ></circle>
                {/if}
            {/each}

            {#each passengersAtSite as passenger (passenger.id)}
                {@const point = BUS_BUILDING_SITE_POINTS[passenger.siteId]}
                {@const isChosenVroomSourceSitePassenger =
                    !!chosenVroomSourceNodeId &&
                    highlightedVroomSourceNodeIds.includes(chosenVroomSourceNodeId)}
                {@const shouldMaskForVroom =
                    shouldMaskUnselectedVroomPassengers && !isChosenVroomSourceSitePassenger}
                <Passenger
                    x={point.x}
                    y={point.y}
                    height={SITE_PASSENGER_HEIGHT}
                    maskOpacity={shouldMaskForVroom ? NON_SELECTED_VROOM_PASSENGER_MASK_OPACITY : 0}
                />
            {/each}
        </svg>

        {#if chosenBuildingSiteId}
            <BuildingTypePicker />
        {/if}
        {#if chosenPassengerStationId}
            <AddPassengersPicker />
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

    .action-spot-ring {
        transform-origin: center;
        transform-box: fill-box;
        transition: transform 120ms ease-out;
    }

    .action-spot-highlight:hover .action-spot-ring {
        transform: scale(1.08);
    }
</style>
