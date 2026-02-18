import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import { gsap } from 'gsap'
import { MotionPathPlugin } from 'gsap/dist/MotionPathPlugin'
import {
    BuildingSites,
    isBusNodeId,
    isSiteId,
    isVroom,
    type Vroom,
    type BuildingSiteId,
    type BusGameState,
    type BusNodeId,
    type HydratedBusGameState
} from '@tabletop/bus'
import { BUS_BOARD_NODE_POINTS, BUS_BUILDING_SITE_POINTS } from '$lib/definitions/busBoardGraph.js'
import { StateAnimator } from './stateAnimator.js'
import type { BusGameSession } from '$lib/model/session.svelte.js'

gsap.registerPlugin(MotionPathPlugin)

type PassengerPose = {
    x: number
    y: number
    height: number
}

type BoardPoint = {
    x: number
    y: number
}

type PassengerDelivery = {
    id: string
    sourceNodeId: BusNodeId
    destinationSiteId: BuildingSiteId
}

type StagedSettlementDelivery = PassengerDelivery & {
    destinationSitePoint: BoardPoint
    pose: PassengerPose
}

type PassengerDeliveryAnimatorCallbacks = {
    onStart: (passengers: Array<PassengerDelivery & { pose: PassengerPose }>) => void
    onUpdate: (passengerId: string, pose: PassengerPose) => void
    onComplete: (passengerId: string) => void
}

const NODE_PASSENGER_HEIGHT = 74
const SITE_PASSENGER_HEIGHT = 44
const NODE_TRAVEL_DURATION_PER_HOP = 0.34
const FINAL_HOP_DURATION = 0.34
const SETTLEMENT_DELIVERY_DURATION = 0.32
const FALLBACK_DELIVERY_DURATION = 0.18

type PassengerLike = {
    id: string
    nodeId?: string
    siteId?: string
}

export function findNodeToSitePassengerDeliveries(
    fromPassengers: readonly PassengerLike[],
    toPassengers: readonly PassengerLike[]
): PassengerDelivery[] {
    const toPassengerById = new Map(toPassengers.map((passenger) => [passenger.id, passenger] as const))
    const deliveries: PassengerDelivery[] = []

    for (const fromPassenger of fromPassengers) {
        if (!fromPassenger.nodeId || !isBusNodeId(fromPassenger.nodeId) || fromPassenger.siteId) {
            continue
        }

        const toPassenger = toPassengerById.get(fromPassenger.id)
        if (!toPassenger?.siteId || !isSiteId(toPassenger.siteId)) {
            continue
        }

        deliveries.push({
            id: fromPassenger.id,
            sourceNodeId: fromPassenger.nodeId,
            destinationSiteId: toPassenger.siteId
        })
    }

    return deliveries
}

export class PassengerDeliveryAnimator extends StateAnimator<
    BusGameState,
    HydratedBusGameState,
    BusGameSession
