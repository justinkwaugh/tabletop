import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    isAddPassengers,
    isBusNodeId,
    type BusGameState,
    type BusNodeId,
    type HydratedBusGameState
} from '@tabletop/bus'
import { BUS_BOARD_NODE_POINTS } from '$lib/definitions/busBoardGraph.js'
import { StateAnimator } from './stateAnimator.js'
import type { BusGameSession } from '$lib/model/session.svelte.js'

type PassengerPose = {
    x: number
    y: number
    height: number
}

type AddPassengersPlacementAnimatorCallbacks = {
    onStart: (args: { nodeId: BusNodeId; count: number; pose: PassengerPose }) => void
    onUpdate: (pose: PassengerPose) => void
}

const FINAL_HEIGHT = 74
const INITIAL_HEIGHT = 20
const OVERSHOOT_HEIGHT = 88
const INITIAL_Y_OFFSET = 8

export class AddPassengersPlacementAnimator extends StateAnimator<
    BusGameState,
    HydratedBusGameState,
    BusGameSession
> {
    constructor(
        gameSession: BusGameSession,
        private callbacks: AddPassengersPlacementAnimatorCallbacks
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
        if (!from || !action || !isAddPassengers(action) || !isBusNodeId(action.stationId)) {
            return
        }

        const point = BUS_BOARD_NODE_POINTS[action.stationId]
        if (!point) {
            return
        }

        const toCount = to.board.passengersAtNode(action.stationId).length
        if (toCount <= 0) {
            return
        }

        const pose: PassengerPose = {
            x: point.x,
            y: point.y + INITIAL_Y_OFFSET,
            height: INITIAL_HEIGHT
        }

        this.callbacks.onStart({
            nodeId: action.stationId,
            count: toCount,
            pose: { ...pose }
        })

        const startAt = 0
        const popDuration = 0.18

        animationContext.actionTimeline.to(
            pose,
            {
                y: point.y,
                height: OVERSHOOT_HEIGHT,
                duration: popDuration,
                ease: 'back.out(2.2)',
                onUpdate: () => {
                    this.callbacks.onUpdate({ ...pose })
                }
            },
            startAt
        )

        animationContext.actionTimeline.to(
            pose,
            {
                y: point.y,
                height: FINAL_HEIGHT,
                duration: 0.16,
                ease: 'power2.out',
                onUpdate: () => {
                    this.callbacks.onUpdate({ ...pose })
                }
            },
            startAt + popDuration
        )

    }
}
