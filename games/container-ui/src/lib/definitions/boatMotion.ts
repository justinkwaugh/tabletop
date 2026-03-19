import type { BoatPose } from '$lib/definitions/boatNavigation.js'

export type BoatTravelDirection = 'forward' | 'reverse'

export type BoatStraightSegment = {
    kind: 'straight'
    direction: BoatTravelDirection
    startPose: BoatPose
    endPose: BoatPose
    length: number
}

export type BoatArcSegment = {
    kind: 'arc'
    direction: BoatTravelDirection
    startPose: BoatPose
    endPose: BoatPose
    center: { x: number; y: number }
    radius: number
    startAngle: number
    endAngle: number
    clockwise: boolean
    pivotOffsetAlongHeading?: number
    length: number
}

export type BoatPivotSegment = {
    kind: 'pivot'
    direction: BoatTravelDirection
    startPose: BoatPose
    endPose: BoatPose
    length: number
}

export type BoatMotionSegment = BoatStraightSegment | BoatArcSegment | BoatPivotSegment

export function createStraightSegment(
    startPose: BoatPose,
    endPose: BoatPose,
    direction: BoatTravelDirection
): BoatStraightSegment {
    return {
        kind: 'straight',
        direction,
        startPose,
        endPose,
        length: Math.hypot(endPose.x - startPose.x, endPose.y - startPose.y)
    }
}

export function createArcSegment(params: {
    direction: BoatTravelDirection
    startPose: BoatPose
    endPose: BoatPose
    center: { x: number; y: number }
    radius: number
    startAngle: number
    endAngle: number
    clockwise: boolean
    pivotOffsetAlongHeading?: number
}): BoatArcSegment {
    const { startAngle, endAngle, clockwise, radius } = params
    const sweep = normalizeArcSweep(startAngle, endAngle, clockwise)

    return {
        ...params,
        kind: 'arc',
        length: Math.abs(sweep) * radius
    }
}

export function createPivotSegment(
    startPose: BoatPose,
    endHeading: number,
    direction: BoatTravelDirection,
    pivotScale: number = 56
): BoatPivotSegment {
    return {
        kind: 'pivot',
        direction,
        startPose,
        endPose: {
            x: startPose.x,
            y: startPose.y,
            heading: normalizeAngle(endHeading)
        },
        length: Math.abs(normalizeAngle(endHeading - startPose.heading)) * pivotScale
    }
}

export function getMotionPathLength(segments: BoatMotionSegment[]): number {
    return segments.reduce((sum, segment) => sum + segment.length, 0)
}

export function sampleMotionPath(segments: BoatMotionSegment[], distance: number): BoatPose {
    if (segments.length === 0) {
        throw new Error('Cannot sample an empty boat motion path')
    }

    let remaining = Math.max(0, distance)
    for (const segment of segments) {
        if (remaining <= segment.length) {
            return sampleSegment(segment, remaining)
        }
        remaining -= segment.length
    }

    return segments.at(-1)!.endPose
}

function sampleSegment(segment: BoatMotionSegment, distance: number): BoatPose {
    if (segment.length === 0) {
        return segment.endPose
    }

    const t = distance / segment.length

    if (segment.kind === 'straight') {
        return {
            x: lerp(segment.startPose.x, segment.endPose.x, t),
            y: lerp(segment.startPose.y, segment.endPose.y, t),
            heading: lerpAngle(segment.startPose.heading, segment.endPose.heading, t)
        }
    }

    if (segment.kind === 'pivot') {
        return {
            x: segment.startPose.x,
            y: segment.startPose.y,
            heading: lerpAngle(segment.startPose.heading, segment.endPose.heading, t)
        }
    }

    const sweep = normalizeArcSweep(
        segment.startAngle,
        segment.endAngle,
        segment.clockwise
    )
    const angle = segment.startAngle + sweep * t
    const tangent =
        angle + (segment.clockwise ? -Math.PI / 2 : Math.PI / 2)
    const heading = segment.direction === 'forward' ? tangent : tangent + Math.PI

    return {
        x:
            segment.center.x +
            Math.cos(angle) * segment.radius -
            Math.cos(heading) * (segment.pivotOffsetAlongHeading ?? 0),
        y:
            segment.center.y +
            Math.sin(angle) * segment.radius -
            Math.sin(heading) * (segment.pivotOffsetAlongHeading ?? 0),
        heading: normalizeAngle(heading)
    }
}

function normalizeArcSweep(startAngle: number, endAngle: number, clockwise: boolean): number {
    let sweep = normalizeAngle(endAngle - startAngle)
    if (clockwise && sweep > 0) {
        sweep -= Math.PI * 2
    }
    if (!clockwise && sweep < 0) {
        sweep += Math.PI * 2
    }
    return sweep
}

function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t
}

function lerpAngle(start: number, end: number, t: number): number {
    const delta = normalizeAngle(end - start)
    return normalizeAngle(start + delta * t)
}

export function normalizeAngle(angle: number): number {
    let normalized = angle
    while (normalized <= -Math.PI) {
        normalized += Math.PI * 2
    }
    while (normalized > Math.PI) {
        normalized -= Math.PI * 2
    }
    return normalized
}
