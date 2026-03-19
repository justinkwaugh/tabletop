import type { Point } from '@tabletop/common'
import type { BoatNavigationGeometry, BoatPose, DockSlot } from '$lib/definitions/boatNavigation.js'
import { getBoatFootprintPolygon } from '$lib/definitions/boatNavigation.js'
import {
    type BoatArcSegment,
    createArcSegment,
    createStraightSegment,
    getMotionPathLength,
    normalizeAngle,
    sampleMotionPath,
    type BoatMotionSegment
} from '$lib/definitions/boatMotion.js'
import {
    boundsOverlap,
    distanceFromPointToPolygon,
    distanceBetween,
    getPolygonBounds,
    type PolygonBounds,
    polygonsIntersect
} from '$lib/definitions/geometry2d.js'

export type BoatRoutePlan = {
    undockSegments: BoatMotionSegment[]
    transitSegments: BoatMotionSegment[]
    dockSegments: BoatMotionSegment[]
    segments: BoatMotionSegment[]
}

export type BestDockTransferPlan = {
    endDock: DockSlot
    plan: BoatRoutePlan
    attempts: number
}

type DockGoal = {
    endDock: DockSlot
    candidate: DockManeuverCandidate
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
    straightApproachDistances: number[]
    turnRadius: number
}

type UndockManeuverCandidate = {
    transitPose: BoatPose
    maneuverSegments: BoatMotionSegment[]
    score: number
}

type DockManeuverCandidate = {
    heuristicPose: BoatPose
    estimateFrom: (pose: BoatPose) => number
    allowsPose: (pose: BoatPose) => boolean
    completeFrom: (
        currentPose: BoatPose,
        plannerContext: PlannerContext
    ) => BoatMotionSegment[] | null
    score: number
}

type PlannerObstacle = {
    polygon: Point[]
    bounds: PolygonBounds
}

type PlannerContext = {
    geometry: BoatNavigationGeometry
    obstacles: PlannerObstacle[]
    occupiedBoatPolygons: Point[][]
    occupiedBoatBounds: PolygonBounds[]
}

class SearchNodeHeap {
    private items: SearchNode[] = []

    get size(): number {
        return this.items.length
    }

    push(node: SearchNode): void {
        this.items.push(node)
        this.bubbleUp(this.items.length - 1)
    }

    pop(): SearchNode | undefined {
        if (this.items.length === 0) {
            return undefined
        }

        const first = this.items[0]
        const last = this.items.pop()!
        if (this.items.length > 0) {
            this.items[0] = last
            this.bubbleDown(0)
        }

        return first
    }

    private bubbleUp(index: number): void {
        let currentIndex = index
        while (currentIndex > 0) {
            const parentIndex = Math.floor((currentIndex - 1) / 2)
            if (this.items[parentIndex]!.estimate <= this.items[currentIndex]!.estimate) {
                break
            }

            ;[this.items[parentIndex], this.items[currentIndex]] = [
                this.items[currentIndex]!,
                this.items[parentIndex]!
            ]
            currentIndex = parentIndex
        }
    }

    private bubbleDown(index: number): void {
        let currentIndex = index

        while (true) {
            const leftIndex = currentIndex * 2 + 1
            const rightIndex = leftIndex + 1
            let smallestIndex = currentIndex

            if (
                leftIndex < this.items.length &&
                this.items[leftIndex]!.estimate < this.items[smallestIndex]!.estimate
            ) {
                smallestIndex = leftIndex
            }

            if (
                rightIndex < this.items.length &&
                this.items[rightIndex]!.estimate < this.items[smallestIndex]!.estimate
            ) {
                smallestIndex = rightIndex
            }

            if (smallestIndex === currentIndex) {
                return
            }

            ;[this.items[currentIndex], this.items[smallestIndex]] = [
                this.items[smallestIndex]!,
                this.items[currentIndex]!
            ]
            currentIndex = smallestIndex
        }
    }
}

