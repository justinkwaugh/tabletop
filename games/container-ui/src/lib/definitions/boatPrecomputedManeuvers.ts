import type {
    BoatPose,
    DockSlot,
    OpenWaterSlot,
    RouteEndpoint
} from '$lib/definitions/boatNavigation.js'
import {
    createArcSegment,
    createStraightSegment,
    normalizeAngle,
    type BoatArcSegment,
    type BoatMotionSegment,
    type BoatStraightSegment
} from '$lib/definitions/boatMotion.js'
import {
    DOCK_MANEUVER_CONFIG,
    HARBOR_K_TURN_LATERAL_OFFSET,
    HARBOR_K_TURN_REENTRY_DISTANCE,
    OPEN_WATER_LONG_REVERSE_DISTANCE,
    OPEN_WATER_SHARP_UNDOCK_CONFIG,
    OPEN_WATER_STRAIGHT_APPROACH_DISTANCES,
    OPEN_WATER_TURN_RADIUS
} from '$lib/definitions/boatManeuverConfig.js'

export type SerializedStartManeuverRef =
    | [0, -1 | 1]
    | [1, -1 | 1, number]
    | [2]
    | [3, -1 | 1]

export type SerializedEndManeuverRef =
    | [0, number]
    | [1, -1 | 1]
    | [2, -1 | 1, number]
    | [3, number]
    | [4, -1 | 1]

const POSE_EPSILON = 0.5

function isDockSlot(endpoint: RouteEndpoint): endpoint is DockSlot {
    return endpoint.family !== 'open-water'
}

function isOpenWaterSlot(endpoint: RouteEndpoint): endpoint is OpenWaterSlot {
    return endpoint.family === 'open-water'
}

function poseMatches(a: BoatPose, b: BoatPose): boolean {
    return (
        Math.abs(a.x - b.x) <= POSE_EPSILON &&
        Math.abs(a.y - b.y) <= POSE_EPSILON &&
        Math.abs(normalizeAngle(a.heading - b.heading)) <= 0.01
    )
}

function getTurnSign(delta: number): -1 | 1 {
    return normalizeAngle(delta) >= 0 ? 1 : -1
}

function findDistanceIndex(distance: number, candidates: number[]): number {
    const rounded = Math.round(distance)
    const index = candidates.findIndex((candidate) => Math.abs(candidate - rounded) <= 1)
    if (index < 0) {
        throw new Error(`Unsupported maneuver distance: ${distance}`)
    }
    return index
}

function getEndpointStartPose(endpoint: RouteEndpoint): BoatPose {
    return isDockSlot(endpoint) ? endpoint.dockedPose : endpoint.parkedPose
}

function createForwardArcFromStartPose(
    startPose: BoatPose,
    delta: number,
    radius: number
): BoatArcSegment {
    const turningLeft = delta >= 0
    const center = {
        x:
            startPose.x +
            (turningLeft ? -Math.sin(startPose.heading) : Math.sin(startPose.heading)) * radius,
        y:
            startPose.y +
            (turningLeft ? Math.cos(startPose.heading) : -Math.cos(startPose.heading)) * radius
    }
    const startAngle = Math.atan2(startPose.y - center.y, startPose.x - center.x)
    const endAngle = startAngle + delta
    const endPose = {
        x: center.x + Math.cos(endAngle) * radius,
        y: center.y + Math.sin(endAngle) * radius,
        heading: normalizeAngle(startPose.heading + delta)
    }

    return createArcSegment({
        direction: 'forward',
        startPose,
        endPose,
        center,
        radius,
        startAngle,
        endAngle,
        clockwise: !turningLeft
    })
}

function createReverseArcFromStartPose(
    startPose: BoatPose,
    delta: number,
    radius: number
): BoatArcSegment {
    const travelStartPose = {
        ...startPose,
        heading: normalizeAngle(startPose.heading + Math.PI)
    }
    const forwardArc = createForwardArcFromStartPose(travelStartPose, delta, radius)
    return createArcSegment({
        direction: 'reverse',
        startPose,
        endPose: {
            x: forwardArc.endPose.x,
            y: forwardArc.endPose.y,
            heading: normalizeAngle(forwardArc.endPose.heading - Math.PI)
        },
        center: forwardArc.center,
        radius: forwardArc.radius,
        startAngle: forwardArc.startAngle,
        endAngle: forwardArc.endAngle,
        clockwise: forwardArc.clockwise
    })
}

