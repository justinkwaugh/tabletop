<script lang="ts">
    import { ActionType, WorkerActionType } from '@tabletop/bus'
    import {
        buildActionWorkerPlacements,
        WorkerCylinderAnimator
    } from '$lib/animators/workerCylinderAnimator.js'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'
    import WorkerCylinder from './WorkerCylinder.svelte'
    import {
        mixHex,
        pushAvailableQueueSpot,
        pushAvailableSingleSpot,
        pushDefaultQueueSlotMarkers,
        textColorFromTailwindClass,
        type ActionSlotMarker,
        type ActionSpotHighlight,
        type ActionValueBadge,
        type ActionWorkerPlacement
    } from '$lib/utils/boardActionRowsUtils.js'
    import {
        BUS_BUILDINGS_ACTION_SPOT_POINTS,
        BUS_BUSES_ACTION_SPOT_POINT,
        BUS_CLOCK_ACTION_SPOT_POINT,
        BUS_EXPANSION_ACTION_SPOT_POINTS,
        BUS_PASSENGERS_ACTION_SPOT_POINTS,
        BUS_STARTING_PLAYER_ACTION_SPOT_POINT,
        BUS_VROOM_ACTION_SPOT_POINTS
    } from '$lib/definitions/busBoardGraph.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

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

    type AnimatedWorkerCylinder = {
        x: number
        y: number
        color: string
        scale: number
        opacity: number
    }

    let animatedAddedWorkerCylinders: (AnimatedWorkerCylinder & {
        key: string
    })[] = $derived.by(() => {
        gameSession.gameState
        return []
    })
    let animatedRemovedWorkerCylinders: (AnimatedWorkerCylinder & {
        key: string
    })[] = $derived.by(() => {
        gameSession.gameState
        return []
    })

    const workerCylinderAnimator = new WorkerCylinderAnimator(gameSession, {
        onPlacementStart: ({ key, x, y, color, scale, opacity }) => {
            animatedAddedWorkerCylinders = [
                ...animatedAddedWorkerCylinders,
                { key, x, y, color, scale, opacity }
            ]
        },
        onPlacementUpdate: ({ key, scale, opacity }) => {
            animatedAddedWorkerCylinders = animatedAddedWorkerCylinders.map((item) =>
                item.key === key
                    ? {
                          ...item,
                          scale,
                          opacity
                      }
                    : item
            )
        },
        onRemovalStart: ({ key, x, y, color, scale, opacity }) => {
            animatedRemovedWorkerCylinders = [
                ...animatedRemovedWorkerCylinders,
                { key, x, y, color, scale, opacity }
            ]
        },
        onRemovalUpdate: ({ key, scale, opacity }) => {
            animatedRemovedWorkerCylinders = animatedRemovedWorkerCylinders.map((item) =>
                item.key === key
                    ? {
                          ...item,
                          scale,
                          opacity
                      }
                    : item
            )
        }
    })

    const animatedRemovedPlacementKeys = $derived.by(() => {
        return new Set(animatedRemovedWorkerCylinders.map((item) => item.key))
    })

    const animatedAddedPlacementKeys = $derived.by(() => {
        return new Set(animatedAddedWorkerCylinders.map((item) => item.key))
    })

    const actionWorkerPlacements: ActionWorkerPlacement[] = $derived.by(() => {
        return buildActionWorkerPlacements(gameSession.gameState)
    })

    const availableActionSpotHighlights: ActionSpotHighlight[] = $derived.by(() => {
        if (
            gameSession.isViewingHistory ||
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
        const phase4AvailableSiteCap =
            state.currentBuildingPhase === 4 ? state.board.openSitesForPhase(4).length : Number.POSITIVE_INFINITY

        const playerBusValues = new Map<string, number>(
            state.players.map((playerState) => [playerState.playerId, playerState.buses])
        )
        const playerStickValues = new Map<string, number>(
            state.players.map((playerState) => [playerState.playerId, playerState.sticks])
        )
        const myPlayerId = gameSession.myPlayer?.id

        const expansionValuesBySelectionIndex = (() => {
            const values = new Map<number, number>()
            const remainingSticksByPlayer = new Map<string, number>(playerStickValues)

            // Expansion executes left-to-right on the board row (F -> A), which corresponds to
            // descending selection indices (5 -> 0) because index 0 is the A slot.
            for (let selectionIndex = state.lineExpansionAction.length - 1; selectionIndex >= 0; selectionIndex -= 1) {
                const playerId = state.lineExpansionAction[selectionIndex]
                if (!playerId) {
                    continue
                }

                const baseValue = Math.max(0, state.roundStartMaxBusValue - selectionIndex)
                const remainingSticks = Math.max(0, remainingSticksByPlayer.get(playerId) ?? 0)
                const value = Math.min(baseValue, remainingSticks)

                values.set(selectionIndex, value)
                remainingSticksByPlayer.set(playerId, Math.max(0, remainingSticks - value))
            }

            return values
        })()

        const projectedExpansionHighlightValueBySelectionIndex = (() => {
            const values = new Map<number, number>()
            const nextSelectionIndex = state.lineExpansionAction.length
            if (!myPlayerId || nextSelectionIndex >= BUS_EXPANSION_ACTION_SPOT_POINTS.length) {
                return values
            }

            const projectedLineExpansionAction = [...state.lineExpansionAction, myPlayerId]
            const remainingSticksByPlayer = new Map<string, number>(playerStickValues)

            for (let selectionIndex = projectedLineExpansionAction.length - 1; selectionIndex >= 0; selectionIndex -= 1) {
                const playerId = projectedLineExpansionAction[selectionIndex]
                if (!playerId) {
                    continue
                }

                const baseValue = Math.max(0, state.roundStartMaxBusValue - selectionIndex)
                const remainingSticks = Math.max(0, remainingSticksByPlayer.get(playerId) ?? 0)
                const value = Math.min(baseValue, remainingSticks)

                values.set(selectionIndex, value)
                remainingSticksByPlayer.set(playerId, Math.max(0, remainingSticks - value))
            }

            return values
        })()

        const computeBuildingValuesBySelectionIndex = (
            buildingAction: string[]
        ): Map<number, number> => {
            const values = new Map<number, number>()
            let remainingSites = phase4AvailableSiteCap

            // Buildings execute left-to-right on the board row (F -> A), which corresponds to
            // descending selection indices (5 -> 0) because index 0 is the A slot.
            for (
                let selectionIndex = buildingAction.length - 1;
                selectionIndex >= 0;
                selectionIndex -= 1
            ) {
                const playerId = buildingAction[selectionIndex]
                if (!playerId) {
                    continue
                }

                const baseValue = Math.max(0, effectivePassengerAndBuildingBase - selectionIndex)
                const value = Math.min(baseValue, remainingSites)

                values.set(selectionIndex, value)
                remainingSites = Math.max(0, remainingSites - value)
            }

            return values
        }

        const buildingValuesBySelectionIndex = computeBuildingValuesBySelectionIndex(state.buildingAction)

        const projectedBuildingHighlightValueBySelectionIndex = (() => {
            const values = new Map<number, number>()
            const nextSelectionIndex = state.buildingAction.length
            if (!myPlayerId || nextSelectionIndex >= BUS_BUILDINGS_ACTION_SPOT_POINTS.length) {
                return values
            }

            const projectedBuildingAction = [...state.buildingAction, myPlayerId]
            return computeBuildingValuesBySelectionIndex(projectedBuildingAction)
        })()

        const resolveActionValue = (
            actionType: WorkerActionType,
            selectionIndex: number,
            playerId?: string
        ): number | undefined => {
            switch (actionType) {
                case WorkerActionType.Expansion: {
                    if (playerId) {
                        return expansionValuesBySelectionIndex.get(selectionIndex) ?? 0
                    }
                    if (selectionIndex === state.lineExpansionAction.length) {
                        return projectedExpansionHighlightValueBySelectionIndex.get(selectionIndex) ?? 0
                    }
                    return expansionValuesBySelectionIndex.get(selectionIndex) ?? 0
                }
                case WorkerActionType.Passengers: {
                    const passengerBase = Math.min(
                        effectivePassengerAndBuildingBase,
                        state.passengers.length
                    )
                    return Math.max(0, passengerBase - selectionIndex)
                }
                case WorkerActionType.Buildings: {
                    if (playerId) {
                        return buildingValuesBySelectionIndex.get(selectionIndex) ?? 0
                    }
                    if (selectionIndex === state.buildingAction.length) {
                        return projectedBuildingHighlightValueBySelectionIndex.get(selectionIndex) ?? 0
                    }
                    return buildingValuesBySelectionIndex.get(selectionIndex) ?? 0
                }
                case WorkerActionType.Vroom: {
                    const effectivePlayerId = playerId ?? myPlayerId
                    if (!effectivePlayerId) {
                        return undefined
                    }
                    const baseBusValue = playerBusValues.get(effectivePlayerId) ?? 0
                    const playerGetsBusBonus = state.busAction === effectivePlayerId
                    return Math.max(0, baseBusValue + (playerGetsBusBonus ? 1 : 0))
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
                if (
                    highlight.actionType === WorkerActionType.Buses ||
                    highlight.actionType === WorkerActionType.Clock ||
                    highlight.actionType === WorkerActionType.StartingPlayer
                ) {
                    badges.push({
                        key: `highlight:${highlight.key}:single`,
                        point: {
                            x: highlight.point.x,
                            y: highlight.point.y
                        },
                        showText: false,
                        showCenterDot: true
                    })
                }
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

    function actionValueTextColor(playerId?: string): string {
        if (!playerId) {
            return '#333'
        }
        return textColorFromTailwindClass(gameSession.colors.getPlayerTextColor(playerId))
    }

    function handleActionSpotChoose(actionType: WorkerActionType) {
        void gameSession.chooseWorkerAction(actionType)
    }

    function handleActivateFromKeyboard(event: KeyboardEvent, action: () => void) {
        if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
            return
        }
        event.preventDefault()
        action()
    }
</script>

<g class="pointer-events-none" {@attach attachAnimator(workerCylinderAnimator)}></g>

{#each actionWorkerPlacements as placement (placement.key)}
    {#if !animatedRemovedPlacementKeys.has(placement.key) && !animatedAddedPlacementKeys.has(placement.key)}
        <WorkerCylinder
            x={placement.point.x + ACTION_CYLINDER_X_OFFSET}
            y={placement.point.y + ACTION_CYLINDER_Y_OFFSET}
            color={gameSession.colors.getPlayerUiColor(placement.playerId)}
        />
    {/if}
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
                y={badge.point.y + (badge.playerId ? 0 : HIGHLIGHT_ACTION_VALUE_TEXT_Y_OFFSET)}
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
        {#if badge.showCenterDot}
            <circle
                cx={badge.point.x}
                cy={badge.point.y}
                r="3.2"
                fill={badge.playerId ? actionValueTextColor(badge.playerId) : highlightValueTextColor}
            ></circle>
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
            class="cursor-pointer action-spot-hit-target"
            role="button"
            tabindex="0"
            aria-label={`Choose ${highlight.actionType} action`}
            onkeydown={(event) =>
                handleActivateFromKeyboard(event, () => handleActionSpotChoose(highlight.actionType))}
            onclick={() => handleActionSpotChoose(highlight.actionType)}
        ></circle>
    </g>
{/each}

{#each animatedAddedWorkerCylinders as addedCylinder (addedCylinder.key)}
    <WorkerCylinder
        x={addedCylinder.x + ACTION_CYLINDER_X_OFFSET}
        y={addedCylinder.y + ACTION_CYLINDER_Y_OFFSET}
        color={addedCylinder.color}
        scale={addedCylinder.scale}
        opacity={addedCylinder.opacity}
    />
{/each}

{#each animatedRemovedWorkerCylinders as removedCylinder (removedCylinder.key)}
    <WorkerCylinder
        x={removedCylinder.x + ACTION_CYLINDER_X_OFFSET}
        y={removedCylinder.y + ACTION_CYLINDER_Y_OFFSET}
        color={removedCylinder.color}
        scale={removedCylinder.scale}
        opacity={removedCylinder.opacity}
    />
{/each}

<style>
    .action-spot-hit-target:focus {
        outline: none;
    }

    .action-spot-hit-target:focus-visible {
        outline: 2.5px solid #fff27a;
        outline-offset: 2px;
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
