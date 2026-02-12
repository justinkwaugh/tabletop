<script lang="ts">
    import type { Point } from '@tabletop/common'
    import {
        ActionType,
        BUS_STATION_IDS,
        BuildingType,
        MachineState,
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
        BUS_CLOCK_CENTER_POINT,
        BUS_TIME_STONE_BLUE_POINTS,
        BUS_TIME_STONE_GREEN_POINTS,
        BUS_VROOM_ACTION_SPOT_POINTS,
        BUS_STARTING_PLAYER_ACTION_SPOT_POINT,
        BUS_SCORE_TRACK_POINTS
    } from '$lib/definitions/busBoardGraph.js'
    import arrowImg from '$lib/images/arrow.svg'
    import boardImg from '$lib/images/bus_board.jpg'
    import timeStoneBlueImg from '$lib/images/time_stone_blue.svg'
    import timeStoneGreenImg from '$lib/images/time_stone_green.svg'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const BOARD_WIDTH = 1839
    const BOARD_HEIGHT = 1300
    const ACTION_CYLINDER_X_OFFSET = 0
    const ACTION_CYLINDER_Y_OFFSET = -4
    const ACTION_SPOT_HIGHLIGHT_RADIUS = 13.3
    const ACTION_SLOT_MARKER_RADIUS = 15
    const ACTION_SLOT_MARKER_FONT_SIZE = 16
    const ACTION_SLOT_MARKER_TEXT_Y_OFFSET = 1.5
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
    const ACTION_SLOT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
    const CLOCK_HAND_VIEWBOX_WIDTH = 66.9
    const CLOCK_HAND_VIEWBOX_HEIGHT = 30.18
    const CLOCK_HAND_PIVOT_X = 20.2
    const CLOCK_HAND_PIVOT_Y = 18.13
    const CLOCK_HAND_SCALE = 1.863
    const CLOCK_HAND_OFFSET_X = -1
    const CLOCK_HAND_OFFSET_Y = -2
    const CLOCK_HAND_WIDTH = CLOCK_HAND_VIEWBOX_WIDTH * CLOCK_HAND_SCALE
    const CLOCK_HAND_HEIGHT = CLOCK_HAND_VIEWBOX_HEIGHT * CLOCK_HAND_SCALE
    const CLOCK_HAND_ORIGIN_X =
        BUS_CLOCK_CENTER_POINT.x + CLOCK_HAND_OFFSET_X - CLOCK_HAND_PIVOT_X * CLOCK_HAND_SCALE
    const CLOCK_HAND_ORIGIN_Y =
        BUS_CLOCK_CENTER_POINT.y + CLOCK_HAND_OFFSET_Y - CLOCK_HAND_PIVOT_Y * CLOCK_HAND_SCALE
    const CLOCK_HAND_CENTER_X = BUS_CLOCK_CENTER_POINT.x + CLOCK_HAND_OFFSET_X
    const CLOCK_HAND_CENTER_Y = BUS_CLOCK_CENTER_POINT.y + CLOCK_HAND_OFFSET_Y
    const CLOCK_RIVET_RADIUS = 10.5
    const CLOCK_RIVET_OUTER_RADIUS = CLOCK_RIVET_RADIUS + 1.4
    const TIME_STONE_SIZE = 52
    const TIME_STONE_HALF_SIZE = TIME_STONE_SIZE / 2
    const TIME_STONE_SOCKET_RADIUS = TIME_STONE_HALF_SIZE
    const TIME_STONE_SOCKET_OPACITY = 0.7
    const TIME_STONE_MASK_OPACITY = 0.56
    const TIME_STONE_MASK_RADIUS = TIME_STONE_HALF_SIZE - 1.5
    const TIME_STONE_HIT_RADIUS = TIME_STONE_HALF_SIZE
    const SCORE_MARKER_RADIUS = 17
    const SCORE_MARKER_STACK_OFFSET_Y = 4.5
    const SCORE_MARKER_STROKE = '#1f2a3d'
    const SCORE_MARKER_STROKE_WIDTH = 1.4
    const SCORE_MARKER_TEXT_SIZE = 13
    const SCORE_MARKER_TEXT_Y_OFFSET = 0.8

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

    type ActionSlotMarker = {
        key: string
        point: Point
        label: string
    }

    type SitePassengerPlacement = {
        id: string
        siteId: BuildingSiteId
    }

    type ScoreMarker = {
        key: string
        playerId: string
        point: Point
        score: number
        textColor: string
        fillColor: string
    }

    type TimeStoneKey = 'bottom-left' | 'bottom' | 'right' | 'top-right' | 'top-left'

    type TimeStoneRender = {
        key: TimeStoneKey
        point: Point
        spriteHref: string
    }

    const TIME_STONE_RENDER_ORDER: readonly TimeStoneRender[] = [
        {
            key: 'bottom-left',
            point: BUS_TIME_STONE_BLUE_POINTS[2]!,
            spriteHref: timeStoneBlueImg
        },
        {
            key: 'bottom',
            point: BUS_TIME_STONE_GREEN_POINTS[1]!,
            spriteHref: timeStoneGreenImg
        },
        {
            key: 'right',
            point: BUS_TIME_STONE_BLUE_POINTS[1]!,
            spriteHref: timeStoneBlueImg
        },
        {
            key: 'top-right',
            point: BUS_TIME_STONE_GREEN_POINTS[0]!,
            spriteHref: timeStoneGreenImg
        },
        {
            key: 'top-left',
            point: BUS_TIME_STONE_BLUE_POINTS[0]!,
            spriteHref: timeStoneBlueImg
        }
    ]

    const TIME_STONE_CLICK_PRIORITY: readonly TimeStoneKey[] = [
        'top-left',
        'top-right',
        'right',
        'bottom',
        'bottom-left'
    ]

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

    const visibleTimeStones: TimeStoneRender[] = $derived.by(() => {
        const stoneCount = Math.max(
            0,
            Math.min(gameSession.gameState.stones, TIME_STONE_RENDER_ORDER.length)
        )
        return TIME_STONE_RENDER_ORDER.slice(0, stoneCount)
    })

    const canStopTimeFromStone = $derived.by(() => {
        return (
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.TimeMachine &&
            gameSession.validActionTypes.includes(ActionType.StopTime) &&
            visibleTimeStones.length > 0
        )
    })

    const selectableTimeStoneKey: TimeStoneKey | undefined = $derived.by(() => {
        if (!canStopTimeFromStone) {
            return undefined
        }

        const visibleStoneKeys = new Set(visibleTimeStones.map((stone) => stone.key))
        return TIME_STONE_CLICK_PRIORITY.find((key) => visibleStoneKeys.has(key))
    })

    const scoreMarkers: ScoreMarker[] = $derived.by(() => {
        const state = gameSession.gameState
        const playerById = new Map(state.players.map((player) => [player.playerId, player]))
        const markers: ScoreMarker[] = []
        const stackOffsetsByScore = new Map<number, number>()

        for (const playerId of state.scoreOrder) {
            const player = playerById.get(playerId)
            if (!player) {
                continue
            }

            const score = Math.max(0, Math.round(player.score))
            const scoreIndex = Math.min(score, BUS_SCORE_TRACK_POINTS.length - 1)
            const scorePoint = BUS_SCORE_TRACK_POINTS[scoreIndex]
            if (!scorePoint) {
                continue
            }
            const stackIndex = stackOffsetsByScore.get(score) ?? 0
            stackOffsetsByScore.set(score, stackIndex + 1)

            markers.push({
                key: `score:${playerId}`,
                playerId,
                point: {
                    x: scorePoint.x,
                    y: scorePoint.y - stackIndex * SCORE_MARKER_STACK_OFFSET_Y
                },
                score,
                textColor: actionValueTextColor(playerId),
                fillColor: gameSession.colors.getPlayerUiColor(playerId)
            })
        }

        return markers
    })

    const clockHandRotationDegrees = $derived.by(() => {
        switch (gameSession.gameState.currentLocation) {
            case BuildingType.House:
                return 0
            case BuildingType.Office:
                return 120
            case BuildingType.Pub:
                return 240
            default:
                return 0
        }
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

    const defaultActionSlotMarkers: ActionSlotMarker[] = $derived.by(() => {
        const markers: ActionSlotMarker[] = []
        const occupiedSlots = new Set<string>()
        const highlightedSlots = new Set<string>()

        for (const placement of actionWorkerPlacements) {
            if (placement.selectionIndex === undefined) {
                continue
            }
            occupiedSlots.add(`${placement.actionType}:${placement.selectionIndex}`)
        }

        for (const highlight of availableActionSpotHighlights) {
            if (highlight.selectionIndex === undefined) {
                continue
            }
            highlightedSlots.add(`${highlight.actionType}:${highlight.selectionIndex}`)
        }

        pushDefaultQueueSlotMarkers(
            markers,
            WorkerActionType.Expansion,
            BUS_EXPANSION_ACTION_SPOT_POINTS,
            true,
            occupiedSlots,
            highlightedSlots
        )
        pushDefaultQueueSlotMarkers(
            markers,
            WorkerActionType.Passengers,
            BUS_PASSENGERS_ACTION_SPOT_POINTS,
            false,
            occupiedSlots,
            highlightedSlots
        )
        pushDefaultQueueSlotMarkers(
            markers,
            WorkerActionType.Buildings,
            BUS_BUILDINGS_ACTION_SPOT_POINTS,
            true,
            occupiedSlots,
            highlightedSlots
        )
        pushDefaultQueueSlotMarkers(
            markers,
            WorkerActionType.Vroom,
            BUS_VROOM_ACTION_SPOT_POINTS,
            false,
            occupiedSlots,
            highlightedSlots
        )

        return markers
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
        const effectivePassengerAndBuildingBase = Math.max(
            projectedPassengerAndBuildingBase,
            state.maxBusValue()
        )

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
                    return Math.max(0, effectivePassengerAndBuildingBase - selectionIndex)
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

    function handleTimeStoneChoose(stoneKey: TimeStoneKey) {
        if (!canStopTimeFromStone) {
            return
        }
        if (selectableTimeStoneKey !== stoneKey) {
            return
        }

        void gameSession.stopTime()
    }

    function handleActivateFromKeyboard(event: KeyboardEvent, action: () => void) {
        if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
            return
        }
        event.preventDefault()
        action()
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

    function pushDefaultQueueSlotMarkers(
        markers: ActionSlotMarker[],
        actionType: WorkerActionType,
        points: Point[],
        reversePhysicalRow: boolean,
        occupiedSlots: Set<string>,
        highlightedSlots: Set<string>
    ) {
        for (let selectionIndex = 0; selectionIndex < points.length; selectionIndex += 1) {
            const slotKey = `${actionType}:${selectionIndex}`
            if (occupiedSlots.has(slotKey) || highlightedSlots.has(slotKey)) {
                continue
            }

            const pointIndex = reversePhysicalRow
                ? points.length - 1 - selectionIndex
                : selectionIndex
            const point = points[pointIndex]
            if (!point) {
                continue
            }

            markers.push({
                key: `${slotKey}:default`,
                point,
                label: ACTION_SLOT_LABELS[selectionIndex] ?? ''
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
            [
                blend(parsedA[0], parsedB[0]),
                blend(parsedA[1], parsedB[1]),
                blend(parsedA[2], parsedB[2])
            ]
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
                <filter id="clock-hand-depth" x="-15%" y="-15%" width="130%" height="130%">
                    <feDropShadow
                        dx="0.9"
                        dy="1.25"
                        stdDeviation="0.8"
                        flood-color="#000000"
                        flood-opacity="0.5"
                    ></feDropShadow>
                    <feDropShadow
                        dx="-0.45"
                        dy="-0.55"
                        stdDeviation="0.35"
                        flood-color="#ffffff"
                        flood-opacity="0.24"
                    ></feDropShadow>
                </filter>
                <filter id="clock-hand-specular" x="-20%" y="-20%" width="140%" height="140%">
                    <feMorphology
                        in="SourceAlpha"
                        operator="dilate"
                        radius="0.55"
                        result="expanded-alpha"
                    ></feMorphology>
                    <feOffset in="expanded-alpha" dx="-0.15" dy="-0.95" result="shifted-alpha"
                    ></feOffset>
                    <feComposite
                        in="shifted-alpha"
                        in2="SourceAlpha"
                        operator="out"
                        result="rim-alpha"
                    ></feComposite>
                    <feFlood flood-color="#ffffff" flood-opacity="0.5" result="specular-color"
                    ></feFlood>
                    <feComposite
                        in="specular-color"
                        in2="rim-alpha"
                        operator="in"
                        result="specular-rim"
                    ></feComposite>
                    <feGaussianBlur in="specular-rim" stdDeviation="0.24"></feGaussianBlur>
                </filter>
                <linearGradient id="clock-hand-specular-mask-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="1"></stop>
                    <stop offset="48%" stop-color="#ffffff" stop-opacity="0.42"></stop>
                    <stop offset="78%" stop-color="#ffffff" stop-opacity="0"></stop>
                    <stop offset="100%" stop-color="#ffffff" stop-opacity="0"></stop>
                </linearGradient>
                <mask id="clock-hand-specular-mask">
                    <rect
                        x="-8"
                        y="-8"
                        width={CLOCK_HAND_WIDTH + 16}
                        height={CLOCK_HAND_HEIGHT + 16}
                        fill="url(#clock-hand-specular-mask-gradient)"
                    ></rect>
                </mask>
                <radialGradient id="clock-rivet-fill" cx="34%" cy="28%" r="74%">
                    <stop offset="0%" stop-color="#525252"></stop>
                    <stop offset="52%" stop-color="#222222"></stop>
                    <stop offset="100%" stop-color="#080808"></stop>
                </radialGradient>
                <radialGradient id="clock-rivet-gloss" cx="30%" cy="25%" r="70%">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"></stop>
                    <stop offset="100%" stop-color="#ffffff" stop-opacity="0"></stop>
                </radialGradient>
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

            {#each TIME_STONE_RENDER_ORDER as stone (`socket:${stone.key}`)}
                <circle
                    class="pointer-events-none"
                    cx={stone.point.x}
                    cy={stone.point.y}
                    r={TIME_STONE_SOCKET_RADIUS}
                    fill="#000000"
                    opacity={TIME_STONE_SOCKET_OPACITY}
                    aria-hidden="true"
                ></circle>
            {/each}

            {#each visibleTimeStones as stone (stone.key)}
                {@const isSelectable = canStopTimeFromStone && selectableTimeStoneKey === stone.key}
                {@const shouldMask = canStopTimeFromStone && !isSelectable}
                <image
                    class="pointer-events-none"
                    href={stone.spriteHref}
                    x={stone.point.x - TIME_STONE_HALF_SIZE}
                    y={stone.point.y - TIME_STONE_HALF_SIZE}
                    width={TIME_STONE_SIZE}
                    height={TIME_STONE_SIZE}
                    aria-hidden="true"
                ></image>
                {#if shouldMask}
                    <circle
                        class="pointer-events-none"
                        cx={stone.point.x}
                        cy={stone.point.y}
                        r={TIME_STONE_MASK_RADIUS}
                        fill="#000000"
                        opacity={TIME_STONE_MASK_OPACITY}
                        aria-hidden="true"
                    ></circle>
                {/if}
                {#if isSelectable}
                    <circle
                        class="time-stone-hit cursor-pointer"
                        cx={stone.point.x}
                        cy={stone.point.y}
                        r={TIME_STONE_HIT_RADIUS}
                        fill="transparent"
                        role="button"
                        tabindex="0"
                        aria-label="Stop time"
                        onkeydown={(event) =>
                            handleActivateFromKeyboard(event, () =>
                                handleTimeStoneChoose(stone.key)
                            )}
                        onclick={() => handleTimeStoneChoose(stone.key)}
                    ></circle>
                {/if}
            {/each}

            <g
                class="pointer-events-none"
                transform={`translate(${CLOCK_HAND_ORIGIN_X} ${CLOCK_HAND_ORIGIN_Y}) rotate(${clockHandRotationDegrees} ${CLOCK_HAND_PIVOT_X * CLOCK_HAND_SCALE} ${CLOCK_HAND_PIVOT_Y * CLOCK_HAND_SCALE})`}
                aria-hidden="true"
            >
                <image
                    href={arrowImg}
                    width={CLOCK_HAND_WIDTH}
                    height={CLOCK_HAND_HEIGHT}
                    filter="url(#clock-hand-depth)"
                ></image>
                <image
                    href={arrowImg}
                    width={CLOCK_HAND_WIDTH}
                    height={CLOCK_HAND_HEIGHT}
                    filter="url(#clock-hand-specular)"
                    mask="url(#clock-hand-specular-mask)"
                    opacity="0.95"
                ></image>
            </g>
            <g class="pointer-events-none" aria-hidden="true">
                <circle
                    cx={CLOCK_HAND_CENTER_X}
                    cy={CLOCK_HAND_CENTER_Y}
                    r={CLOCK_RIVET_OUTER_RADIUS}
                    fill="#060606"
                    opacity="0.85"
                ></circle>
                <circle
                    cx={CLOCK_HAND_CENTER_X}
                    cy={CLOCK_HAND_CENTER_Y}
                    r={CLOCK_RIVET_RADIUS}
                    fill="url(#clock-rivet-fill)"
                    stroke="#000000"
                    stroke-width="0.8"
                ></circle>
                <circle
                    cx={CLOCK_HAND_CENTER_X - 1.2}
                    cy={CLOCK_HAND_CENTER_Y - 1.35}
                    r={CLOCK_RIVET_RADIUS * 0.55}
                    fill="url(#clock-rivet-gloss)"
                ></circle>
            </g>

            {#each placedBuildings as building (building.id)}
                <PlacedBuilding siteId={building.site} buildingType={building.type} />
            {/each}

            {#each scoreMarkers as marker (marker.key)}
                <g class="pointer-events-none" aria-hidden="true">
                    <circle
                        cx={marker.point.x}
                        cy={marker.point.y}
                        r={SCORE_MARKER_RADIUS}
                        fill={marker.fillColor}
                        stroke={SCORE_MARKER_STROKE}
                        stroke-width={SCORE_MARKER_STROKE_WIDTH}
                    ></circle>
                    <text
                        x={marker.point.x}
                        y={marker.point.y + SCORE_MARKER_TEXT_Y_OFFSET}
                        text-anchor="middle"
                        dominant-baseline="middle"
                        font-size={SCORE_MARKER_TEXT_SIZE}
                        font-weight="700"
                        fill={marker.textColor}>{marker.score}</text
                    >
                </g>
            {/each}

            {#each actionWorkerPlacements as placement (placement.key)}
                <WorkerCylinder
                    x={placement.point.x + ACTION_CYLINDER_X_OFFSET}
                    y={placement.point.y + ACTION_CYLINDER_Y_OFFSET}
                    color={gameSession.colors.getPlayerUiColor(placement.playerId)}
                />
            {/each}

            {#each defaultActionSlotMarkers as marker (marker.key)}
                <g class="pointer-events-none" aria-hidden="true">
                    <circle
                        cx={marker.point.x}
                        cy={marker.point.y}
                        r={ACTION_SLOT_MARKER_RADIUS}
                        fill="#070d30"
                        stroke="#04091f"
                        stroke-width="1.2"
                    ></circle>
                    <text
                        x={marker.point.x}
                        y={marker.point.y + ACTION_SLOT_MARKER_TEXT_Y_OFFSET}
                        text-anchor="middle"
                        dominant-baseline="middle"
                        font-size={ACTION_SLOT_MARKER_FONT_SIZE}
                        font-weight="700"
                        fill="#ffffff">{marker.label}</text
                    >
                </g>
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
                        stroke-width="2"
                        opacity="0.9"
                        pointer-events="none"
                    ></circle>
                    <circle
                        cx={highlight.point.x}
                        cy={highlight.point.y}
                        r="21.5"
                        fill="transparent"
                        class="cursor-pointer"
                        role="button"
                        tabindex="0"
                        aria-label={`Choose ${highlight.actionType} action`}
                        onkeydown={(event) =>
                            handleActivateFromKeyboard(event, () =>
                                handleActionSpotChoose(highlight.actionType)
                            )}
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
                        role="button"
                        tabindex="0"
                        aria-label={`Choose passenger at ${typedNodeId}`}
                        onmouseenter={() => (hoveredVroomSourceNodeId = typedNodeId)}
                        onmouseleave={() => {
                            if (hoveredVroomSourceNodeId === typedNodeId) {
                                hoveredVroomSourceNodeId = undefined
                            }
                        }}
                        onkeydown={(event) =>
                            handleActivateFromKeyboard(event, () =>
                                handleVroomSourceNodeChoose(typedNodeId)
                            )}
                        onclick={() => handleVroomSourceNodeChoose(typedNodeId)}
                    ></circle>
                {/if}
            {/each}

            {#each passengersAtSite as passenger (passenger.id)}
                {@const point = BUS_BUILDING_SITE_POINTS[passenger.siteId]}
                <Passenger
                    x={point.x}
                    y={point.y}
                    height={SITE_PASSENGER_HEIGHT}
                    maskOpacity={shouldMaskUnselectedVroomPassengers
                        ? NON_SELECTED_VROOM_PASSENGER_MASK_OPACITY
                        : 0}
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

    .time-stone-hit:focus {
        outline: none;
    }

    .time-stone-hit:focus-visible {
        outline: 2.5px solid #fff27a;
        outline-offset: 2px;
    }
</style>
