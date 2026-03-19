import type { Point } from '@tabletop/common'
import type { BoatNavigationGeometry, BoatPose, DockSlot } from '$lib/definitions/boatNavigation.js'
import { getBoatFootprintPolygon } from '$lib/definitions/boatNavigation.js'
import {
    type BoatArcSegment,
    createArcSegment,
    createStraightSegment,
    normalizeAngle,
    sampleMotionPath,
    type BoatMotionSegment
} from '$lib/definitions/boatMotion.js'
import {
    boundsOverlap,
    distanceFromPointToPolygon,
    distanceBetween,
    getPolygonBounds,
    polygonsIntersect
} from '$lib/definitions/geometry2d.js'

export type BoatRoutePlan = {
    undockSegments: BoatMotionSegment[]
    transitSegments: BoatMotionSegment[]
    dockSegments: BoatMotionSegment[]
    segments: BoatMotionSegment[]
}

type SearchNode = {
    id: string
    bucketKey: string
    pose: BoatPose
    cost: number
    estimate: number
    parentId?: string
    incomingSegment?: BoatMotionSegment
}

type DockManeuverConfig = {
    undockReverseDistance: number
    undockReverseTurnRadius: number
    turnRadius: number
}

type DockManeuverCandidate = {
    transitPose: BoatPose
    maneuverSegments: BoatMotionSegment[]
    score: number
}

const STRAIGHT_STEP = 54
const TURN_RADIUS = 118
const TURN_ANGLE = Math.PI / 7
const POSITION_BUCKET = 28
const HEADING_BUCKET = Math.PI / 10
const GOAL_DISTANCE = 48
const GOAL_HEADING = Math.PI / 10
const MAX_SEARCH_ITERATIONS = 4000
const COLLISION_SAMPLE_STEP = 18
const GOAL_CONNECTION_HEADING_TOLERANCE = Math.PI / 24
const GOAL_CONNECTION_ALIGNMENT_TOLERANCE = Math.PI / 18
const ARC_SEGMENT_PENALTY = 28
const OBSTACLE_CLEARANCE_TARGET = 120
const OBSTACLE_PROXIMITY_WEIGHT = 0.32
const DOCK_MANEUVER_CONFIG: Record<DockSlot['family'], DockManeuverConfig> = {
    'main-island-harbor': {
        undockReverseDistance: 100,
        undockReverseTurnRadius: 42,
        turnRadius: 132
    },
    'player-board': {
        undockReverseDistance: 52,
        undockReverseTurnRadius: 36,
        turnRadius: 118
    }
}

export function buildDockTransferPlan(
    startDock: DockSlot,
    endDock: DockSlot,
    geometry: BoatNavigationGeometry,
    occupiedBoatPoses: BoatPose[] = []
): BoatRoutePlan | null {
    const undockCandidates = buildUndockCandidates(startDock, endDock.stagingPose)

    for (const undockCandidate of undockCandidates) {
        const dockCandidates = buildDockCandidates(endDock, undockCandidate.transitPose)

        for (const dockCandidate of dockCandidates) {
            const transitSegments = planTransitSegments(
                undockCandidate.transitPose,
                dockCandidate.transitPose,
                geometry,
                occupiedBoatPoses
            )
            if (!transitSegments) {
                continue
            }

            const undockSegments = [
                createStraightSegment(startDock.dockedPose, startDock.stagingPose, 'reverse'),
                ...undockCandidate.maneuverSegments
            ]
            const dockSegments = [
                ...dockCandidate.maneuverSegments,
                createStraightSegment(endDock.stagingPose, endDock.dockedPose, 'forward')
            ]

            return {
                undockSegments,
                transitSegments,
                dockSegments,
                segments: [...undockSegments, ...transitSegments, ...dockSegments]
            }
        }
    }

    return null
}