function createArcToEndPose(
    endPose: BoatPose,
    startHeading: number,
    delta: number,
    radius: number
): BoatArcSegment {
    const turningLeft = delta >= 0
    const center = {
        x:
            endPose.x +
            (turningLeft ? -Math.sin(endPose.heading) : Math.sin(endPose.heading)) * radius,
        y:
            endPose.y +
            (turningLeft ? Math.cos(endPose.heading) : -Math.cos(endPose.heading)) * radius
    }
    const startPose = {
        x:
            center.x -
            (turningLeft ? -Math.sin(startHeading) : Math.sin(startHeading)) * radius,
        y:
            center.y -
            (turningLeft ? Math.cos(startHeading) : -Math.cos(startHeading)) * radius,
        heading: startHeading
    }
    const startAngle = Math.atan2(startPose.y - center.y, startPose.x - center.x)
    const endAngle = Math.atan2(endPose.y - center.y, endPose.x - center.x)

    return createArcSegment({
        direction: 'forward',
        startPose,
        endPose,
        center,
        radius,
        startAngle,
        endAngle,
        clockwise: !turningLeft
    })
}

function createReverseArcToEndPose(
    endPose: BoatPose,
    startHeading: number,
    delta: number,
    radius: number
): BoatArcSegment {
    const forwardArc = createArcToEndPose(
        {
            x: endPose.x,
            y: endPose.y,
            heading: normalizeAngle(endPose.heading + Math.PI)
        },
        normalizeAngle(startHeading + Math.PI),
        delta,
        radius
    )

    return createArcSegment({
        direction: 'reverse',
        startPose: {
            x: forwardArc.startPose.x,
            y: forwardArc.startPose.y,
            heading: startHeading
        },
        endPose,
        center: forwardArc.center,
        radius: forwardArc.radius,
        startAngle: forwardArc.startAngle,
        endAngle: forwardArc.endAngle,
        clockwise: forwardArc.clockwise
    })
}

export function serializeStartManeuver(
    endpoint: RouteEndpoint,
    undockSegments: BoatMotionSegment[]
): SerializedStartManeuverRef | null {
    if (isOpenWaterSlot(endpoint)) {
        if (
            undockSegments.length === 1 &&
            undockSegments[0]?.kind === 'straight'
        ) {
            return [2]
        }

        const arc = undockSegments.at(-1)
        if (
            undockSegments.length === 2 &&
            undockSegments[0]?.kind === 'straight' &&
            arc?.kind === 'arc'
        ) {
            return [3, getTurnSign(arc.endPose.heading - endpoint.parkedPose.heading)]
        }
    } else {
        const config = DOCK_MANEUVER_CONFIG[endpoint.family]
        const arc = undockSegments.at(-1)
        const middle = undockSegments[1]
        if (
            undockSegments.length === 3 &&
            undockSegments[0]?.kind === 'straight' &&
            middle?.kind === 'straight' &&
            arc?.kind === 'arc'
        ) {
            const turn = getTurnSign(arc.endPose.heading - endpoint.stagingPose.heading)
            if (arc.direction === 'reverse') {
                return [0, turn]
            }

            return [
                1,
                turn,
                findDistanceIndex(middle.length, [
                    HARBOR_K_TURN_REENTRY_DISTANCE,
                    ...config.straightApproachDistances
                ])
            ]
        }
    }

    throw new Error(`Unsupported start maneuver for ${endpoint.canonicalId}`)
}

export function deserializeStartManeuver(
    endpoint: RouteEndpoint,
    ref: SerializedStartManeuverRef | null
): BoatMotionSegment[] {
    if (!ref) {
        return []
    }

    if (isOpenWaterSlot(endpoint)) {
        if (ref[0] === 2) {
            return [createStraightSegment(endpoint.parkedPose, endpoint.stagingPose, 'reverse')]
        }

        if (ref[0] === 3) {
            const clearancePose = {
                x:
                    endpoint.parkedPose.x -
                    Math.cos(endpoint.parkedPose.heading) *
                        OPEN_WATER_SHARP_UNDOCK_CONFIG.undockReverseDistance,
                y:
                    endpoint.parkedPose.y -
                    Math.sin(endpoint.parkedPose.heading) *
                        OPEN_WATER_SHARP_UNDOCK_CONFIG.undockReverseDistance,
                heading: endpoint.parkedPose.heading
            }
            return [
                createStraightSegment(endpoint.parkedPose, clearancePose, 'reverse'),
                createReverseArcFromStartPose(
                    clearancePose,
                    ref[1] * (Math.PI / 2),
                    OPEN_WATER_SHARP_UNDOCK_CONFIG.undockReverseTurnRadius
                )
            ]
        }
    } else {
        const config = DOCK_MANEUVER_CONFIG[endpoint.family]
        const baseReverse = createStraightSegment(endpoint.dockedPose, endpoint.stagingPose, 'reverse')

        if (ref[0] === 0) {
            const clearancePose = {
                x:
                    endpoint.stagingPose.x -
                    Math.cos(endpoint.stagingPose.heading) * config.undockReverseDistance,
                y:
                    endpoint.stagingPose.y -
                    Math.sin(endpoint.stagingPose.heading) * config.undockReverseDistance,
                heading: endpoint.stagingPose.heading
            }
            return [
                baseReverse,
                createStraightSegment(endpoint.stagingPose, clearancePose, 'reverse'),
                createReverseArcFromStartPose(
                    clearancePose,
                    ref[1] * (Math.PI / 2),
                    config.undockReverseTurnRadius
                )
            ]
        }

        if (ref[0] === 1) {
            const reverseDistance = [
                HARBOR_K_TURN_REENTRY_DISTANCE,
                ...config.straightApproachDistances
            ][ref[2]]
            if (reverseDistance == null) {
                throw new Error(`Unsupported harbor-exit index for ${endpoint.canonicalId}`)
            }

            const clearancePose = {
                x:
                    endpoint.stagingPose.x -
                    Math.cos(endpoint.stagingPose.heading) * reverseDistance,
                y:
                    endpoint.stagingPose.y -
                    Math.sin(endpoint.stagingPose.heading) * reverseDistance,
                heading: endpoint.stagingPose.heading
            }
            return [
                baseReverse,
                createStraightSegment(endpoint.stagingPose, clearancePose, 'reverse'),
                createForwardArcFromStartPose(
                    clearancePose,
                    ref[1] * (Math.PI / 2),
                    HARBOR_K_TURN_LATERAL_OFFSET
                )
            ]
        }
    }

    throw new Error(`Unsupported start maneuver ref for ${endpoint.canonicalId}`)
}