const STRAIGHT_STEP = 72
const TURN_RADIUS = 118
const TURN_ANGLE = Math.PI / 6
const POSITION_BUCKET = 56
const HEADING_BUCKET = Math.PI / 8
const HEURISTIC_WEIGHT = 3
const GOAL_DISTANCE = 48
const GOAL_HEADING = Math.PI / 10
const MAX_SEARCH_ITERATIONS = 2500
const SEARCH_ITERATION_RETRY_MULTIPLIER = 2
const POST_GOAL_REFINEMENT_ITERATIONS = 250
const COLLISION_SAMPLE_STEP = 18
const CLEARANCE_SAMPLE_STEP = 54
const GOAL_CONNECTION_HEADING_TOLERANCE = Math.PI / 24
const GOAL_CONNECTION_ALIGNMENT_TOLERANCE = Math.PI / 18
const STRAIGHT_LANE_OVERSHOOT_ALLOWANCE = 36
const ARC_SEGMENT_PENALTY = 28
const OBSTACLE_CLEARANCE_TARGET = 120
const OBSTACLE_PROXIMITY_WEIGHT = 0.32
const DETOUR_PROGRESS_ALLOWANCE = TURN_RADIUS * 2.5
const DOCK_MANEUVER_CONFIG: Record<DockSlot['family'], DockManeuverConfig> = {
    'main-island-harbor': {
        undockReverseDistance: 100,
        undockReverseTurnRadius: 42,
        straightApproachDistances: [72, 120, 180],
        turnRadius: 132
    },
    'offshore-harbor': {
        undockReverseDistance: 100,
        undockReverseTurnRadius: 42,
        straightApproachDistances: [72, 120, 180],
        turnRadius: 132
    },
    'player-board': {
        undockReverseDistance: 52,
        undockReverseTurnRadius: 36,
        straightApproachDistances: [72, 120, 180],
        turnRadius: 118
    }
}

export function buildDockTransferPlan(
    startDock: DockSlot,
    endDock: DockSlot,
    geometry: BoatNavigationGeometry,
    occupiedBoatPoses: BoatPose[] = []
): BoatRoutePlan | null {
    const plannerContext = createPlannerContext(geometry, occupiedBoatPoses)
    return buildDockTransferPlanWithContext(
        startDock,
        endDock,
        plannerContext,
        buildUndockCandidates(startDock, endDock.stagingPose)
    )
}

export function buildBestDockTransferPlan(
    startDock: DockSlot,
    endDocks: DockSlot[],
    geometry: BoatNavigationGeometry,
    occupiedBoatPoses: BoatPose[] = []
): BestDockTransferPlan | null {
    const plannerContext = createPlannerContext(geometry, occupiedBoatPoses)
    const targetPose = getAveragePose(endDocks.map((dock) => dock.stagingPose))
    const undockCandidates = buildUndockCandidates(startDock, targetPose)

    for (const undockCandidate of undockCandidates) {
        const dockGoals = endDocks.flatMap((endDock) =>
            buildDockCandidates(endDock, undockCandidate.transitPose).map((candidate) => ({
                endDock,
                candidate
            }))
        )
        const dockConnection = planTransitSegmentsToAnyGoal(
            undockCandidate.transitPose,
            dockGoals,
            plannerContext
        )
        if (!dockConnection) {
            continue
        }

        const undockSegments = [
            createStraightSegment(startDock.dockedPose, startDock.stagingPose, 'reverse'),
            ...undockCandidate.maneuverSegments
        ]
        const dockSegments = [
            ...dockConnection.dockSegments,
            createStraightSegment(dockConnection.endDock.stagingPose, dockConnection.endDock.dockedPose, 'forward')
        ]

        return {
            endDock: dockConnection.endDock,
            attempts: endDocks.length,
            plan: {
                undockSegments,
                transitSegments: dockConnection.transitSegments,
                dockSegments,
                segments: [...undockSegments, ...dockConnection.transitSegments, ...dockSegments]
            }
        }
    }

    return null
}