function planTransitSegments(
    startPose: BoatPose,
    goalPose: BoatPose,
    geometry: BoatNavigationGeometry,
    occupiedBoatPoses: BoatPose[]
): BoatMotionSegment[] | null {
    let nextNodeId = 0
    const startNode: SearchNode = {
        id: `node-${nextNodeId++}`,
        bucketKey: poseKey(startPose),
        pose: startPose,
        cost: 0,
        estimate: heuristic(startPose, goalPose)
    }

    const open = [startNode]
    const bestByBucketKey = new Map([[startNode.bucketKey, startNode]])
    const nodesById = new Map([[startNode.id, startNode]])
    const closed = new Set<string>()

    for (let iteration = 0; iteration < MAX_SEARCH_ITERATIONS && open.length > 0; iteration += 1) {
        open.sort((a, b) => a.estimate - b.estimate)
        const current = open.shift()!

        if (closed.has(current.bucketKey)) {
            continue
        }
        closed.add(current.bucketKey)

        const goalConnection = buildGoalConnectionSegments(
            current.pose,
            goalPose,
            geometry,
            occupiedBoatPoses
        )
        if (goalConnection) {
            return [...reconstructSegments(current, nodesById), ...goalConnection]
        }

        for (const segment of expandSegments(current.pose)) {
            if (
                !isSegmentCollisionFree(segment, geometry, occupiedBoatPoses) ||
                !isReasonableProgress(current.pose, segment.endPose, goalPose)
            ) {
                continue
            }

            const nextPose = segment.endPose
            const bucketKey = poseKey(nextPose)
            if (closed.has(bucketKey)) {
                continue
            }

            const nextCost =
                current.cost + getSegmentTraversalCost(segment, geometry, occupiedBoatPoses)
            const previous = bestByBucketKey.get(bucketKey)
            if (previous && previous.cost <= nextCost) {
                continue
            }

            const nextNode: SearchNode = {
                id: `node-${nextNodeId++}`,
                bucketKey,
                pose: nextPose,
                cost: nextCost,
                estimate: nextCost + heuristic(nextPose, goalPose),
                parentId: current.id,
                incomingSegment: segment
            }
            bestByBucketKey.set(bucketKey, nextNode)
            nodesById.set(nextNode.id, nextNode)
            open.push(nextNode)
        }
    }

    return null
}

function expandSegments(pose: BoatPose): BoatMotionSegment[] {
    return [
        createForwardStraightSegment(pose),
        createTurnSegment(pose, 'left'),
        createTurnSegment(pose, 'right')
    ]
}

function buildUndockCandidates(
    dock: DockSlot,
    targetPose: BoatPose
): DockManeuverCandidate[] {
    const config = DOCK_MANEUVER_CONFIG[dock.family]
    const preferredBearing = Math.atan2(
        targetPose.y - dock.stagingPose.y,
        targetPose.x - dock.stagingPose.x
    )
    const candidates = buildPerpendicularCandidates(
        dock.stagingPose.heading,
        preferredBearing
    )

    return buildReverseThenTurnCandidates(
        dock.stagingPose,
        candidates,
        config
    )
}

function buildDockCandidates(
    dock: DockSlot,
    sourcePose: BoatPose
): DockManeuverCandidate[] {
    const config = DOCK_MANEUVER_CONFIG[dock.family]
    const preferredBearing = Math.atan2(
        dock.stagingPose.y - sourcePose.y,
        dock.stagingPose.x - sourcePose.x
    )
    const candidates = buildPerpendicularCandidates(
        dock.stagingPose.heading,
        preferredBearing
    )

    const validCandidates: DockManeuverCandidate[] = []
    for (const candidateHeading of candidates) {
        const arcSegment = createArcToEndPose(
            dock.stagingPose,
            candidateHeading.heading,
            normalizeAngle(dock.stagingPose.heading - candidateHeading.heading),
            config.turnRadius
        )

        validCandidates.push({
            transitPose: arcSegment.startPose,
            maneuverSegments: [arcSegment],
            score: candidateHeading.score
        })
    }

    return validCandidates.sort((a, b) => a.score - b.score)
}

