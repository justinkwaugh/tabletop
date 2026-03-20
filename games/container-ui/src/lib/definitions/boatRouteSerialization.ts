import type { BoatPose } from '$lib/definitions/boatNavigation.js'
import type {
    BoatArcSegment,
    BoatMotionSegment,
    BoatPivotSegment,
    BoatStraightSegment
} from '$lib/definitions/boatMotion.js'
import type { BoatRoutePlan } from '$lib/definitions/boatPlanner.js'
import type { BoatRouteLayoutKey } from '$lib/definitions/boatRouteKeys.js'

type SerializedBoatSegmentBase = {
    direction: 'forward' | 'reverse'
    startPose: BoatPose
    endPose: BoatPose
    length: number
}

export type SerializedBoatStraightSegment = SerializedBoatSegmentBase & {
    kind: 'straight'
}

export type SerializedBoatArcSegment = SerializedBoatSegmentBase & {
    kind: 'arc'
    center: { x: number; y: number }
    radius: number
    startAngle: number
    endAngle: number
    clockwise: boolean
    pivotOffsetAlongHeading?: number
}

export type SerializedBoatPivotSegment = SerializedBoatSegmentBase & {
    kind: 'pivot'
}

export type SerializedBoatMotionSegment =
    | SerializedBoatStraightSegment
    | SerializedBoatArcSegment
    | SerializedBoatPivotSegment

export type SerializedBoatRoutePlan = {
    undockSegments: SerializedBoatMotionSegment[]
    transitSegments: SerializedBoatMotionSegment[]
    dockSegments: SerializedBoatMotionSegment[]
    segments: SerializedBoatMotionSegment[]
}

export type PrecomputedBoatRoutesFile = {
    layoutKey: BoatRouteLayoutKey
    routeCount: number
    generatedAt: string
    routes: Record<string, SerializedBoatRoutePlan>
}

export function serializeBoatMotionSegment(
    segment: BoatMotionSegment
): SerializedBoatMotionSegment {
    if (segment.kind === 'straight') {
        const straightSegment: BoatStraightSegment = segment
        return {
            kind: 'straight',
            direction: straightSegment.direction,
            startPose: straightSegment.startPose,
            endPose: straightSegment.endPose,
            length: straightSegment.length
        }
    }

    if (segment.kind === 'pivot') {
        const pivotSegment: BoatPivotSegment = segment
        return {
            kind: 'pivot',
            direction: pivotSegment.direction,
            startPose: pivotSegment.startPose,
            endPose: pivotSegment.endPose,
            length: pivotSegment.length
        }
    }

    const arcSegment: BoatArcSegment = segment
    return {
        kind: 'arc',
        direction: arcSegment.direction,
        startPose: arcSegment.startPose,
        endPose: arcSegment.endPose,
        center: arcSegment.center,
        radius: arcSegment.radius,
        startAngle: arcSegment.startAngle,
        endAngle: arcSegment.endAngle,
        clockwise: arcSegment.clockwise,
        pivotOffsetAlongHeading: arcSegment.pivotOffsetAlongHeading,
        length: arcSegment.length
    }
}

export function serializeBoatRoutePlan(plan: BoatRoutePlan): SerializedBoatRoutePlan {
    return {
        undockSegments: plan.undockSegments.map(serializeBoatMotionSegment),
        transitSegments: plan.transitSegments.map(serializeBoatMotionSegment),
        dockSegments: plan.dockSegments.map(serializeBoatMotionSegment),
        segments: plan.segments.map(serializeBoatMotionSegment)
    }
}

export function deserializeBoatMotionSegment(
    segment: SerializedBoatMotionSegment
): BoatMotionSegment {
    return { ...segment }
}

export function deserializeBoatRoutePlan(plan: SerializedBoatRoutePlan): BoatRoutePlan {
    return {
        undockSegments: plan.undockSegments.map(deserializeBoatMotionSegment),
        transitSegments: plan.transitSegments.map(deserializeBoatMotionSegment),
        dockSegments: plan.dockSegments.map(deserializeBoatMotionSegment),
        segments: plan.segments.map(deserializeBoatMotionSegment)
    }
}
