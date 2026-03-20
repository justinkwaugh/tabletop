import type { BoatPose, RouteEndpoint } from '$lib/definitions/boatNavigation.js'
import {
    createArcSegment,
    createStraightSegment,
    normalizeAngle,
    type BoatMotionSegment
} from '$lib/definitions/boatMotion.js'
import {
    deserializeEndManeuver,
    deserializeStartManeuver,
    getRoutePlanStartPose,
    serializeEndManeuver,
    serializeStartManeuver,
    type SerializedEndManeuverRef,
    type SerializedStartManeuverRef
} from '$lib/definitions/boatPrecomputedManeuvers.js'
import type { BoatRoutePlan } from '$lib/definitions/boatPlanner.js'
import type { BoatRouteLayoutKey } from '$lib/definitions/boatRouteKeys.js'

type CompactTransitStraightSegment = [0, 0 | 1, number, number, number]
type CompactTransitArcSegment = [1, 0 | 1, number, number, number, number, 0 | 1]

export type CompactTransitSegment = CompactTransitStraightSegment | CompactTransitArcSegment

export type SerializedBoatRoutePlan = {
    u: SerializedStartManeuverRef | null
    t: CompactTransitSegment[]
    d: SerializedEndManeuverRef | null
}

export type PrecomputedBoatRoutesFile = {
    layoutKey: BoatRouteLayoutKey
    routeCount: number
    generatedAt: string
    routes: Record<string, SerializedBoatRoutePlan>
}

const XY_DECIMALS = 1
const ANGLE_DECIMALS = 3

function round(value: number, decimals: number): number {
    const factor = 10 ** decimals
    return Math.round(value * factor) / factor
}

function encodeDirection(direction: 'forward' | 'reverse'): 0 | 1 {
    return direction === 'forward' ? 1 : 0
}

function decodeDirection(direction: 0 | 1): 'forward' | 'reverse' {
    return direction === 1 ? 'forward' : 'reverse'
}

function serializeTransitSegment(segment: BoatMotionSegment): CompactTransitSegment {
    if (segment.kind === 'straight') {
        return [
            0,
            encodeDirection(segment.direction),
            round(segment.endPose.x, XY_DECIMALS),
            round(segment.endPose.y, XY_DECIMALS),
            round(segment.endPose.heading, ANGLE_DECIMALS)
        ]
    }

    if (segment.kind === 'arc') {
        if (segment.pivotOffsetAlongHeading != null) {
            throw new Error('Compact transit arcs do not support pivot offsets')
        }

        return [
            1,
            encodeDirection(segment.direction),
            round(segment.center.x, XY_DECIMALS),
            round(segment.center.y, XY_DECIMALS),
            round(segment.radius, XY_DECIMALS),
            round(segment.endAngle, ANGLE_DECIMALS),
            segment.clockwise ? 1 : 0
        ]
    }

    throw new Error('Compact transit segments do not support pivots')
}

function deserializeTransitSegments(
    serialized: CompactTransitSegment[],
    startPose: BoatPose
): BoatMotionSegment[] {
    const segments: BoatMotionSegment[] = []
    let currentPose = startPose

    for (const segment of serialized) {
        if (segment[0] === 0) {
            const endPose = {
                x: segment[2],
                y: segment[3],
                heading: segment[4]
            }
            const straight = createStraightSegment(
                currentPose,
                endPose,
                decodeDirection(segment[1])
            )
            segments.push(straight)
            currentPose = straight.endPose
            continue
        }

        const center = { x: segment[2], y: segment[3] }
        const radius = segment[4]
        const endAngle = segment[5]
        const clockwise = segment[6] === 1
        const direction = decodeDirection(segment[1])
        const startAngle = Math.atan2(currentPose.y - center.y, currentPose.x - center.x)
        const tangent = endAngle + (clockwise ? -Math.PI / 2 : Math.PI / 2)
        const endHeading =
            direction === 'forward' ? tangent : normalizeAngle(tangent + Math.PI)
        const endPose = {
            x: center.x + Math.cos(endAngle) * radius,
            y: center.y + Math.sin(endAngle) * radius,
            heading: normalizeAngle(endHeading)
        }

        const arc = createArcSegment({
            direction,
            startPose: currentPose,
            endPose,
            center,
            radius,
            startAngle,
            endAngle,
            clockwise
        })
        segments.push(arc)
        currentPose = arc.endPose
    }

    return segments
}

export function serializeBoatRoutePlan(
    plan: BoatRoutePlan,
    start: RouteEndpoint,
    end: RouteEndpoint
): SerializedBoatRoutePlan {
    const startRef = serializeStartManeuver(start, plan.undockSegments)
    const { ref: endRef, transitTailSegments } = serializeEndManeuver(end, plan.dockSegments)
    return {
        u: startRef,
        t: [...plan.transitSegments, ...transitTailSegments].map(serializeTransitSegment),
        d: endRef
    }
}

export function deserializeBoatRoutePlan(
    plan: SerializedBoatRoutePlan,
    start: RouteEndpoint,
    end: RouteEndpoint
): BoatRoutePlan {
    const undockSegments = deserializeStartManeuver(start, plan.u)
    const transitSegments = deserializeTransitSegments(
        plan.t,
        getRoutePlanStartPose(start, undockSegments)
    )
    const dockSegments = deserializeEndManeuver(end, plan.d)

    return {
        undockSegments,
        transitSegments,
        dockSegments,
        segments: [...undockSegments, ...transitSegments, ...dockSegments]
    }
}