function buildReverseThenTurnCandidates(
    startPose: BoatPose,
    headingCandidates: Array<{ heading: number; score: number }>,
    config: DockManeuverConfig
): DockManeuverCandidate[] {
    const candidates: DockManeuverCandidate[] = []

    for (const headingCandidate of headingCandidates) {
        const clearancePose = {
            x: startPose.x - Math.cos(startPose.heading) * config.undockReverseDistance,
            y: startPose.y - Math.sin(startPose.heading) * config.undockReverseDistance,
            heading: startPose.heading
        }
        const reverseSegment = createStraightSegment(startPose, clearancePose, 'reverse')
        const reverseTurnSegment = createReverseArcFromStartPose(
            clearancePose,
            normalizeAngle(headingCandidate.heading - clearancePose.heading),
            config.undockReverseTurnRadius
        )

        candidates.push({
            transitPose: reverseTurnSegment.endPose,
            maneuverSegments: [reverseSegment, reverseTurnSegment],
            score: headingCandidate.score
        })
    }

    return candidates.sort((a, b) => a.score - b.score)
}

function createReverseArcFromStartPose(
    startPose: BoatPose,
    delta: number,
    radius: number
): BoatArcSegment {
    const travelStartHeading = normalizeAngle(startPose.heading + Math.PI)
    const travelStartPose = {
        ...startPose,
        heading: travelStartHeading
    }
    const travelArc = createForwardArcFromStartPose(travelStartPose, delta, radius)

    return createArcSegment({
        direction: 'reverse',
        startPose,
        endPose: {
            x: travelArc.endPose.x,
            y: travelArc.endPose.y,
            heading: normalizeAngle(travelArc.endPose.heading - Math.PI)
        },
        center: travelArc.center,
        radius: travelArc.radius,
        startAngle: travelArc.startAngle,
        endAngle: travelArc.endAngle,
        clockwise: travelArc.clockwise
    })
}

function buildPerpendicularCandidates(
    dockHeading: number,
    preferredBearing: number
): Array<{ heading: number; score: number }> {
    const headings = [
        normalizeAngle(dockHeading + Math.PI / 2),
        normalizeAngle(dockHeading - Math.PI / 2)
    ]

    return headings
        .map((heading) => ({
            heading,
            score: Math.abs(normalizeAngle(preferredBearing - heading))
        }))
        .sort((a, b) => a.score - b.score)
}

function createForwardStraightSegment(startPose: BoatPose): BoatMotionSegment {
    return createStraightSegment(
        startPose,
        {
            x: startPose.x + Math.cos(startPose.heading) * STRAIGHT_STEP,
            y: startPose.y + Math.sin(startPose.heading) * STRAIGHT_STEP,
            heading: startPose.heading
        },
        'forward'
    )
}

function createTurnSegment(startPose: BoatPose, direction: 'left' | 'right'): BoatMotionSegment {
    const centerOffset =
        direction === 'left'
            ? { x: -Math.sin(startPose.heading) * TURN_RADIUS, y: Math.cos(startPose.heading) * TURN_RADIUS }
            : { x: Math.sin(startPose.heading) * TURN_RADIUS, y: -Math.cos(startPose.heading) * TURN_RADIUS }

    const center = {
        x: startPose.x + centerOffset.x,
        y: startPose.y + centerOffset.y
    }
    const startAngle = Math.atan2(startPose.y - center.y, startPose.x - center.x)
    const signedTurn = direction === 'left' ? TURN_ANGLE : -TURN_ANGLE
    const endAngle = startAngle + signedTurn
    const endPose = {
        x: center.x + Math.cos(endAngle) * TURN_RADIUS,
        y: center.y + Math.sin(endAngle) * TURN_RADIUS,
        heading: normalizeAngle(startPose.heading + signedTurn)
    }

    return createArcSegment({
        direction: 'forward',
        startPose,
        endPose,
        center,
        radius: TURN_RADIUS,
        startAngle,
        endAngle,
        clockwise: direction === 'right'
    })
}

