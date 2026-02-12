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
} from '$lib/components/boardActionRowsUtils.js'
import { StateAnimator } from './stateAnimator.js'
import type { BusGameSession } from '$lib/model/session.svelte.js'

type AnimatedWorkerCylinderState = {
    x: number
    y: number
    color: string
    scale: number
    opacity: number
}

type WorkerCylinderPlacementAnimatorCallbacks = {
    onStart: (state: AnimatedWorkerCylinderState) => void
    onUpdate: (state: Pick<AnimatedWorkerCylinderState, 'scale' | 'opacity'>) => void
    onComplete: () => void
}

function buildActionWorkerPlacements(state: HydratedBusGameState): ActionWorkerPlacement[] {
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

export class WorkerCylinderPlacementAnimator extends StateAnimator<
    BusGameState,
    HydratedBusGameState,
    BusGameSession
> {
    constructor(
        gameSession: BusGameSession,
        private callbacks: WorkerCylinderPlacementAnimatorCallbacks
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
        if (!from || !action || !isChooseWorkerAction(action)) {
            return
        }

        const fromPlacements = buildActionWorkerPlacements(from)
        const toPlacements = buildActionWorkerPlacements(to)
        const fromPlacementKeys = new Set(fromPlacements.map((placement) => placement.key))

        let newPlacement = toPlacements.find(
            (placement) =>
                placement.actionType === action.actionType &&
                placement.playerId === action.playerId &&
                !fromPlacementKeys.has(placement.key)
        )

        if (!newPlacement) {
            const fromCount = fromPlacements.filter(
                (placement) =>
                    placement.actionType === action.actionType && placement.playerId === action.playerId
            ).length
            const toMatches = toPlacements.filter(
                (placement) =>
                    placement.actionType === action.actionType && placement.playerId === action.playerId
            )
            newPlacement = toMatches[fromCount]
        }

        if (!newPlacement) {
            return
        }

        const transient = {
            scale: 0.2,
            opacity: 0.9
        }

        this.callbacks.onStart({
            x: newPlacement.point.x,
            y: newPlacement.point.y,
            color: this.gameSession.colors.getPlayerUiColor(action.playerId),
            scale: transient.scale,
            opacity: transient.opacity
        })

        animationContext.actionTimeline.to(transient, {
            scale: 1.16,
            opacity: 1,
            duration: 0.18,
            ease: 'back.out(2.2)',
            onUpdate: () => {
                this.callbacks.onUpdate({
                    scale: transient.scale,
                    opacity: transient.opacity
                })
            }
        })

        animationContext.actionTimeline.to(transient, {
            scale: 1,
            duration: 0.14,
            ease: 'power2.out',
            onUpdate: () => {
                this.callbacks.onUpdate({
                    scale: transient.scale,
                    opacity: transient.opacity
                })
            }
        })

        animationContext.afterAnimations(() => {
            this.callbacks.onComplete()
        })
    }
}