function buildDockTransferPlanWithContext(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext,
    undockCandidates: UndockManeuverCandidate[]
): BoatRoutePlan | null {
    for (const undockCandidate of undockCandidates) {
        const dockCandidates = buildDockCandidates(endDock, undockCandidate.transitPose)

        for (const dockCandidate of dockCandidates) {
            const dockConnection = planTransitSegments(
                undockCandidate.transitPose,
                dockCandidate,
                plannerContext
            )
            if (!dockConnection) {
                continue
            }

            const undockSegments = [
                createStraightSegment(startDock.dockedPose, startDock.stagingPose, 'reverse'),
                ...undockCandidate.maneuverSegments
            ]
            const dockSegments = [
                ...dockConnection.dockSegments,
                createStraightSegment(endDock.stagingPose, endDock.dockedPose, 'forward')
            ]

            return {
                undockSegments,
                transitSegments: dockConnection.transitSegments,
                dockSegments,
                segments: [...undockSegments, ...dockConnection.transitSegments, ...dockSegments]
            }
        }
    }

    return null
}

function planTransitSegments(
    startPose: BoatPose,
    dockCandidate: DockManeuverCandidate,
    plannerContext: PlannerContext
): { transitSegments: BoatMotionSegment[]; dockSegments: BoatMotionSegment[] } | null {
    return (
        runTransitSearch(startPose, dockCandidate, plannerContext, MAX_SEARCH_ITERATIONS) ??
        runTransitSearch(
            startPose,
            dockCandidate,
            plannerContext,
            MAX_SEARCH_ITERATIONS * SEARCH_ITERATION_RETRY_MULTIPLIER
        )
    )
}

function planTransitSegmentsToAnyGoal(
    startPose: BoatPose,
    dockGoals: DockGoal[],
    plannerContext: PlannerContext
): { transitSegments: BoatMotionSegment[]; dockSegments: BoatMotionSegment[]; endDock: DockSlot } | null {
    return (
        runTransitSearchAnyGoal(startPose, dockGoals, plannerContext, MAX_SEARCH_ITERATIONS) ??
        runTransitSearchAnyGoal(
            startPose,
            dockGoals,
            plannerContext,
            MAX_SEARCH_ITERATIONS * SEARCH_ITERATION_RETRY_MULTIPLIER
        )
    )
}