function createForwardArcFromStartPose(
    startPose: BoatPose,
    delta: number,
    radius: number
): BoatArcSegment {
    const direction = delta >= 0 ? 'left' : 'right'
    const centerOffset =
        direction === 'left' ?
            { x: -Math.sin(startPose.heading) * radius, y: Math.cos(startPose.heading) * radius }
        :   { x: Math.sin(startPose.heading) * radius, y: -Math.cos(startPose.heading) * radius }
    const center = {
        x: startPose.x + centerOffset.x,
        y: startPose.y + centerOffset.y
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
        clockwise: direction === 'right'
    })
}

function createArcToEndPose(
    endPose: BoatPose,
    startHeading: number,
    delta: number,
    radius: number
): BoatMotionSegment {
    const direction = delta >= 0 ? 'left' : 'right'
    const centerOffset =
        direction === 'left' ?
            { x: -Math.sin(endPose.heading) * radius, y: Math.cos(endPose.heading) * radius }
        :   { x: Math.sin(endPose.heading) * radius, y: -Math.cos(endPose.heading) * radius }
    const center = {
        x: endPose.x + centerOffset.x,
        y: endPose.y + centerOffset.y
    }
    const startPose = {
        x:
            center.x -
            (direction === 'left' ? -Math.sin(startHeading) : Math.sin(startHeading)) * radius,
        y:
            center.y -
            (direction === 'left' ? Math.cos(startHeading) : -Math.cos(startHeading)) * radius,
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
        clockwise: direction === 'right'
    })
}

function heuristic(pose: BoatPose, goalPose: BoatPose): number {
    const distance = distanceBetween(pose, goalPose)
    const headingDelta = Math.abs(normalizeAngle(goalPose.heading - pose.heading))
    return distance + headingDelta * TURN_RADIUS * 0.5
}

function poseKey(pose: BoatPose): string {
    const xBucket = Math.round(pose.x / POSITION_BUCKET)
    const yBucket = Math.round(pose.y / POSITION_BUCKET)
    const headingBucket = Math.round(normalizeAngle(pose.heading) / HEADING_BUCKET)
    return `${xBucket}:${yBucket}:${headingBucket}`
}

function reconstructSegments(node: SearchNode, nodesById: Map<string, SearchNode>): BoatMotionSegment[] {
    const segments: BoatMotionSegment[] = []
    let current: SearchNode | undefined = node

    while (current?.incomingSegment) {
        segments.unshift(current.incomingSegment)
        current = current.parentId ? nodesById.get(current.parentId) : undefined
    }

    return segments
}

function buildGoalConnectionSegments(
    currentPose: BoatPose,
    goalPose: BoatPose,
    geometry: BoatNavigationGeometry,
    occupiedBoatPoses: BoatPose[]
): BoatMotionSegment[] | null {
    const headingDelta = Math.abs(normalizeAngle(goalPose.heading - currentPose.heading))
    if (headingDelta > GOAL_CONNECTION_HEADING_TOLERANCE) {
        return null
    }

    const dx = goalPose.x - currentPose.x
    const dy = goalPose.y - currentPose.y
    const distance = Math.hypot(dx, dy)
    if (distance > GOAL_DISTANCE) {
        return null
    }
    if (distance === 0) {
        return []
    }

    const travelBearing = Math.atan2(dy, dx)
    const alignmentDelta = Math.abs(normalizeAngle(travelBearing - currentPose.heading))
    if (alignmentDelta > GOAL_CONNECTION_ALIGNMENT_TOLERANCE) {
        return null
    }

    const connector = createStraightSegment(currentPose, goalPose, 'forward')
    return isSegmentCollisionFree(connector, geometry, occupiedBoatPoses) ? [connector] : null
}

