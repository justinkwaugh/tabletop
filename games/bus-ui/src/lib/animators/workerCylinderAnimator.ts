import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    WorkerActionType,
    isChooseWorkerAction,
    type BusGameState,
    type HydratedBusGameState
} from '@tabletop/bus'
import {
    BUS_BUILDINGS_ACTION_SPOT_POINTS,
    BUS_BUSES_ACTION_SPOT_POINT,
    BUS_CLOCK_ACTION_SPOT_POINT,
    BUS_EXPANSION_ACTION_SPOT_POINTS,
    BUS_PASSENGERS_ACTION_SPOT_POINTS,
    BUS_STARTING_PLAYER_ACTION_SPOT_POINT,
    BUS_VROOM_ACTION_SPOT_POINTS
} from '$lib/definitions/busBoardGraph.js'
import {
    pushQueuePlacements,
    pushSinglePlacement,
    type ActionWorkerPlacement
} from '$lib/utils/boardActionRowsUtils.js'
import { StateAnimator } from './stateAnimator.js'
import type { BusGameSession } from '$lib/model/session.svelte.js'

type AnimatedWorkerCylinderState = {
    key: string
    x: number
    y: number
    color: string
    scale: number
    opacity: number
}

type WorkerCylinderAnimatorCallbacks = {
    onPlacementStart: (state: AnimatedWorkerCylinderState) => void
    onPlacementUpdate: (
        state: Pick<AnimatedWorkerCylinderState, 'key' | 'scale' | 'opacity'>
    ) => void
    onRemovalStart: (state: AnimatedWorkerCylinderState) => void
    onRemovalUpdate: (state: Pick<AnimatedWorkerCylinderState, 'key' | 'scale' | 'opacity'>) => void
}

export function buildActionWorkerPlacements(state: HydratedBusGameState): ActionWorkerPlacement[] {
    const placements: ActionWorkerPlacement[] = []

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
}

export class WorkerCylinderAnimator extends StateAnimator<
    BusGameState,
    HydratedBusGameState,
    BusGameSession
> {
    constructor(
        gameSession: BusGameSession,
        private callbacks: WorkerCylinderAnimatorCallbacks
    ) {
        super(gameSession)
    }

    override async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedBusGameState
        from?: HydratedBusGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!from) {
            return
        }

        const hasChooseWorkerAction = !!action && isChooseWorkerAction(action)
        const removalPopDuration = hasChooseWorkerAction ? 0.12 : 0.08
        const removalShrinkDuration = hasChooseWorkerAction ? 0.2 : 0.12
        const placementPopDuration = hasChooseWorkerAction ? 0.18 : 0.1
        const placementSettleDuration = hasChooseWorkerAction ? 0.14 : 0.08

        const fromPlacements = buildActionWorkerPlacements(from)
        const toPlacements = buildActionWorkerPlacements(to)
        const toPlacementKeys = new Set(toPlacements.map((placement) => placement.key))

        for (const removedPlacement of fromPlacements.filter((placement) => !toPlacementKeys.has(placement.key))) {
            const transient = {
                key: removedPlacement.key,
                scale: 1,
                opacity: 1
            }

            this.callbacks.onRemovalStart({
                key: removedPlacement.key,
                x: removedPlacement.point.x,
                y: removedPlacement.point.y,
                color: this.gameSession.colors.getPlayerUiColor(removedPlacement.playerId),
                scale: transient.scale,
                opacity: transient.opacity
            })

            animationContext.actionTimeline.to(
                transient,
                {
                    scale: 1.16,
                    duration: removalPopDuration,
                    ease: 'power1.out',
                    onUpdate: () => {
                        this.callbacks.onRemovalUpdate({
                            key: transient.key,
                            scale: transient.scale,
                            opacity: transient.opacity
                        })
                    }
                },
                0
            )

            animationContext.actionTimeline.to(
                transient,
                {
                    scale: 0.2,
                    opacity: 0,
                    duration: removalShrinkDuration,
                    ease: 'power2.in',
                    onUpdate: () => {
                        this.callbacks.onRemovalUpdate({
                            key: transient.key,
                            scale: transient.scale,
                            opacity: transient.opacity
                        })
                    }
                },
                removalPopDuration
            )

        }

        const fromPlacementKeys = new Set(fromPlacements.map((placement) => placement.key))
        const addedPlacements = (() => {
            if (hasChooseWorkerAction && action) {
                let newPlacement = toPlacements.find(
                    (placement) =>
                        placement.actionType === action.actionType &&
                        placement.playerId === action.playerId &&
                        !fromPlacementKeys.has(placement.key)
                )

                if (!newPlacement) {
                    const fromCount = fromPlacements.filter(
                        (placement) =>
                            placement.actionType === action.actionType &&
                            placement.playerId === action.playerId
                    ).length
                    const toMatches = toPlacements.filter(
                        (placement) =>
                            placement.actionType === action.actionType &&
                            placement.playerId === action.playerId
                    )
                    newPlacement = toMatches[fromCount]
                }

                return newPlacement ? [newPlacement] : []
            }

            return toPlacements.filter((placement) => !fromPlacementKeys.has(placement.key))
        })()

        for (const addedPlacement of addedPlacements) {
            const transient = {
                key: addedPlacement.key,
                scale: 0.2,
                opacity: 0.9
            }

            this.callbacks.onPlacementStart({
                key: addedPlacement.key,
                x: addedPlacement.point.x,
                y: addedPlacement.point.y,
                color: this.gameSession.colors.getPlayerUiColor(addedPlacement.playerId),
                scale: transient.scale,
                opacity: transient.opacity
            })

            animationContext.actionTimeline.to(
                transient,
                {
                    scale: 1.16,
                    opacity: 1,
                    duration: placementPopDuration,
                    ease: 'back.out(2.2)',
                    onUpdate: () => {
                        this.callbacks.onPlacementUpdate({
                            key: transient.key,
                            scale: transient.scale,
                            opacity: transient.opacity
                        })
                    }
                },
                0
            )

            animationContext.actionTimeline.to(
                transient,
                {
                    scale: 1,
                    duration: placementSettleDuration,
                    ease: 'power2.out',
                    onUpdate: () => {
                        this.callbacks.onPlacementUpdate({
                            key: transient.key,
                            scale: transient.scale,
                            opacity: transient.opacity
                        })
                    }
                },
                placementPopDuration
            )
        }
    }
}