function runTransitSearch(
    startPose: BoatPose,
    dockCandidate: DockManeuverCandidate,
    plannerContext: PlannerContext,
    maxIterations: number
): { transitSegments: BoatMotionSegment[]; dockSegments: BoatMotionSegment[] } | null {
    let nextNodeId = 0
    const startNode: SearchNode = {
        id: `node-${nextNodeId++}`,
        bucketKey: poseKey(startPose),
        pose: startPose,
        cost: 0,
        estimate: dockCandidate.estimateFrom(startPose) * HEURISTIC_WEIGHT
    }

    const open = new SearchNodeHeap()
    open.push(startNode)
    const bestByBucketKey = new Map([[startNode.bucketKey, startNode]])
    const nodesById = new Map([[startNode.id, startNode]])
    const closed = new Set<string>()

    for (let iteration = 0; iteration < maxIterations && open.size > 0; iteration += 1) {
        const current = open.pop()!

        if (closed.has(current.bucketKey)) {
            continue
        }
        closed.add(current.bucketKey)

        const goalConnection = dockCandidate.completeFrom(current.pose, plannerContext)
        if (goalConnection) {
            return {
                transitSegments: reconstructSegments(current, nodesById),
                dockSegments: goalConnection
            }
        }

        for (const segment of expandSegments(current.pose)) {
            if (!isReasonableProgress(current.pose, segment.endPose, dockCandidate)) {
                continue
            }
            if (!dockCandidate.allowsPose(segment.endPose)) {
                continue
            }

            const segmentAnalysis = analyzeSegment(segment, plannerContext)
            if (!segmentAnalysis.isCollisionFree) {
                continue
            }

            const nextPose = segment.endPose
            const bucketKey = poseKey(nextPose)
            if (closed.has(bucketKey)) {
                continue
            }

            const nextCost = current.cost + getSegmentTraversalCost(segment, segmentAnalysis)
            const previous = bestByBucketKey.get(bucketKey)
            if (previous && previous.cost <= nextCost) {
                continue
            }

            const nextNode: SearchNode = {
                id: `node-${nextNodeId++}`,
                bucketKey,
                pose: nextPose,
                cost: nextCost,
                estimate: nextCost + dockCandidate.estimateFrom(nextPose) * HEURISTIC_WEIGHT,
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

function runTransitSearchAnyGoal(
    startPose: BoatPose,
    dockGoals: DockGoal[],
    plannerContext: PlannerContext,
    maxIterations: number
): { transitSegments: BoatMotionSegment[]; dockSegments: BoatMotionSegment[]; endDock: DockSlot } | null {
    let nextNodeId = 0
    const startNode: SearchNode = {
        id: `node-${nextNodeId++}`,
        bucketKey: poseKey(startPose),
        pose: startPose,
        cost: 0,
        estimate: getBestGoalEstimate(startPose, dockGoals) * HEURISTIC_WEIGHT
    }

    const open = new SearchNodeHeap()
    open.push(startNode)
    const bestByBucketKey = new Map([[startNode.bucketKey, startNode]])
    const nodesById = new Map([[startNode.id, startNode]])
    const closed = new Set<string>()
    let bestGoal:
        | {
              transitSegments: BoatMotionSegment[]
              dockSegments: BoatMotionSegment[]
              endDock: DockSlot
              totalLength: number
          }
        | null = null
    let goalRefinementDeadline: number | null = null

    for (let iteration = 0; iteration < maxIterations && open.size > 0; iteration += 1) {
        if (goalRefinementDeadline !== null && iteration > goalRefinementDeadline) {
            break
        }

        const current = open.pop()!

        if (closed.has(current.bucketKey)) {
            continue
        }
        closed.add(current.bucketKey)

        const completedGoals = dockGoals
            .map((goal) => {
                const dockSegments = goal.candidate.completeFrom(current.pose, plannerContext)
                if (!dockSegments) {
                    return null
                }

                return {
                    endDock: goal.endDock,
                    dockSegments,
                    cost: getMotionPathLength(dockSegments)
                }
            })
            .filter((goal): goal is NonNullable<typeof goal> => !!goal)
            .sort((a, b) => a.cost - b.cost)

        const completedGoal = completedGoals[0]
        if (completedGoal) {
            const transitSegments = reconstructSegments(current, nodesById)
            const totalLength = getMotionPathLength([
                ...transitSegments,
                ...completedGoal.dockSegments
            ])

            if (!bestGoal || totalLength < bestGoal.totalLength) {
                bestGoal = {
                    transitSegments,
                    dockSegments: completedGoal.dockSegments,
                    endDock: completedGoal.endDock,
                    totalLength
                }
            }

            if (goalRefinementDeadline === null) {
                goalRefinementDeadline = iteration + POST_GOAL_REFINEMENT_ITERATIONS
            }
        }

        for (const segment of expandSegments(current.pose)) {
            if (!isReasonableProgressForAnyGoal(current.pose, segment.endPose, dockGoals)) {
                continue
            }
            if (!dockGoals.some((goal) => goal.candidate.allowsPose(segment.endPose))) {
                continue
            }

            const segmentAnalysis = analyzeSegment(segment, plannerContext)
            if (!segmentAnalysis.isCollisionFree) {
                continue
            }

            const nextPose = segment.endPose
            const bucketKey = poseKey(nextPose)
            if (closed.has(bucketKey)) {
                continue
            }

            const nextCost = current.cost + getSegmentTraversalCost(segment, segmentAnalysis)
            const previous = bestByBucketKey.get(bucketKey)
            if (previous && previous.cost <= nextCost) {
                continue
            }

            const nextNode: SearchNode = {
                id: `node-${nextNodeId++}`,
                bucketKey,
                pose: nextPose,
                cost: nextCost,
                estimate: nextCost + getBestGoalEstimate(nextPose, dockGoals) * HEURISTIC_WEIGHT,
                parentId: current.id,
                incomingSegment: segment
            }
            bestByBucketKey.set(bucketKey, nextNode)
            nodesById.set(nextNode.id, nextNode)
            open.push(nextNode)
        }
    }

    return bestGoal
        ? {
              transitSegments: bestGoal.transitSegments,
              dockSegments: bestGoal.dockSegments,
              endDock: bestGoal.endDock
          }
        : null
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
): UndockManeuverCandidate[] {
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
        candidates.slice(0, 1),
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
    const perpendicularCandidates = buildPerpendicularCandidates(
        dock.stagingPose.heading,
        preferredBearing
    )

    const validCandidates: DockManeuverCandidate[] = buildStraightInDockCandidates(
        dock,
        config,
        preferredBearing
    )

    for (const candidateHeading of perpendicularCandidates) {
        const arcSegment = createArcToEndPose(
            dock.stagingPose,
            candidateHeading.heading,
            normalizeAngle(dock.stagingPose.heading - candidateHeading.heading),
            config.turnRadius
        )

        validCandidates.push({
            heuristicPose: arcSegment.startPose,
            estimateFrom: (pose) => heuristic(pose, arcSegment.startPose),
            allowsPose: () => true,
            completeFrom: (currentPose, plannerContext) => {
                const connector = buildPoseGoalConnectionSegments(
                    currentPose,
                    arcSegment.startPose,
                    plannerContext
                )
                return connector ? [...connector, arcSegment] : null
            },
            score: candidateHeading.score
        })
    }

    return validCandidates.sort((a, b) => a.score - b.score)
}

function buildStraightInDockCandidates(
    dock: DockSlot,
    config: DockManeuverConfig,
    preferredBearing: number
): DockManeuverCandidate[] {
    const alignmentScore = Math.abs(normalizeAngle(preferredBearing - dock.stagingPose.heading))
    const laneHintDistance = Math.max(...config.straightApproachDistances)
    const laneHintPose = {
        x: dock.stagingPose.x - Math.cos(dock.stagingPose.heading) * laneHintDistance,
        y: dock.stagingPose.y - Math.sin(dock.stagingPose.heading) * laneHintDistance,
        heading: dock.stagingPose.heading
    }

    return [
        {
            heuristicPose: laneHintPose,
            estimateFrom: (pose) => estimateStraightLaneHeuristic(pose, dock.stagingPose),
            allowsPose: (pose) => allowsStraightLanePose(pose, dock.stagingPose),
            completeFrom: (currentPose, plannerContext) =>
                buildStraightInGoalConnectionSegments(currentPose, dock.stagingPose, plannerContext),
            score: alignmentScore
        }
    ]
}

function buildReverseThenTurnCandidates(
    startPose: BoatPose,
    headingCandidates: Array<{ heading: number; score: number }>,
    config: DockManeuverConfig
): UndockManeuverCandidate[] {
    const candidates: UndockManeuverCandidate[] = []

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

function buildPoseGoalConnectionSegments(
    currentPose: BoatPose,
    goalPose: BoatPose,
    plannerContext: PlannerContext
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
    return analyzeSegment(connector, plannerContext).isCollisionFree ? [connector] : null
}

function buildStraightInGoalConnectionSegments(
    currentPose: BoatPose,
    stagingPose: BoatPose,
    plannerContext: PlannerContext
): BoatMotionSegment[] | null {
    const headingDelta = Math.abs(normalizeAngle(stagingPose.heading - currentPose.heading))
    if (headingDelta > GOAL_CONNECTION_HEADING_TOLERANCE) {
        return null
    }

    const dx = stagingPose.x - currentPose.x
    const dy = stagingPose.y - currentPose.y
    const distance = Math.hypot(dx, dy)
    if (distance === 0) {
        return []
    }

    const travelBearing = Math.atan2(dy, dx)
    const alignmentDelta = Math.abs(normalizeAngle(travelBearing - currentPose.heading))
    if (alignmentDelta > GOAL_CONNECTION_ALIGNMENT_TOLERANCE) {
        return null
    }

    const connector = createStraightSegment(currentPose, stagingPose, 'forward')
    return analyzeSegment(connector, plannerContext).isCollisionFree ? [connector] : null
}

function estimateStraightLaneHeuristic(pose: BoatPose, stagingPose: BoatPose): number {
    const { along, lateral } = getStraightLaneMetrics(pose, stagingPose)
    const headingDelta = Math.abs(normalizeAngle(stagingPose.heading - pose.heading))
    const overshootPenalty =
        along >= 0 ? 0 : Math.abs(along) * 4 + STRAIGHT_LANE_OVERSHOOT_ALLOWANCE * 8

    return (
        Math.max(along, 0) +
        lateral * 2.5 +
        headingDelta * TURN_RADIUS * 0.75 +
        overshootPenalty
    )
}

function getBestGoalEstimate(pose: BoatPose, dockGoals: DockGoal[]): number {
    return Math.min(...dockGoals.map((goal) => goal.candidate.estimateFrom(pose)))
}

function isReasonableProgressForAnyGoal(
    startPose: BoatPose,
    endPose: BoatPose,
    dockGoals: DockGoal[]
): boolean {
    const startDistance = getBestGoalEstimate(startPose, dockGoals)
    const endDistance = getBestGoalEstimate(endPose, dockGoals)

    return endDistance <= startDistance + DETOUR_PROGRESS_ALLOWANCE
}

function getAveragePose(poses: BoatPose[]): BoatPose {
    const total = poses.reduce(
        (accumulator, pose) => ({
            x: accumulator.x + pose.x,
            y: accumulator.y + pose.y,
            headingX: accumulator.headingX + Math.cos(pose.heading),
            headingY: accumulator.headingY + Math.sin(pose.heading)
        }),
        { x: 0, y: 0, headingX: 0, headingY: 0 }
    )

    return {
        x: total.x / poses.length,
        y: total.y / poses.length,
        heading: Math.atan2(total.headingY, total.headingX)
    }
}

function allowsStraightLanePose(pose: BoatPose, stagingPose: BoatPose): boolean {
    const { along } = getStraightLaneMetrics(pose, stagingPose)
    return along >= -STRAIGHT_LANE_OVERSHOOT_ALLOWANCE
}

function getStraightLaneMetrics(
    pose: BoatPose,
    stagingPose: BoatPose
): { along: number; lateral: number } {
    const dx = stagingPose.x - pose.x
    const dy = stagingPose.y - pose.y
    const axisX = Math.cos(stagingPose.heading)
    const axisY = Math.sin(stagingPose.heading)
    const perpX = -axisY
    const perpY = axisX

    return {
        along: dx * axisX + dy * axisY,
        lateral: Math.abs(dx * perpX + dy * perpY)
    }
}

function isReasonableProgress(
    startPose: BoatPose,
    endPose: BoatPose,
    dockCandidate: DockManeuverCandidate
): boolean {
    const startDistance = dockCandidate.estimateFrom(startPose)
    const endDistance = dockCandidate.estimateFrom(endPose)

    return endDistance <= startDistance + DETOUR_PROGRESS_ALLOWANCE
}

function getSegmentTraversalCost(
    segment: BoatMotionSegment,
    analysis: SegmentAnalysis
): number {
    let cost = segment.length

    if (segment.kind === 'arc') {
        cost += ARC_SEGMENT_PENALTY
    }

    const nearestClearance = analysis.nearestClearance

    if (nearestClearance < OBSTACLE_CLEARANCE_TARGET) {
        cost += (OBSTACLE_CLEARANCE_TARGET - nearestClearance) * OBSTACLE_PROXIMITY_WEIGHT
    }

    return cost
}

type SegmentAnalysis = {
    isCollisionFree: boolean
    nearestClearance: number
}

function analyzeSegment(
    segment: BoatMotionSegment,
    plannerContext: PlannerContext
): SegmentAnalysis {
    let nearestClearance = Number.POSITIVE_INFINITY
    const clearanceStep = Math.max(COLLISION_SAMPLE_STEP, CLEARANCE_SAMPLE_STEP)
    for (let distance = 0; distance <= segment.length; distance += COLLISION_SAMPLE_STEP) {
        const pose = sampleMotionPath([segment], distance)
        const poseAnalysis = analyzePose(pose, plannerContext)
        if (!poseAnalysis.isCollisionFree) {
            return {
                isCollisionFree: false,
                nearestClearance: 0
            }
        }
        if (distance === 0 || distance >= segment.length || distance % clearanceStep === 0) {
            nearestClearance = Math.min(nearestClearance, poseAnalysis.clearance)
        }
    }

    const endPoseAnalysis = analyzePose(segment.endPose, plannerContext)
    if (!endPoseAnalysis.isCollisionFree) {
        return {
            isCollisionFree: false,
            nearestClearance: 0
        }
    }

    return {
        isCollisionFree: true,
        nearestClearance: Math.min(nearestClearance, endPoseAnalysis.clearance)
    }
}

function analyzePose(
    pose: BoatPose,
    plannerContext: PlannerContext
): { isCollisionFree: boolean; clearance: number } {
    const { geometry, obstacles, occupiedBoatPolygons, occupiedBoatBounds } = plannerContext
    const boatPolygon = getBoatFootprintPolygon(pose, geometry.boatWidth, geometry.boatHeight)
    const boatBounds = getPolygonBounds(boatPolygon)

    if (
        boatBounds.minX < 0 ||
        boatBounds.minY < 0 ||
        boatBounds.maxX > geometry.boardWidth ||
        boatBounds.maxY > geometry.boardHeight
    ) {
        return {
            isCollisionFree: false,
            clearance: 0
        }
    }

    for (const obstacle of obstacles) {
        if (!boundsOverlap(boatBounds, obstacle.bounds)) {
            continue
        }
        if (polygonsIntersect(boatPolygon, obstacle.polygon)) {
            return {
                isCollisionFree: false,
                clearance: 0
            }
        }
    }

    for (const [index, occupiedPolygon] of occupiedBoatPolygons.entries()) {
        if (!boundsOverlap(boatBounds, occupiedBoatBounds[index]!)) {
            continue
        }
        if (polygonsIntersect(boatPolygon, occupiedPolygon)) {
            return {
                isCollisionFree: false,
                clearance: 0
            }
        }
    }

    let nearest = Number.POSITIVE_INFINITY

    for (const obstacle of obstacles) {
        nearest = Math.min(nearest, distanceFromPointToPolygon(pose, obstacle.polygon))
    }

    for (const occupiedPolygon of occupiedBoatPolygons) {
        nearest = Math.min(nearest, distanceFromPointToPolygon(pose, occupiedPolygon))
    }

    return {
        isCollisionFree: true,
        clearance: nearest
    }
}

function createPlannerContext(
    geometry: BoatNavigationGeometry,
    occupiedBoatPoses: BoatPose[]
): PlannerContext {
    const occupiedBoatPolygons = occupiedBoatPoses.map((pose) =>
        getBoatFootprintPolygon(pose, geometry.boatWidth, geometry.boatHeight)
    )

    return {
        geometry,
        obstacles: geometry.obstacles.map((obstacle) => ({
            polygon: obstacle.polygon,
            bounds: getPolygonBounds(obstacle.polygon)
        })),
        occupiedBoatPolygons,
        occupiedBoatBounds: occupiedBoatPolygons.map(getPolygonBounds)
    }
}
