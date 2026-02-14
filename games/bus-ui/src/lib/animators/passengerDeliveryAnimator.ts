import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import { gsap } from 'gsap'
import { MotionPathPlugin } from 'gsap/dist/MotionPathPlugin'
import {
    BuildingSites,
    isBusNodeId,
    isSiteId,
    isVroom,
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

type PassengerDeliveryAnimatorCallbacks = {
    onStart: (args: {
        sourceNodeId: BusNodeId
        destinationSiteId: BuildingSiteId
        pose: PassengerPose
    }) => void
    onUpdate: (pose: PassengerPose) => void
    onComplete: () => void
}

const NODE_PASSENGER_HEIGHT = 74
const SITE_PASSENGER_HEIGHT = 44
const NODE_TRAVEL_DURATION_PER_HOP = 0.34
const FINAL_HOP_DURATION = 0.34
const FALLBACK_DELIVERY_DURATION = 0.18

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

        if (action && isVroom(action)) {
            const sourceNodeId = action.sourceNode as BusNodeId
            const destinationSiteId = action.destinationSite as BuildingSiteId
            const destinationNodeId = BuildingSites[destinationSiteId]?.nodeId
            if (!destinationNodeId) {
                return
            }

            const destinationSitePoint = BUS_BUILDING_SITE_POINTS[destinationSiteId]
            if (!destinationSitePoint) {
                return
            }

            const busLine = from.getPlayerState(action.playerId).busLine.filter(isBusNodeId)
            const nodePath = this.pathBetweenNodes(busLine, sourceNodeId, destinationNodeId)
            if (nodePath.length === 0) {
                return
            }

            const nodePoints = nodePath.map((nodeId) => BUS_BOARD_NODE_POINTS[nodeId]).filter(Boolean)
            if (nodePoints.length === 0) {
                return
            }

            const firstPoint = nodePoints[0]
            if (!firstPoint) {
                return
            }

            const pose: PassengerPose = {
                x: firstPoint.x,
                y: firstPoint.y,
                height: NODE_PASSENGER_HEIGHT
            }

            this.callbacks.onStart({
                sourceNodeId,
                destinationSiteId,
                pose: { ...pose }
            })

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
                            this.callbacks.onUpdate({ ...pose })
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
                        this.callbacks.onUpdate({ ...pose })
                    },
                    onComplete: () => {
                        this.callbacks.onComplete()
                    }
                },
                startAt + nodeTravelDuration
            )
            return
        }

        const toPassengerById = new Map(to.board.passengers.map((passenger) => [passenger.id, passenger]))
        const fallbackDelivery = from.board.passengers.find((fromPassenger) => {
            if (fromPassenger.siteId || !fromPassenger.nodeId || !isBusNodeId(fromPassenger.nodeId)) {
                return false
            }

            const toPassenger = toPassengerById.get(fromPassenger.id)
            return !!toPassenger && !!toPassenger.siteId && isSiteId(toPassenger.siteId)
        })

        if (!fallbackDelivery || !fallbackDelivery.nodeId || !isBusNodeId(fallbackDelivery.nodeId)) {
            return
        }

        const toPassenger = toPassengerById.get(fallbackDelivery.id)
        if (!toPassenger?.siteId || !isSiteId(toPassenger.siteId)) {
            return
        }

        const sourceNodeId = fallbackDelivery.nodeId
        const destinationSiteId = toPassenger.siteId
        const sourcePoint = BUS_BOARD_NODE_POINTS[sourceNodeId]
        const destinationSitePoint = BUS_BUILDING_SITE_POINTS[destinationSiteId]
        if (!sourcePoint || !destinationSitePoint) {
            return
        }

        const pose: PassengerPose = {
            x: sourcePoint.x,
            y: sourcePoint.y,
            height: NODE_PASSENGER_HEIGHT
        }

        this.callbacks.onStart({
            sourceNodeId,
            destinationSiteId,
            pose: { ...pose }
        })

        animationContext.actionTimeline.to(
            pose,
            {
                x: destinationSitePoint.x,
                y: destinationSitePoint.y,
                height: SITE_PASSENGER_HEIGHT,
                duration: FALLBACK_DELIVERY_DURATION,
                ease: 'power2.inOut',
                onUpdate: () => {
                    this.callbacks.onUpdate({ ...pose })
                },
                onComplete: () => {
                    this.callbacks.onComplete()
                }
            },
            0
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
}
