import type { Point } from '@tabletop/common'
import type { BoatNavigationGeometry, BoatPose, DockSlot } from '$lib/definitions/boatNavigation.js'
import {
    getBoatFootprintPolygon,
    getMovingBoatFootprintPolygon
} from '$lib/definitions/boatNavigation.js'
import {
    type BoatArcSegment,
    createArcSegment,
    createPivotSegment,
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
    id: string
    polygon: Point[]
    bounds: PolygonBounds
}

type PlannerContext = {
    geometry: BoatNavigationGeometry
    obstacles: PlannerObstacle[]
    occupiedBoatPolygons: Point[][]
    occupiedBoatBounds: PolygonBounds[]
}

type SearchBucketConfig = {
    positionBucket: number
    headingBucket: number
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
const FINE_STRAIGHT_STEP = 36
const FINE_TURN_ANGLE = Math.PI / 12
const DEFAULT_SEARCH_BUCKETS: SearchBucketConfig = {
    positionBucket: 56,
    headingBucket: Math.PI / 8
}
const EXACT_DOCK_SEARCH_BUCKETS: SearchBucketConfig = {
    positionBucket: 24,
    headingBucket: Math.PI / 12
}
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
const GOAL_REFINEMENT_THRESHOLD = 220
const STRAIGHT_LANE_OVERSHOOT_ALLOWANCE = 36
const ARC_SEGMENT_PENALTY = 28
const PIVOT_SEGMENT_PENALTY = 18
const OBSTACLE_CLEARANCE_TARGET = 120
const OBSTACLE_PROXIMITY_WEIGHT = 0.32
const DETOUR_PROGRESS_ALLOWANCE = TURN_RADIUS * 2.5
const HARBOR_K_TURN_SETUP_DISTANCE = 220
const HARBOR_K_TURN_LATERAL_OFFSET = 108
const HARBOR_K_TURN_REENTRY_DISTANCE = 132
const HARBOR_K_TURN_PIVOT_SCALE = 42
const FOUR_PLAYER_MAIN_HARBOR_CHANNEL_OFFSET_X = 150
const FOUR_PLAYER_MAIN_HARBOR_CHANNEL_OFFSET_Y = 70
const FOUR_PLAYER_MAIN_HARBOR_ARC_RADIUS = 84
const FOUR_PLAYER_TOP_HARBOR_CHANNEL_Y = 220
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

    let bestPlan: BestDockTransferPlan | null = null

    for (const undockCandidate of undockCandidates) {
        const dockConnection = findBestDockConnectionForGoals(
            undockCandidate.transitPose,
            endDocks,
            plannerContext
        )
        if (!dockConnection) continue

        const undockSegments = [
            createStraightSegment(startDock.dockedPose, startDock.stagingPose, 'reverse'),
            ...undockCandidate.maneuverSegments
        ]
        const dockSegments = [
            ...dockConnection.dockSegments,
            createStraightSegment(dockConnection.endDock.stagingPose, dockConnection.endDock.dockedPose, 'forward')
        ]

        const candidatePlan: BestDockTransferPlan = {
            endDock: dockConnection.endDock,
            attempts: endDocks.length,
            plan: {
                undockSegments,
                transitSegments: dockConnection.transitSegments,
                dockSegments,
                segments: [...undockSegments, ...dockConnection.transitSegments, ...dockSegments]
            }
        }

        if (
            !bestPlan ||
            getMotionPathLength(candidatePlan.plan.segments) <
                getMotionPathLength(bestPlan.plan.segments)
        ) {
            bestPlan = candidatePlan
        }
    }

    return bestPlan
}

function buildDockTransferPlanWithContext(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext,
    undockCandidates: UndockManeuverCandidate[]
): BoatRoutePlan | null {
    let bestPlan: BoatRoutePlan | null = null

    for (const undockCandidate of undockCandidates) {
        const dockConnection = findExactDockConnection(
            undockCandidate.transitPose,
            endDock,
            plannerContext
        )
        if (!dockConnection) continue

        const undockSegments = [
            createStraightSegment(startDock.dockedPose, startDock.stagingPose, 'reverse'),
            ...undockCandidate.maneuverSegments
        ]
        const dockSegments = [
            ...dockConnection.dockSegments,
            createStraightSegment(endDock.stagingPose, endDock.dockedPose, 'forward')
        ]

        const candidatePlan: BoatRoutePlan = {
            undockSegments,
            transitSegments: dockConnection.transitSegments,
            dockSegments,
            segments: [...undockSegments, ...dockConnection.transitSegments, ...dockSegments]
        }

        if (
            !bestPlan ||
            getMotionPathLength(candidatePlan.segments) < getMotionPathLength(bestPlan.segments)
        ) {
            bestPlan = candidatePlan
        }
    }

    return bestPlan
}