> {
    constructor(
        gameSession: BusGameSession,
        private callbacks: PassengerDeliveryAnimatorCallbacks
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

        const settlementDeliveriesById = new Map(
            findNodeToSitePassengerDeliveries(from.board.passengers, to.board.passengers).map(
                (delivery) => [delivery.id, delivery] as const
            )
        )

        if (action && isVroom(action)) {
            const vroomDelivery = this.vroomDeliveryFromAction(action, from, settlementDeliveriesById)
            if (
                vroomDelivery &&
                this.animateVroomDelivery(vroomDelivery, from, action, animationContext)
            ) {
                settlementDeliveriesById.delete(vroomDelivery.id)
            }
        }

        if (settlementDeliveriesById.size === 0) {
            return
        }

        this.animateSettlementDeliveries(
            [...settlementDeliveriesById.values()],
            !!action,
            animationContext
        )
    }

    private pathBetweenNodes(
        line: readonly BusNodeId[],
        source: BusNodeId,
        destination: BusNodeId
    ): BusNodeId[] {
        if (source === destination) {
            return [source]
        }

        const adjacency = new Map<BusNodeId, Set<BusNodeId>>()

        const ensureSet = (nodeId: BusNodeId): Set<BusNodeId> => {
            let set = adjacency.get(nodeId)
            if (!set) {
                set = new Set<BusNodeId>()
                adjacency.set(nodeId, set)
            }
            return set
        }

        for (let index = 0; index < line.length - 1; index += 1) {
            const left = line[index]
            const right = line[index + 1]
            if (!left || !right) {
                continue
            }
            ensureSet(left).add(right)
            ensureSet(right).add(left)
        }

        const queue: BusNodeId[] = [source]
        const visited = new Set<BusNodeId>([source])
        const previous = new Map<BusNodeId, BusNodeId>()

        while (queue.length > 0) {
            const current = queue.shift()
            if (!current) {
                break
            }
            if (current === destination) {
                break
            }

            const neighbors = adjacency.get(current)
            if (!neighbors) {
                continue
            }

            for (const neighbor of neighbors) {
                if (visited.has(neighbor)) {
                    continue
                }
                visited.add(neighbor)
                previous.set(neighbor, current)
                queue.push(neighbor)
            }
        }

        if (!visited.has(destination)) {
            return [source, destination]
        }

        const path: BusNodeId[] = [destination]
        let cursor: BusNodeId | undefined = destination
        while (cursor && cursor !== source) {
            cursor = previous.get(cursor)
            if (!cursor) {
                break
            }
            path.push(cursor)
        }

        path.reverse()
        return path
    }

    private vroomDeliveryFromAction(
        action: Vroom,
        from: HydratedBusGameState,
        settlementDeliveriesById: Map<string, PassengerDelivery>
    ): PassengerDelivery | undefined {
        if (!isBusNodeId(action.sourceNode) || !isSiteId(action.destinationSite)) {
            return undefined
        }

        const sourceNodeId = action.sourceNode
        const destinationSiteId = action.destinationSite

        const metadataPassengerId = action.metadata?.passengerId
        if (metadataPassengerId) {
            return (
                settlementDeliveriesById.get(metadataPassengerId) ?? {
                    id: metadataPassengerId,
                    sourceNodeId,
                    destinationSiteId
                }
            )
        }

        const sourcePassenger = from.board.passengersAtNode(sourceNodeId).at(0)
        if (sourcePassenger?.id) {
            return (
                settlementDeliveriesById.get(sourcePassenger.id) ?? {
                    id: sourcePassenger.id,
                    sourceNodeId,
                    destinationSiteId
                }
            )
        }

        return [...settlementDeliveriesById.values()].find(
            (delivery) =>
                delivery.sourceNodeId === sourceNodeId &&
                delivery.destinationSiteId === destinationSiteId
        )
    }

    private animateVroomDelivery(
        delivery: PassengerDelivery,
        from: HydratedBusGameState,
        action: Vroom,
        animationContext: AnimationContext
    ): boolean {
        const sourcePoint = BUS_BOARD_NODE_POINTS[delivery.sourceNodeId]
        const destinationSitePoint = BUS_BUILDING_SITE_POINTS[delivery.destinationSiteId]
        if (!sourcePoint || !destinationSitePoint) {
            return false
        }

        const destinationNodeId = BuildingSites[delivery.destinationSiteId]?.nodeId
        const busLine = from.getPlayerState(action.playerId).busLine.filter(isBusNodeId)
        const nodePath = destinationNodeId
            ? this.pathBetweenNodes(busLine, delivery.sourceNodeId, destinationNodeId)
            : []
        const nodePoints = nodePath
            .map((nodeId) => BUS_BOARD_NODE_POINTS[nodeId])
            .filter((point): point is BoardPoint => !!point)
        const firstPoint = nodePoints[0] ?? sourcePoint

        const pose: PassengerPose = {
            x: firstPoint.x,
            y: firstPoint.y,
            height: NODE_PASSENGER_HEIGHT
        }

        this.callbacks.onStart([{ ...delivery, pose: { ...pose } }])

        const startAt = 0
        let nodeTravelDuration = 0
        const nodeWaypoints = nodePoints.slice(1)

        if (nodeWaypoints.length > 0) {
            nodeTravelDuration = nodeWaypoints.length * NODE_TRAVEL_DURATION_PER_HOP
            animationContext.actionTimeline.to(
                pose,
                {
                    motionPath: {
                        path: nodeWaypoints,
                        curviness: 1
                    },
                    height: NODE_PASSENGER_HEIGHT,
                    duration: nodeTravelDuration,
                    ease: 'power2.inOut',
                    onUpdate: () => {
                        this.callbacks.onUpdate(delivery.id, { ...pose })
                    }
                },
                startAt
            )
        }

        animationContext.actionTimeline.to(
            pose,
            {
                x: destinationSitePoint.x,
                y: destinationSitePoint.y,
                height: SITE_PASSENGER_HEIGHT,
                duration: FINAL_HOP_DURATION,
                ease: 'power2.inOut',
                onUpdate: () => {
                    this.callbacks.onUpdate(delivery.id, { ...pose })
                },
                onComplete: () => {
                    this.callbacks.onComplete(delivery.id)
                }
            },
            startAt + nodeTravelDuration
        )

        return true
    }

    private animateSettlementDeliveries(
        deliveries: PassengerDelivery[],
        hasAction: boolean,
        animationContext: AnimationContext
    ): void {
        const stagedDeliveries: StagedSettlementDelivery[] = deliveries
            .map((delivery) => {
                const sourcePoint = BUS_BOARD_NODE_POINTS[delivery.sourceNodeId]
                const destinationSitePoint = BUS_BUILDING_SITE_POINTS[delivery.destinationSiteId]
                if (!sourcePoint || !destinationSitePoint) {
                    return undefined
                }
                return {
                    ...delivery,
                    destinationSitePoint,
                    pose: {
                        x: sourcePoint.x,
                        y: sourcePoint.y,
                        height: NODE_PASSENGER_HEIGHT
                    }
                }
            })
            .filter((delivery): delivery is StagedSettlementDelivery => !!delivery)

        if (stagedDeliveries.length === 0) {
            return
        }

        const startPassengers = stagedDeliveries.map((delivery) => ({
            id: delivery.id,
            sourceNodeId: delivery.sourceNodeId,
            destinationSiteId: delivery.destinationSiteId,
            pose: { ...delivery.pose }
        }))

        animationContext.finalTimeline.call(() => {
            this.callbacks.onStart(startPassengers)
        }, undefined, 0)

        const duration = hasAction ? SETTLEMENT_DELIVERY_DURATION : FALLBACK_DELIVERY_DURATION
        for (const delivery of stagedDeliveries) {
            animationContext.finalTimeline.to(
                delivery.pose,
                {
                    x: delivery.destinationSitePoint.x,
                    y: delivery.destinationSitePoint.y,
                    height: SITE_PASSENGER_HEIGHT,
                    duration,
                    ease: 'power2.inOut',
                    onUpdate: () => {
                        this.callbacks.onUpdate(delivery.id, { ...delivery.pose })
                    }
                },
                0
            )
        }
    }
}