export function serializeEndManeuver(
    endpoint: RouteEndpoint,
    dockSegments: BoatMotionSegment[]
): {
    ref: SerializedEndManeuverRef | null
    transitTailSegments: BoatMotionSegment[]
} {
    if (dockSegments.length === 0) {
        return { ref: null, transitTailSegments: [] }
    }

    if (isOpenWaterSlot(endpoint)) {
        const finalPark = dockSegments.at(-1)
        const beforeFinal = dockSegments.at(-2)
        if (
            finalPark?.kind === 'straight' &&
            beforeFinal?.kind === 'straight' &&
            poseMatches(beforeFinal.endPose, endpoint.stagingPose)
        ) {
            return {
                ref: [
                    3,
                    findDistanceIndex(
                        beforeFinal.length,
                        OPEN_WATER_STRAIGHT_APPROACH_DISTANCES
                    )
                ],
                transitTailSegments: dockSegments.slice(0, -2)
            }
        }

        if (
            finalPark?.kind === 'straight' &&
            beforeFinal?.kind === 'arc' &&
            poseMatches(beforeFinal.endPose, endpoint.stagingPose)
        ) {
            return {
                ref: [4, getTurnSign(beforeFinal.startPose.heading - endpoint.stagingPose.heading)],
                transitTailSegments: dockSegments.slice(0, -2)
            }
        }
    } else {
        const finalDock = dockSegments.at(-1)
        const beforeFinal = dockSegments.at(-2)
        const thirdFromEnd = dockSegments.at(-3)

        if (
            finalDock?.kind === 'straight' &&
            beforeFinal?.kind === 'straight' &&
            poseMatches(beforeFinal.endPose, endpoint.stagingPose)
        ) {
            return {
                ref: [
                    0,
                    findDistanceIndex(
                        beforeFinal.length,
                        DOCK_MANEUVER_CONFIG[endpoint.family].straightApproachDistances
                    )
                ],
                transitTailSegments: dockSegments.slice(0, -2)
            }
        }

        if (
            finalDock?.kind === 'straight' &&
            beforeFinal?.kind === 'arc' &&
            poseMatches(beforeFinal.endPose, endpoint.stagingPose)
        ) {
            return {
                ref: [1, getTurnSign(beforeFinal.startPose.heading - endpoint.stagingPose.heading)],
                transitTailSegments: dockSegments.slice(0, -2)
            }
        }

        if (
            finalDock?.kind === 'straight' &&
            beforeFinal?.kind === 'straight' &&
            thirdFromEnd?.kind === 'arc' &&
            thirdFromEnd.direction === 'reverse' &&
            poseMatches(beforeFinal.endPose, endpoint.stagingPose)
        ) {
            return {
                ref: [
                    2,
                    getTurnSign(thirdFromEnd.startPose.heading - endpoint.stagingPose.heading),
                    findDistanceIndex(beforeFinal.length, [
                        HARBOR_K_TURN_REENTRY_DISTANCE,
                        ...DOCK_MANEUVER_CONFIG[endpoint.family].straightApproachDistances
                    ])
                ],
                transitTailSegments: dockSegments.slice(0, -3)
            }
        }
    }

    throw new Error(`Unsupported end maneuver for ${endpoint.canonicalId}`)
}