function findBestDockConnectionForGoals(
    startPose: BoatPose,
    endDocks: DockSlot[],
    plannerContext: PlannerContext
): { transitSegments: BoatMotionSegment[]; dockSegments: BoatMotionSegment[]; endDock: DockSlot } | null {
    const standardGoals = endDocks.flatMap((endDock) =>
        buildDockCandidates(endDock, startPose).map((candidate) => ({
            endDock,
            candidate
        }))
    )
    const standardConnection = planTransitSegmentsToAnyGoal(
        startPose,
        standardGoals,
        plannerContext
    )
    if (standardConnection) {
        return standardConnection
    }

    const fallbackGoals = endDocks.flatMap((endDock) =>
        buildDockCandidates(endDock, startPose, {
            useHarborKTurn: endDock.family === 'main-island-harbor'
        }).map((candidate) => ({
            endDock,
            candidate
        }))
    )

    return planTransitSegmentsToAnyGoal(startPose, fallbackGoals, plannerContext)
}

function findExactDockConnection(
    startPose: BoatPose,
    endDock: DockSlot,
    plannerContext: PlannerContext
): { transitSegments: BoatMotionSegment[]; dockSegments: BoatMotionSegment[]; endDock: DockSlot } | null {
    const standardGoals = buildDockCandidates(endDock, startPose).map((candidate) => ({
        endDock,
        candidate
    }))
    const standardConnection = planTransitSegmentsToAnyGoal(
        startPose,
        standardGoals,
        plannerContext,
        {
            enforceReasonableProgress: false,
            searchBuckets: EXACT_DOCK_SEARCH_BUCKETS
        }
    )
    if (standardConnection) {
        return standardConnection
    }

    if (endDock.family !== 'main-island-harbor') {
        return null
    }

    const fallbackGoals = buildDockCandidates(endDock, startPose, {
        useHarborKTurn: true
    }).map((candidate) => ({
        endDock,
        candidate
    }))

    return planTransitSegmentsToAnyGoal(startPose, fallbackGoals, plannerContext, {
        enforceReasonableProgress: false,
        searchBuckets: EXACT_DOCK_SEARCH_BUCKETS
    })
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
    plannerContext: PlannerContext,
    options: {
        enforceReasonableProgress?: boolean
        searchBuckets?: SearchBucketConfig
    } = {}
): { transitSegments: BoatMotionSegment[]; dockSegments: BoatMotionSegment[]; endDock: DockSlot } | null {
    const {
        enforceReasonableProgress = true,
        searchBuckets = DEFAULT_SEARCH_BUCKETS
    } = options
    return (
        runTransitSearchAnyGoal(
            startPose,
            dockGoals,
            plannerContext,
            MAX_SEARCH_ITERATIONS,
            enforceReasonableProgress,
            searchBuckets
        ) ??
        runTransitSearchAnyGoal(
            startPose,
            dockGoals,
            plannerContext,
            MAX_SEARCH_ITERATIONS * SEARCH_ITERATION_RETRY_MULTIPLIER,
            enforceReasonableProgress,
            searchBuckets
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

        for (const segment of expandSegments(
            current.pose,
            dockCandidate.estimateFrom(current.pose) <= GOAL_REFINEMENT_THRESHOLD
        )) {
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
    maxIterations: number,
    enforceReasonableProgress: boolean,
    searchBuckets: SearchBucketConfig
): { transitSegments: BoatMotionSegment[]; dockSegments: BoatMotionSegment[]; endDock: DockSlot } | null {
    let nextNodeId = 0
    const startNode: SearchNode = {
        id: `node-${nextNodeId++}`,
        bucketKey: poseKey(startPose, searchBuckets),
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

        for (const segment of expandSegments(
            current.pose,
            getBestGoalEstimate(current.pose, dockGoals) <= GOAL_REFINEMENT_THRESHOLD
        )) {
            if (
                enforceReasonableProgress &&
                !isReasonableProgressForAnyGoal(current.pose, segment.endPose, dockGoals)
            ) {
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
            const bucketKey = poseKey(nextPose, searchBuckets)
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

function expandSegments(pose: BoatPose, useFineMotions: boolean): BoatMotionSegment[] {
    const segments = [
        createForwardStraightSegment(pose, STRAIGHT_STEP),
        createTurnSegment(pose, 'left', TURN_ANGLE),
        createTurnSegment(pose, 'right', TURN_ANGLE)
    ]

    if (useFineMotions) {
        segments.push(
            createForwardStraightSegment(pose, FINE_STRAIGHT_STEP),
            createTurnSegment(pose, 'left', FINE_TURN_ANGLE),
            createTurnSegment(pose, 'right', FINE_TURN_ANGLE)
        )
    }

    return segments
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

    return buildReverseThenTurnCandidates(dock.stagingPose, targetPose, candidates, config)
}

function buildDockCandidates(
    dock: DockSlot,
    sourcePose: BoatPose,
    options: {
        useHarborKTurn?: boolean
    } = {}
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

    if (options.useHarborKTurn) {
        validCandidates.push(
            ...buildHarborKTurnDockCandidates(dock, preferredBearing)
        )
    }

    for (const candidateHeading of perpendicularCandidates) {
        const arcSegment = createArcToEndPose(
            dock.stagingPose,
            candidateHeading.heading,
            normalizeAngle(dock.stagingPose.heading - candidateHeading.heading),
            config.turnRadius
        )

        validCandidates.push({
            heuristicPose: arcSegment.startPose,
            estimateFrom: (pose) =>
                estimateLaneHeuristic(pose, arcSegment.startPose, candidateHeading.heading),
            allowsPose: (pose) =>
                allowsLanePose(pose, arcSegment.startPose, candidateHeading.heading),
            completeFrom: (currentPose, plannerContext) => {
                const connector = buildLaneGoalConnectionSegments(
                    currentPose,
                    arcSegment.startPose,
                    candidateHeading.heading,
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
    return config.straightApproachDistances.map((approachDistance, index) => {
        const approachPose = {
            x: dock.stagingPose.x - Math.cos(dock.stagingPose.heading) * approachDistance,
            y: dock.stagingPose.y - Math.sin(dock.stagingPose.heading) * approachDistance,
            heading: dock.stagingPose.heading
        }

        return {
            heuristicPose: approachPose,
            estimateFrom: (pose) => estimateStraightLaneHeuristic(pose, approachPose),
            allowsPose: () => true,
            completeFrom: (currentPose, plannerContext) => {
                const connector = buildStraightInGoalConnectionSegments(
                    currentPose,
                    approachPose,
                    plannerContext
                )
                if (!connector) {
                    return null
                }

                const approachToStaging = createStraightSegment(
                    approachPose,
                    dock.stagingPose,
                    'forward'
                )
                if (!analyzeSegment(approachToStaging, plannerContext).isCollisionFree) {
                    return null
                }

                return [...connector, approachToStaging]
            },
            score: alignmentScore + index * 0.01
        }
    })
}

function buildHarborKTurnDockCandidates(
    dock: DockSlot,
    preferredBearing: number
): DockManeuverCandidate[] {
    const perpendicularCandidates = buildPerpendicularCandidates(
        dock.stagingPose.heading,
        preferredBearing
    )

    return perpendicularCandidates.flatMap((candidateHeading, headingIndex) =>
        [HARBOR_K_TURN_REENTRY_DISTANCE, ...DOCK_MANEUVER_CONFIG[dock.family].straightApproachDistances].map(
            (approachDistance, distanceIndex) => {
                const approachPose: BoatPose = {
                    x: dock.stagingPose.x - Math.cos(dock.stagingPose.heading) * approachDistance,
                    y: dock.stagingPose.y - Math.sin(dock.stagingPose.heading) * approachDistance,
                    heading: dock.stagingPose.heading
                }
                const reverseArc = createReverseArcToEndPose(
                    approachPose,
                    candidateHeading.heading,
                    normalizeAngle(approachPose.heading - candidateHeading.heading),
                    HARBOR_K_TURN_LATERAL_OFFSET
                )
                const finalStraight = createStraightSegment(
                    approachPose,
                    dock.stagingPose,
                    'forward'
                )

                return {
                    heuristicPose: reverseArc.startPose,
                    estimateFrom: (pose: BoatPose) =>
                        estimateLaneHeuristic(
                            pose,
                            reverseArc.startPose,
                            candidateHeading.heading
                        ),
                    allowsPose: (pose: BoatPose) =>
                        allowsLanePose(pose, reverseArc.startPose, candidateHeading.heading),
                    completeFrom: (currentPose: BoatPose, plannerContext: PlannerContext) => {
                        const connector = buildLaneGoalConnectionSegments(
                            currentPose,
                            reverseArc.startPose,
                            candidateHeading.heading,
                            plannerContext
                        )
                        if (!connector) {
                            return null
                        }

                        const localSegments = [reverseArc, finalStraight]
                        if (
                            !localSegments.every(
                                (segment) => analyzeSegment(segment, plannerContext).isCollisionFree
                            )
                        ) {
                            return null
                        }

                        return [...connector, ...localSegments]
                    },
                    score:
                        candidateHeading.score +
                        0.2 +
                        headingIndex * 0.02 +
                        distanceIndex * 0.01
                }
            }
        )
    )
}

function shouldUseFourPlayerNoOffshoreMainHarborBypass(
    geometry: BoatNavigationGeometry,
    startDock: DockSlot,
    endDock: DockSlot
): boolean {
    return (
        geometry.playerBoardDockSlots.length === 16 &&
        geometry.offshoreDockSlots.length === 0 &&
        startDock.family === 'player-board' &&
        endDock.family === 'main-island-harbor'
    )
}

function buildFourPlayerNoOffshoreMainHarborBypassPlan(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext,
    undockCandidates: UndockManeuverCandidate[]
): BoatRoutePlan | null {
    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!mainIslandObstacle) {
        return null
    }

    const bypassOrders = ['top'] as const

    for (const bypassSide of bypassOrders) {
        const deterministicBypass = buildDeterministicMainHarborBypassSegments(
            startDock,
            endDock,
            plannerContext,
            undockCandidates,
            bypassSide,
            mainIslandObstacle.bounds
        )
        if (deterministicBypass) {
            return deterministicBypass
        }
    }

    return null
}

function buildMainHarborBypassDockSegments(
    channelPose: BoatPose,
    stagingPose: BoatPose,
    bypassSide: 'top' | 'bottom',
    plannerContext: PlannerContext
): BoatMotionSegment[] | null {
    const verticalHeading = bypassSide === 'top' ? Math.PI / 2 : -Math.PI / 2
    const firstArc = createReverseArcFromStartPose(
        channelPose,
        normalizeAngle(verticalHeading - channelPose.heading),
        FOUR_PLAYER_MAIN_HARBOR_ARC_RADIUS
    )
    const verticalPose: BoatPose = {
        x: firstArc.endPose.x,
        y: stagingPose.y,
        heading: verticalHeading
    }
    const verticalSegment = createStraightSegment(firstArc.endPose, verticalPose, 'forward')
    const secondArc = createForwardArcFromStartPose(
        verticalPose,
        normalizeAngle(stagingPose.heading - verticalHeading),
        FOUR_PLAYER_MAIN_HARBOR_ARC_RADIUS
    )
    const finalApproach = createStraightSegment(secondArc.endPose, stagingPose, 'forward')
    const segments = [firstArc, verticalSegment, secondArc, finalApproach]

    for (const [index, segment] of segments.entries()) {
        const analysis = analyzeSegment(segment, plannerContext)
        if (!analysis.isCollisionFree) {
            return null
        }
    }

    return segments
}

function buildDeterministicMainHarborBypassSegments(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext,
    undockCandidates: UndockManeuverCandidate[],
    bypassSide: 'top' | 'bottom',
    islandBounds: PolygonBounds
): BoatRoutePlan | null {
    const desiredVerticalHeading = bypassSide === 'top' ? -Math.PI / 2 : Math.PI / 2
    const matchingCandidates = undockCandidates.filter(
        (candidate) =>
            Math.abs(normalizeAngle(candidate.transitPose.heading - desiredVerticalHeading)) <
            Math.PI / 6
    )

    for (const undockCandidate of matchingCandidates) {
        const verticalPose: BoatPose = {
            x: undockCandidate.transitPose.x,
            y:
                bypassSide === 'top'
                    ? FOUR_PLAYER_TOP_HARBOR_CHANNEL_Y
                    : islandBounds.maxY + FOUR_PLAYER_MAIN_HARBOR_CHANNEL_OFFSET_Y,
            heading: desiredVerticalHeading
        }
        const verticalSegment = createStraightSegment(
            undockCandidate.transitPose,
            verticalPose,
            'forward'
        )

        const arcToChannel = createForwardArcFromStartPose(
            verticalPose,
            normalizeAngle(0 - verticalPose.heading),
            FOUR_PLAYER_MAIN_HARBOR_ARC_RADIUS
        )
        const channelPose: BoatPose = {
            x: islandBounds.maxX + FOUR_PLAYER_MAIN_HARBOR_CHANNEL_OFFSET_X,
            y: arcToChannel.endPose.y,
            heading: 0
        }
        const channelSegment = createStraightSegment(
            arcToChannel.endPose,
            channelPose,
            'forward'
        )
        const bypassTransitSegments = [
            verticalSegment,
            arcToChannel,
            channelSegment
        ]

        const bypassFailureIndex = bypassTransitSegments.findIndex(
            (segment) => !analyzeSegment(segment, plannerContext).isCollisionFree
        )
        if (bypassFailureIndex >= 0) {
            continue
        }

        const dockGoals = buildDockCandidates(endDock, channelPose, {
            useHarborKTurn: true
        }).map((candidate) => ({
            endDock,
            candidate
        }))
        const dockConnection = planTransitSegmentsToAnyGoal(
            channelPose,
            dockGoals,
            plannerContext,
            {
                enforceReasonableProgress: false,
                searchBuckets: EXACT_DOCK_SEARCH_BUCKETS
            }
        )
        const harborFallbackSegments =
            dockConnection ?
                null
            :   buildMainHarborBypassDockSegments(
                    channelPose,
                    endDock.stagingPose,
                    bypassSide,
                    plannerContext
                )
        if (!dockConnection && !harborFallbackSegments) {
            continue
        }

        const undockSegments = [
            createStraightSegment(startDock.dockedPose, startDock.stagingPose, 'reverse'),
            ...undockCandidate.maneuverSegments
        ]
        const finalDockSegment = createStraightSegment(
            endDock.stagingPose,
            endDock.dockedPose,
            'forward'
        )

        return {
            undockSegments,
            transitSegments: [
                ...bypassTransitSegments,
                ...(dockConnection?.transitSegments ?? [])
            ],
            dockSegments: [
                ...(dockConnection?.dockSegments ?? harborFallbackSegments ?? []),
                finalDockSegment
            ],
            segments: [
                ...undockSegments,
                ...bypassTransitSegments,
                ...(dockConnection?.transitSegments ?? []),
                ...(dockConnection?.dockSegments ?? harborFallbackSegments ?? []),
                finalDockSegment
            ]
        }
    }

    return null
}

function buildReverseThenTurnCandidates(
    startPose: BoatPose,
    targetPose: BoatPose,
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
        const transitPose = reverseTurnSegment.endPose

        candidates.push({
            transitPose,
            maneuverSegments: [reverseSegment, reverseTurnSegment],
            score:
                heuristic(transitPose, targetPose) +
                headingCandidate.score * config.undockReverseTurnRadius * 0.5
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

function buildLateralCandidates(
    dockPose: BoatPose,
    preferredBearing: number
): Array<{ perpX: number; perpY: number; score: number }> {
    const axisX = Math.cos(dockPose.heading)
    const axisY = Math.sin(dockPose.heading)
    const candidates = [
        { perpX: -axisY, perpY: axisX },
        { perpX: axisY, perpY: -axisX }
    ]

    return candidates
        .map((candidate) => {
            const candidateBearing = Math.atan2(candidate.perpY, candidate.perpX)
            return {
                ...candidate,
                score: Math.abs(normalizeAngle(preferredBearing - candidateBearing))
            }
        })
        .sort((a, b) => a.score - b.score)
}

function createForwardStraightSegment(startPose: BoatPose, step: number): BoatMotionSegment {
    return createStraightSegment(
        startPose,
        {
            x: startPose.x + Math.cos(startPose.heading) * step,
            y: startPose.y + Math.sin(startPose.heading) * step,
            heading: startPose.heading
        },
        'forward'
    )
}

function createTurnSegment(
    startPose: BoatPose,
    direction: 'left' | 'right',
    angle: number
): BoatMotionSegment {
    const centerOffset =
        direction === 'left'
            ? { x: -Math.sin(startPose.heading) * TURN_RADIUS, y: Math.cos(startPose.heading) * TURN_RADIUS }
            : { x: Math.sin(startPose.heading) * TURN_RADIUS, y: -Math.cos(startPose.heading) * TURN_RADIUS }

    const center = {
        x: startPose.x + centerOffset.x,
        y: startPose.y + centerOffset.y
    }
    const startAngle = Math.atan2(startPose.y - center.y, startPose.x - center.x)
    const signedTurn = direction === 'left' ? angle : -angle
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
): BoatArcSegment {
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

function heuristic(pose: BoatPose, goalPose: BoatPose): number {
    const distance = distanceBetween(pose, goalPose)
    const headingDelta = Math.abs(normalizeAngle(goalPose.heading - pose.heading))
    return distance + headingDelta * TURN_RADIUS * 0.5
}

function poseKey(
    pose: BoatPose,
    bucketConfig: SearchBucketConfig = DEFAULT_SEARCH_BUCKETS
): string {
    const xBucket = Math.round(pose.x / bucketConfig.positionBucket)
    const yBucket = Math.round(pose.y / bucketConfig.positionBucket)
    const headingBucket = Math.round(normalizeAngle(pose.heading) / bucketConfig.headingBucket)
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
    return buildLaneGoalConnectionSegments(
        currentPose,
        stagingPose,
        stagingPose.heading,
        plannerContext
    )
}

function buildLaneGoalConnectionSegments(
    currentPose: BoatPose,
    goalPose: BoatPose,
    laneHeading: number,
    plannerContext: PlannerContext
): BoatMotionSegment[] | null {
    const headingDelta = Math.abs(normalizeAngle(laneHeading - currentPose.heading))
    if (headingDelta > GOAL_CONNECTION_HEADING_TOLERANCE) {
        return null
    }

    const dx = goalPose.x - currentPose.x
    const dy = goalPose.y - currentPose.y
    const distance = Math.hypot(dx, dy)
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

function estimateStraightLaneHeuristic(pose: BoatPose, stagingPose: BoatPose): number {
    return estimateLaneHeuristic(pose, stagingPose, stagingPose.heading)
}

function estimateLaneHeuristic(pose: BoatPose, goalPose: BoatPose, laneHeading: number): number {
    const { along, lateral } = getLaneMetrics(pose, goalPose, laneHeading)
    const headingDelta = Math.abs(normalizeAngle(laneHeading - pose.heading))
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

function allowsLanePose(pose: BoatPose, goalPose: BoatPose, laneHeading: number): boolean {
    const { along } = getLaneMetrics(pose, goalPose, laneHeading)
    return along >= -STRAIGHT_LANE_OVERSHOOT_ALLOWANCE
}

function getLaneMetrics(
    pose: BoatPose,
    goalPose: BoatPose,
    laneHeading: number
): { along: number; lateral: number } {
    const dx = goalPose.x - pose.x
    const dy = goalPose.y - pose.y
    const axisX = Math.cos(laneHeading)
    const axisY = Math.sin(laneHeading)
    const perpX = -axisY
    const perpY = axisX

    return {
        along: dx * axisX + dy * axisY,
        lateral: Math.abs(dx * perpX + dy * perpY)
    }
}

function getSegmentTraversalCost(
    segment: BoatMotionSegment,
    analysis: SegmentAnalysis
): number {
    let cost = segment.length

    if (segment.kind === 'arc') {
        cost += ARC_SEGMENT_PENALTY
    } else if (segment.kind === 'pivot') {
        cost += PIVOT_SEGMENT_PENALTY
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
    const boatPolygon = getMovingBoatFootprintPolygon(
        pose,
        geometry.boatWidth,
        geometry.boatHeight
    )
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
            id: obstacle.id,
            polygon: obstacle.polygon,
            bounds: getPolygonBounds(obstacle.polygon)
        })),
        occupiedBoatPolygons,
        occupiedBoatBounds: occupiedBoatPolygons.map(getPolygonBounds)
    }
}
