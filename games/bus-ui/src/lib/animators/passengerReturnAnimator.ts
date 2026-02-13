import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    isBusNodeId,
    isVroom,
    MachineState,
    isSiteId,
    type BuildingSiteId,
    type BusGameState,
    type BusNodeId,
    type HydratedBusGameState
} from '@tabletop/bus'
import { BUS_BOARD_NODE_POINTS, BUS_BUILDING_SITE_POINTS } from '$lib/definitions/busBoardGraph.js'
import { StateAnimator } from './stateAnimator.js'
import type { BusGameSession } from '$lib/model/session.svelte.js'

type PassengerPose = {
    x: number
    y: number
    height: number
}

type ReturningPassenger = {
    id: string
    sourceSiteId: BuildingSiteId
    destinationNodeId: BusNodeId
    pose: PassengerPose
}

type PassengerReturnAnimatorCallbacks = {
    onStart: (passengers: ReturningPassenger[]) => void
    onUpdate: (passengerId: string, pose: PassengerPose) => void
}

const SITE_PASSENGER_HEIGHT = 44
const NODE_PASSENGER_HEIGHT = 74
const RETURN_DURATION = 0.42

export class PassengerReturnAnimator extends StateAnimator<
    BusGameState,
    HydratedBusGameState,
    BusGameSession
> {
    constructor(
        gameSession: BusGameSession,
        private callbacks: PassengerReturnAnimatorCallbacks
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

        const toPassengersById = new Map(to.board.passengers.map((passenger) => [passenger.id, passenger]))
        const returningPassengers: ReturningPassenger[] = []

        for (const fromPassenger of from.board.passengers) {
            if (!fromPassenger.siteId || !isSiteId(fromPassenger.siteId)) {
                continue
            }

            const toPassenger = toPassengersById.get(fromPassenger.id)
            if (!toPassenger) {
                continue
            }

            if (toPassenger.siteId && isSiteId(toPassenger.siteId)) {
                continue
            }

            if (!toPassenger.nodeId || !isBusNodeId(toPassenger.nodeId)) {
                continue
            }

            const sourcePoint = BUS_BUILDING_SITE_POINTS[fromPassenger.siteId]
            const destinationPoint = BUS_BOARD_NODE_POINTS[toPassenger.nodeId]
            if (!sourcePoint || !destinationPoint) {
                continue
            }

            returningPassengers.push({
                id: fromPassenger.id,
                sourceSiteId: fromPassenger.siteId,
                destinationNodeId: toPassenger.nodeId,
                pose: {
                    x: sourcePoint.x,
                    y: sourcePoint.y,
                    height: SITE_PASSENGER_HEIGHT
                }
            })
        }

        // A Vroom action can be followed by an automatic round transition to ChoosingActions that
        // clears all site occupants before the persisted "to" snapshot. In that case the delivered
        // passenger may never appear with siteId in `from`, so synthesize its return from the
        // destination site to avoid a visual jump.
        if (
            to.machineState === MachineState.ChoosingActions &&
            action &&
            isVroom(action) &&
            isSiteId(action.destinationSite)
        ) {
            const destinationSiteId = action.destinationSite
            let deliveredPassengerId = action.metadata?.passengerId

            if (!deliveredPassengerId) {
                const movedFromSourceNode = from.board.passengers.filter((fromPassenger) => {
                    if (fromPassenger.siteId || fromPassenger.nodeId !== action.sourceNode) {
                        return false
                    }
                    const toPassenger = toPassengersById.get(fromPassenger.id)
                    return (
                        !!toPassenger &&
                        !toPassenger.siteId &&
                        !!toPassenger.nodeId &&
                        isBusNodeId(toPassenger.nodeId) &&
                        toPassenger.nodeId !== fromPassenger.nodeId
                    )
                })

                if (movedFromSourceNode.length === 1) {
                    deliveredPassengerId = movedFromSourceNode[0]?.id
                }
            }

            if (
                deliveredPassengerId &&
                !returningPassengers.some((passenger) => passenger.id === deliveredPassengerId)
            ) {
                const toPassenger = toPassengersById.get(deliveredPassengerId)
                if (
                    toPassenger &&
                    !toPassenger.siteId &&
                    toPassenger.nodeId &&
                    isBusNodeId(toPassenger.nodeId)
                ) {
                    const sourcePoint = BUS_BUILDING_SITE_POINTS[destinationSiteId]
                    const destinationPoint = BUS_BOARD_NODE_POINTS[toPassenger.nodeId]
                    if (sourcePoint && destinationPoint) {
                        returningPassengers.push({
                            id: deliveredPassengerId,
                            sourceSiteId: destinationSiteId,
                            destinationNodeId: toPassenger.nodeId,
                            pose: {
                                x: sourcePoint.x,
                                y: sourcePoint.y,
                                height: SITE_PASSENGER_HEIGHT
                            }
                        })
                    }
                }
            }
        }

        if (returningPassengers.length === 0) {
            return
        }

        const startingPassengers = returningPassengers.map((passenger) => ({
            ...passenger,
            pose: { ...passenger.pose }
        }))

        // Start rendering return transients when the final timeline begins, not while action
        // timeline animations (like delivery) are still playing.
        animationContext.finalTimeline.call(() => {
            this.callbacks.onStart(startingPassengers)
        }, undefined, 0)

        for (const passenger of returningPassengers) {
            const destinationPoint = BUS_BOARD_NODE_POINTS[passenger.destinationNodeId]
            if (!destinationPoint) {
                continue
            }

            animationContext.finalTimeline.to(
                passenger.pose,
                {
                    x: destinationPoint.x,
                    y: destinationPoint.y,
                    height: NODE_PASSENGER_HEIGHT,
                    duration: RETURN_DURATION,
                    ease: 'power2.inOut',
                    onUpdate: () => {
                        this.callbacks.onUpdate(passenger.id, { ...passenger.pose })
                    }
                },
                0
            )
        }
    }
}