function isReasonableProgress(startPose: BoatPose, endPose: BoatPose, goalPose: BoatPose): boolean {
    const startDistance = distanceBetween(startPose, goalPose)
    const endDistance = distanceBetween(endPose, goalPose)

    return endDistance <= startDistance + TURN_RADIUS * 0.75
}

function getSegmentTraversalCost(
    segment: BoatMotionSegment,
    geometry: BoatNavigationGeometry,
    occupiedBoatPoses: BoatPose[]
): number {
    let cost = segment.length

    if (segment.kind === 'arc') {
        cost += ARC_SEGMENT_PENALTY
    }

    let nearestClearance = Number.POSITIVE_INFINITY
    const occupiedBoatPolygons = occupiedBoatPoses.map((pose) =>
        getBoatFootprintPolygon(pose, geometry.boatWidth, geometry.boatHeight)
    )

    for (let distance = 0; distance <= segment.length; distance += COLLISION_SAMPLE_STEP) {
        const pose = sampleMotionPath([segment], distance)
        nearestClearance = Math.min(
            nearestClearance,
            getPoseClearance(pose, geometry, occupiedBoatPolygons)
        )
    }

    nearestClearance = Math.min(
        nearestClearance,
        getPoseClearance(segment.endPose, geometry, occupiedBoatPolygons)
    )

    if (nearestClearance < OBSTACLE_CLEARANCE_TARGET) {
        cost += (OBSTACLE_CLEARANCE_TARGET - nearestClearance) * OBSTACLE_PROXIMITY_WEIGHT
    }

    return cost
}

function isSegmentCollisionFree(
    segment: BoatMotionSegment,
    geometry: BoatNavigationGeometry,
    occupiedBoatPoses: BoatPose[]
): boolean {
    const occupiedPolygons = occupiedBoatPoses.map((pose) =>
        getBoatFootprintPolygon(pose, geometry.boatWidth, geometry.boatHeight)
    )

    for (let distance = 0; distance <= segment.length; distance += COLLISION_SAMPLE_STEP) {
        const pose = sampleMotionPath([segment], distance)
        if (!isPoseCollisionFree(pose, geometry, occupiedPolygons)) {
            return false
        }
    }

    return isPoseCollisionFree(segment.endPose, geometry, occupiedPolygons)
}

function isPoseCollisionFree(
    pose: BoatPose,
    geometry: BoatNavigationGeometry,
    occupiedBoatPolygons: Point[][]
): boolean {
    const boatPolygon = getBoatFootprintPolygon(pose, geometry.boatWidth, geometry.boatHeight)
    const boatBounds = getPolygonBounds(boatPolygon)

    if (
        boatBounds.minX < 0 ||
        boatBounds.minY < 0 ||
        boatBounds.maxX > geometry.boardWidth ||
        boatBounds.maxY > geometry.boardHeight
    ) {
        return false
    }

    for (const obstacle of geometry.obstacles) {
        const obstacleBounds = getPolygonBounds(obstacle.polygon)
        if (!boundsOverlap(boatBounds, obstacleBounds)) {
            continue
        }
        if (polygonsIntersect(boatPolygon, obstacle.polygon)) {
            return false
        }
    }

    for (const occupiedPolygon of occupiedBoatPolygons) {
        const occupiedBounds = getPolygonBounds(occupiedPolygon)
        if (!boundsOverlap(boatBounds, occupiedBounds)) {
            continue
        }
        if (polygonsIntersect(boatPolygon, occupiedPolygon)) {
            return false
        }
    }

    return true
}

function getPoseClearance(
    pose: BoatPose,
    geometry: BoatNavigationGeometry,
    occupiedBoatPolygons: Point[][]
): number {
    let nearest = Number.POSITIVE_INFINITY

    for (const obstacle of geometry.obstacles) {
        nearest = Math.min(nearest, distanceFromPointToPolygon(pose, obstacle.polygon))
    }

    for (const occupiedPolygon of occupiedBoatPolygons) {
        nearest = Math.min(nearest, distanceFromPointToPolygon(pose, occupiedPolygon))
    }

    return nearest
}