export function deserializeEndManeuver(
    endpoint: RouteEndpoint,
    ref: SerializedEndManeuverRef | null
): BoatMotionSegment[] {
    if (!ref) {
        return []
    }

    if (isOpenWaterSlot(endpoint)) {
        if (ref[0] === 3) {
            const approachDistance = OPEN_WATER_STRAIGHT_APPROACH_DISTANCES[ref[1]]
            if (approachDistance == null) {
                throw new Error(`Unsupported open-water straight index for ${endpoint.canonicalId}`)
            }
            const approachPose = {
                x:
                    endpoint.stagingPose.x -
                    Math.cos(endpoint.stagingPose.heading) * approachDistance,
                y:
                    endpoint.stagingPose.y -
                    Math.sin(endpoint.stagingPose.heading) * approachDistance,
                heading: endpoint.stagingPose.heading
            }
            return [
                createStraightSegment(approachPose, endpoint.stagingPose, 'forward'),
                createStraightSegment(endpoint.stagingPose, endpoint.parkedPose, 'forward')
            ]
        }

        if (ref[0] === 4) {
            const startHeading = normalizeAngle(endpoint.stagingPose.heading + ref[1] * (Math.PI / 2))
            return [
                createArcToEndPose(
                    endpoint.stagingPose,
                    startHeading,
                    normalizeAngle(endpoint.stagingPose.heading - startHeading),
                    OPEN_WATER_TURN_RADIUS
                ),
                createStraightSegment(endpoint.stagingPose, endpoint.parkedPose, 'forward')
            ]
        }
    } else {
        const config = DOCK_MANEUVER_CONFIG[endpoint.family]
        if (ref[0] === 0) {
            const approachDistance = config.straightApproachDistances[ref[1]]
            if (approachDistance == null) {
                throw new Error(`Unsupported dock straight index for ${endpoint.canonicalId}`)
            }
            const approachPose = {
                x:
                    endpoint.stagingPose.x -
                    Math.cos(endpoint.stagingPose.heading) * approachDistance,
                y:
                    endpoint.stagingPose.y -
                    Math.sin(endpoint.stagingPose.heading) * approachDistance,
                heading: endpoint.stagingPose.heading
            }
            return [
                createStraightSegment(approachPose, endpoint.stagingPose, 'forward'),
                createStraightSegment(endpoint.stagingPose, endpoint.dockedPose, 'forward')
            ]
        }

        if (ref[0] === 1) {
            const startHeading = normalizeAngle(endpoint.stagingPose.heading + ref[1] * (Math.PI / 2))
            return [
                createArcToEndPose(
                    endpoint.stagingPose,
                    startHeading,
                    normalizeAngle(endpoint.stagingPose.heading - startHeading),
                    config.turnRadius
                ),
                createStraightSegment(endpoint.stagingPose, endpoint.dockedPose, 'forward')
            ]
        }

        if (ref[0] === 2) {
            const approachDistance = [
                HARBOR_K_TURN_REENTRY_DISTANCE,
                ...config.straightApproachDistances
            ][ref[2]]
            if (approachDistance == null) {
                throw new Error(`Unsupported harbor k-turn index for ${endpoint.canonicalId}`)
            }
            const approachPose = {
                x:
                    endpoint.stagingPose.x -
                    Math.cos(endpoint.stagingPose.heading) * approachDistance,
                y:
                    endpoint.stagingPose.y -
                    Math.sin(endpoint.stagingPose.heading) * approachDistance,
                heading: endpoint.stagingPose.heading
            }
            const startHeading = normalizeAngle(endpoint.stagingPose.heading + ref[1] * (Math.PI / 2))
            return [
                createReverseArcToEndPose(
                    approachPose,
                    startHeading,
                    normalizeAngle(approachPose.heading - startHeading),
                    HARBOR_K_TURN_LATERAL_OFFSET
                ),
                createStraightSegment(approachPose, endpoint.stagingPose, 'forward'),
                createStraightSegment(endpoint.stagingPose, endpoint.dockedPose, 'forward')
            ]
        }
    }

    throw new Error(`Unsupported end maneuver ref for ${endpoint.canonicalId}`)
}

export function getRoutePlanStartPose(
    endpoint: RouteEndpoint,
    undockSegments: BoatMotionSegment[]
): BoatPose {
    return undockSegments.at(-1)?.endPose ?? getEndpointStartPose(endpoint)
}

export function getRoutePlanDockStartPose(
    endpoint: RouteEndpoint,
    dockSegments: BoatMotionSegment[]
): BoatPose {
    return dockSegments[0]?.startPose ?? getEndpointStartPose(endpoint)
}
