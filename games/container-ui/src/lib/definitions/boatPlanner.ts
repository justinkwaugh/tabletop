import type { Point } from '@tabletop/common'
import type {
    BoatNavigationGeometry,
    BoatPose,
    DockSlot,
    OpenWaterSlot,
    RouteEndpoint,
    TransitChannel
} from '$lib/definitions/boatNavigation.js'
import {
    getBoatFootprintPolygon,
    getMovingBoatFootprintPolygon
} from '$lib/definitions/boatNavigation.js'
import {
    DOCK_MANEUVER_CONFIG,
    HARBOR_K_TURN_LATERAL_OFFSET,
    HARBOR_K_TURN_REENTRY_DISTANCE,
    OPEN_WATER_LONG_REVERSE_DISTANCE,
    OPEN_WATER_SHARP_UNDOCK_CONFIG,
    OPEN_WATER_STRAIGHT_APPROACH_DISTANCES,
    OPEN_WATER_TURN_RADIUS,
    type DockManeuverConfig
} from '$lib/definitions/boatManeuverConfig.js'
import { getPrecomputedBoatRoutePlanForEndpoints } from '$lib/definitions/boatPrecomputedRoutes.js'
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
    preferredTransitChannel?: TransitChannel
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
const OBSTACLE_PROXIMITY_WEIGHT = 0.22
const OBSTACLE_PROXIMITY_CURVE_WEIGHT = 0.04
const DETOUR_PROGRESS_ALLOWANCE = TURN_RADIUS * 2.5
const HARBOR_K_TURN_SETUP_DISTANCE = 220
const HARBOR_K_TURN_PIVOT_SCALE = 42
const CHANNEL_ENDPOINT_MIN_DISTANCE = 220
const CHANNEL_CLEARANCE_TARGET = 1
const CHANNEL_PREFERENCE_WEIGHT = 0.55
const CHANNEL_PREFERENCE_CURVE_WEIGHT = 0.18
const CHANNEL_ROUTE_DISTANCE_THRESHOLD = 420
const SMOOTHING_POSE_EPSILON = 0.75
const SMOOTHING_ANGLE_EPSILON = 0.08
const SMOOTHING_RADIUS_EPSILON = 1.5
const SMOOTHING_CENTER_EPSILON = 1.5
const SMOOTHING_MIN_SHORTCUT_RADIUS = 48
const FOUR_PLAYER_MAIN_HARBOR_CHANNEL_OFFSET_X = 150
const FOUR_PLAYER_MAIN_HARBOR_CHANNEL_OFFSET_Y = 70
const FOUR_PLAYER_MAIN_HARBOR_ARC_RADIUS = 84
const FOUR_PLAYER_TOP_HARBOR_CHANNEL_Y = 220

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

export function buildRoutePlan(
    start: RouteEndpoint,
    end: RouteEndpoint,
    geometry: BoatNavigationGeometry,
    occupiedBoatPoses: BoatPose[] = []
): BoatRoutePlan | null {
    const plannerContext = createPlannerContext(geometry, occupiedBoatPoses)
    if (process.env.BOAT_PRECOMPUTED_DISABLE !== '1') {
        const precomputedPlan = getPrecomputedBoatRoutePlanForEndpoints(geometry, start, end)
        if (precomputedPlan) {
            return shouldSmoothRoutePlan(start, end)
                ? smoothRoutePlan(precomputedPlan, plannerContext)
                : precomputedPlan
        }
    }

    if (isDockSlot(start) && isDockSlot(end)) {
        const plan = buildDockTransferPlanWithContext(
            start,
            end,
            plannerContext,
            buildUndockCandidates(start, end.stagingPose)
        )
        return plan ? (shouldSmoothRoutePlan(start, end) ? smoothRoutePlan(plan, plannerContext) : plan) : null
    }

    if (isDockSlot(start) && isOpenWaterSlot(end)) {
        const standardPlan = evaluateDockToOpenWaterPlan(
            start,
            end,
            plannerContext,
            buildUndockCandidates(start, end.stagingPose)
        )
        if (standardPlan) {
            return shouldSmoothRoutePlan(start, end) ? smoothRoutePlan(standardPlan, plannerContext) : standardPlan
        }

        if (start.family !== 'main-island-harbor') {
            return null
        }

        const plan = evaluateDockToOpenWaterPlan(
            start,
            end,
            plannerContext,
            buildHarborExitUndockCandidates(start, end.stagingPose)
        )
        return plan ? (shouldSmoothRoutePlan(start, end) ? smoothRoutePlan(plan, plannerContext) : plan) : null
    }

    if (isOpenWaterSlot(start) && isDockSlot(end)) {
        const plan = buildOpenWaterToDockPlan(start, end, plannerContext)
        return plan ? (shouldSmoothRoutePlan(start, end) ? smoothRoutePlan(plan, plannerContext) : plan) : null
    }

    if (isOpenWaterSlot(start) && isOpenWaterSlot(end)) {
        return null
    }

    return null
}

function shouldSmoothRoutePlan(start: RouteEndpoint, end: RouteEndpoint): boolean {
    return !(isDockSlot(end) && end.family === 'main-island-harbor')
}

export function buildBestDockTransferPlan(
    startDock: DockSlot,
    endDocks: DockSlot[],
    geometry: BoatNavigationGeometry,
    occupiedBoatPoses: BoatPose[] = []
): BestDockTransferPlan | null {
    const plannerContext = createPlannerContext(geometry, occupiedBoatPoses)
    const targetPose = getAveragePose(endDocks.map((dock) => dock.stagingPose))
    const standardPlan = evaluateBestDockTransferPlan(
        startDock,
        endDocks,
        plannerContext,
        buildUndockCandidates(startDock, targetPose)
    )
    if (standardPlan) {
        return standardPlan
    }

    if (startDock.family !== 'main-island-harbor') {
        return null
    }

    return evaluateBestDockTransferPlan(
        startDock,
        endDocks,
        plannerContext,
        buildHarborExitUndockCandidates(startDock, targetPose)
    )
}

function buildDockTransferPlanWithContext(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext,
    undockCandidates: UndockManeuverCandidate[]
): BoatRoutePlan | null {
    if (shouldForceUpperRightHarborPlan(startDock, endDock, plannerContext)) {
        const forcedUpperRightPlan = buildForcedChannelDockTransferPlan(
            startDock,
            endDock,
            plannerContext,
            buildHarborExitUndockCandidates(startDock, endDock.stagingPose),
            [buildUpperRightApproachChannel(endDock, plannerContext)]
        )
        if (forcedUpperRightPlan) {
            return forcedUpperRightPlan
        }
    }

    if (shouldForceBottomCenterHarborToLowLeft(startDock, endDock, plannerContext)) {
        const bottomCenterChannel = plannerContext.geometry.transitChannels.find(
            (channel) => channel.id === 'channel-bottom-center'
        )
        if (bottomCenterChannel) {
            const forcedBottomPlan = buildForcedChannelDockTransferPlan(
                startDock,
                endDock,
                plannerContext,
                buildHarborExitUndockCandidates(startDock, endDock.stagingPose),
                [bottomCenterChannel]
            )
            if (forcedBottomPlan) {
                return forcedBottomPlan
            }
        }
    }

    const standardPlan = evaluateExactDockTransferPlan(
        startDock,
        endDock,
        plannerContext,
        undockCandidates
    )
    if (startDock.family !== 'main-island-harbor') {
        return standardPlan
    }

    const harborExitPlan = evaluateExactDockTransferPlan(
        startDock,
        endDock,
        plannerContext,
        buildHarborExitUndockCandidates(startDock, endDock.stagingPose)
    )

    if (!standardPlan) {
        return harborExitPlan
    }

    if (!harborExitPlan) {
        return standardPlan
    }

    return getMotionPathLength(harborExitPlan.segments) < getMotionPathLength(standardPlan.segments)
        ? harborExitPlan
        : standardPlan
}

function evaluateBestDockTransferPlan(
    startDock: DockSlot,
    endDocks: DockSlot[],
    plannerContext: PlannerContext,
    undockCandidates: UndockManeuverCandidate[]
): BestDockTransferPlan | null {
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

function evaluateExactDockTransferPlan(
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

function evaluateDockToOpenWaterPlan(
    startDock: DockSlot,
    endSlot: OpenWaterSlot,
    plannerContext: PlannerContext,
    undockCandidates: UndockManeuverCandidate[]
): BoatRoutePlan | null {
    const forcedChannelChain = selectDockToOpenWaterChannelChain(
        startDock,
        endSlot,
        plannerContext
    )
    let bestPlan: BoatRoutePlan | null = null

    for (const undockCandidate of undockCandidates) {
        const poseConnection =
            forcedChannelChain.length > 0
                ? findOpenWaterConnectionViaChannelChain(
                      undockCandidate.transitPose,
                      endSlot,
                      plannerContext,
                      forcedChannelChain
                  ) ??
                  (forcedChannelChain.length > 1
                      ? findOpenWaterConnectionViaChannelChain(
                            undockCandidate.transitPose,
                            endSlot,
                            plannerContext,
                            [forcedChannelChain.at(-1)!]
                        )
                      : null) ??
                  findOpenWaterConnection(
                      undockCandidate.transitPose,
                      endSlot,
                      plannerContext
                  )
                : findOpenWaterConnection(
                      undockCandidate.transitPose,
                      endSlot,
                      plannerContext
                  )
        if (!poseConnection) continue

        const undockSegments = [
            createStraightSegment(startDock.dockedPose, startDock.stagingPose, 'reverse'),
            ...undockCandidate.maneuverSegments
        ]
        const parkSegments = [
            ...poseConnection.goalSegments,
            createStraightSegment(endSlot.stagingPose, endSlot.parkedPose, 'forward')
        ]

        const candidatePlan: BoatRoutePlan = {
            undockSegments,
            transitSegments: poseConnection.transitSegments,
            dockSegments: parkSegments,
            segments: [...undockSegments, ...poseConnection.transitSegments, ...parkSegments]
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

function buildOpenWaterToDockPlan(
    startSlot: OpenWaterSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext
): BoatRoutePlan | null {
    const preferredRightHarborCorridor = shouldPreferRightHarborCorridor(
        startSlot,
        endDock,
        plannerContext
    )
        ? buildRightHarborPreferredChannel(startSlot, endDock, plannerContext)
        : null
    let bestPlan: BoatRoutePlan | null = null

    for (const undockCandidate of buildOpenWaterUndockCandidates(startSlot, endDock.stagingPose)) {
        const dockConnection = preferredRightHarborCorridor
            ? findExactDockConnectionViaChannelChain(
                  undockCandidate.transitPose,
                  endDock,
                  plannerContext,
                  [preferredRightHarborCorridor]
              )
            : findExactDockConnection(
                  undockCandidate.transitPose,
                  endDock,
                  plannerContext
              )
        if (!dockConnection) {
            continue
        }

        const candidatePlan: BoatRoutePlan = {
            undockSegments: undockCandidate.maneuverSegments,
            transitSegments: dockConnection.transitSegments,
            dockSegments: [
                ...dockConnection.dockSegments,
                createStraightSegment(endDock.stagingPose, endDock.dockedPose, 'forward')
            ],
            segments: [
                ...undockCandidate.maneuverSegments,
                ...dockConnection.transitSegments,
                ...dockConnection.dockSegments,
                createStraightSegment(endDock.stagingPose, endDock.dockedPose, 'forward')
            ]
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

function shouldPreferRightHarborCorridor(
    startSlot: OpenWaterSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext
): boolean {
    if (endDock.family !== 'main-island-harbor') {
        return false
    }

    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!mainIslandObstacle) {
        return false
    }

    const islandCenterX = (mainIslandObstacle.bounds.minX + mainIslandObstacle.bounds.maxX) / 2

    return (
        startSlot.stagingPose.x > islandCenterX + 140 &&
        endDock.stagingPose.x > islandCenterX + 140
    )
}

function shouldPreferRightPlayerBoardCorridor(
    startPose: BoatPose,
    endDock: DockSlot,
    plannerContext: PlannerContext
): boolean {
    if (endDock.family !== 'player-board') {
        return false
    }

    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!mainIslandObstacle) {
        return false
    }

    const islandCenterX = (mainIslandObstacle.bounds.minX + mainIslandObstacle.bounds.maxX) / 2

    return startPose.x > islandCenterX + 140 && endDock.stagingPose.x > islandCenterX + 140
}

function shouldForceBottomCenterForLowLeftDock(
    startPose: BoatPose,
    endDock: DockSlot,
    plannerContext: PlannerContext
): boolean {
    if (endDock.family !== 'player-board') {
        return false
    }

    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!mainIslandObstacle) {
        return false
    }

    const islandCenterX = (mainIslandObstacle.bounds.minX + mainIslandObstacle.bounds.maxX) / 2
    const islandCenterY = (mainIslandObstacle.bounds.minY + mainIslandObstacle.bounds.maxY) / 2

    return (
        startPose.x > islandCenterX + 140 &&
        endDock.stagingPose.x < islandCenterX - 220 &&
        endDock.stagingPose.y > islandCenterY + 180
    )
}

function buildImplicitRightCorridor(
    startPose: BoatPose,
    endPose: BoatPose,
    plannerContext: PlannerContext,
    id: string
): TransitChannel {
    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!mainIslandObstacle) {
        return {
            id,
            x: plannerContext.geometry.boardWidth - 260,
            y: (startPose.y + endPose.y) / 2,
            width: 280,
            height: Math.abs(startPose.y - endPose.y) + 260
        }
    }

    const islandMaxX = mainIslandObstacle.bounds.maxX
    const corridorX = islandMaxX + 140

    return {
        id,
        x: corridorX,
        y: (startPose.y + endPose.y) / 2,
        width: 260,
        height: Math.abs(startPose.y - endPose.y) + 320
    }
}

function buildRightHarborPreferredChannel(
    startSlot: OpenWaterSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext
): TransitChannel {
    return buildImplicitRightCorridor(
        startSlot.stagingPose,
        endDock.stagingPose,
        plannerContext,
        'implicit-right-harbor-corridor'
    )
}

function buildRightPlayerBoardPreferredChannel(
    startPose: BoatPose,
    endDock: DockSlot,
    plannerContext: PlannerContext
): TransitChannel {
    return buildImplicitRightCorridor(
        startPose,
        endDock.stagingPose,
        plannerContext,
        'implicit-right-player-board-corridor'
    )
}

function buildUpperRightApproachChannel(
    endDock: DockSlot,
    plannerContext: PlannerContext
): TransitChannel {
    return {
        id: 'implicit-upper-right-approach',
        x: endDock.stagingPose.x - 40,
        y: endDock.stagingPose.y + 140,
        width: 200,
        height: 260
    }
}

function shouldPreferUpperRightApproachBand(
    startPose: BoatPose,
    endDock: DockSlot,
    plannerContext: PlannerContext
): boolean {
    if (endDock.family !== 'player-board') {
        return false
    }

    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!mainIslandObstacle) {
        return false
    }

    const islandCenterX = (mainIslandObstacle.bounds.minX + mainIslandObstacle.bounds.maxX) / 2
    const islandCenterY = (mainIslandObstacle.bounds.minY + mainIslandObstacle.bounds.maxY) / 2

    return (
        startPose.x > islandCenterX + 140 &&
        endDock.stagingPose.x > islandCenterX + 140 &&
        endDock.stagingPose.y < islandCenterY
    )
}

function selectDockToOpenWaterChannelChain(
    startDock: DockSlot,
    endSlot: OpenWaterSlot,
    plannerContext: PlannerContext
): TransitChannel[] {
    const transitChannelsById = new Map(
        plannerContext.geometry.transitChannels.map((channel) => [channel.id, channel])
    )
    const leftMiddle = transitChannelsById.get('channel-left-middle')
    const bottomCenter = transitChannelsById.get('channel-bottom-center')
    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!leftMiddle || !bottomCenter || !mainIslandObstacle) {
        return []
    }

    const islandCenterX = (mainIslandObstacle.bounds.minX + mainIslandObstacle.bounds.maxX) / 2
    const islandCenterY = (mainIslandObstacle.bounds.minY + mainIslandObstacle.bounds.maxY) / 2
    const startIsLeft = startDock.stagingPose.x < islandCenterX - 220
    const endIsRight = endSlot.stagingPose.x > islandCenterX + 140
    const endIsLow = endSlot.stagingPose.y > islandCenterY + 180

    if (!startIsLeft || !endIsRight || !endIsLow) {
        return []
    }

    const startIsHigh = startDock.stagingPose.y < islandCenterY - 40
    return startIsHigh ? [leftMiddle, bottomCenter] : [bottomCenter]
}

function shouldForceUpperRightHarborPlan(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext
): boolean {
    if (startDock.family !== 'main-island-harbor' || endDock.family !== 'player-board') {
        return false
    }

    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!mainIslandObstacle) {
        return false
    }

    const islandCenterX = (mainIslandObstacle.bounds.minX + mainIslandObstacle.bounds.maxX) / 2
    const islandCenterY = (mainIslandObstacle.bounds.minY + mainIslandObstacle.bounds.maxY) / 2

    return (
        startDock.stagingPose.x > islandCenterX + 140 &&
        startDock.stagingPose.y < islandCenterY &&
        endDock.stagingPose.x > islandCenterX + 140 &&
        endDock.stagingPose.y < islandCenterY
    )
}

function shouldForceBottomCenterHarborToLowLeft(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext
): boolean {
    if (startDock.family !== 'main-island-harbor' || endDock.family !== 'player-board') {
        return false
    }

    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!mainIslandObstacle) {
        return false
    }

    const islandCenterX = (mainIslandObstacle.bounds.minX + mainIslandObstacle.bounds.maxX) / 2
    const islandCenterY = (mainIslandObstacle.bounds.minY + mainIslandObstacle.bounds.maxY) / 2

    return (
        startDock.stagingPose.x > islandCenterX + 140 &&
        startDock.stagingPose.y > islandCenterY - 20 &&
        endDock.stagingPose.x < islandCenterX - 220 &&
        endDock.stagingPose.y > islandCenterY + 180
    )
}

function buildForcedChannelDockTransferPlan(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext,
    undockCandidates: UndockManeuverCandidate[],
    channels: TransitChannel[]
): BoatRoutePlan | null {
    let bestPlan: BoatRoutePlan | null = null

    for (const undockCandidate of undockCandidates) {
        const dockConnection = findExactDockConnectionViaChannelChain(
            undockCandidate.transitPose,
            endDock,
            plannerContext,
            channels
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
    return findBestDockConnectionForGoalsDirect(startPose, endDocks, plannerContext)
}

function findBestDockConnectionForGoalsDirect(
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
    if (shouldPreferUpperRightApproachBand(startPose, endDock, plannerContext)) {
        const upperRightConnection = findExactDockConnectionViaChannelChain(
            startPose,
            endDock,
            plannerContext,
            [buildUpperRightApproachChannel(endDock, plannerContext)]
        )
        if (upperRightConnection) {
            return upperRightConnection
        }
    }

    if (shouldForceBottomCenterForLowLeftDock(startPose, endDock, plannerContext)) {
        const bottomCenterChannel = plannerContext.geometry.transitChannels.find(
            (channel) => channel.id === 'channel-bottom-center'
        )
        if (bottomCenterChannel) {
            const bottomForcedConnection = findExactDockConnectionViaChannelChain(
                startPose,
                endDock,
                plannerContext,
                [bottomCenterChannel]
            )
            if (bottomForcedConnection) {
                return bottomForcedConnection
            }
        }
    }

    if (shouldPreferRightPlayerBoardCorridor(startPose, endDock, plannerContext)) {
        const rightPlayerBoardConnection = findExactDockConnectionViaChannelChain(
            startPose,
            endDock,
            plannerContext,
            [buildRightPlayerBoardPreferredChannel(startPose, endDock, plannerContext)]
        )
        if (rightPlayerBoardConnection) {
            return rightPlayerBoardConnection
        }
    }

    const directConnection = findExactDockConnectionDirect(startPose, endDock, plannerContext)
    if (!directConnection) {
        return null
    }

    const preferredChannelChain = selectPreferredTransitChannelChain(
        directConnection.transitSegments,
        startPose,
        endDock.stagingPose,
        plannerContext
    )
    if (preferredChannelChain.length === 0) {
        return directConnection
    }

    const chainedConnection = findExactDockConnectionViaChannelChain(
        startPose,
        endDock,
        plannerContext,
        preferredChannelChain
    )

    return chainedConnection ?? directConnection
}

function findExactDockConnectionDirect(
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

function findPoseConnection(
    startPose: BoatPose,
    endPose: BoatPose,
    plannerContext: PlannerContext
): { transitSegments: BoatMotionSegment[] } | null {
    return findPoseConnectionDirect(startPose, endPose, plannerContext)
}

function findPoseConnectionDirect(
    startPose: BoatPose,
    endPose: BoatPose,
    plannerContext: PlannerContext
): { transitSegments: BoatMotionSegment[] } | null {
    const poseGoal = buildPoseGoalCandidate(endPose)
    const connection =
        runTransitSearch(startPose, poseGoal, plannerContext, MAX_SEARCH_ITERATIONS) ??
        runTransitSearch(
            startPose,
            poseGoal,
            plannerContext,
            MAX_SEARCH_ITERATIONS * SEARCH_ITERATION_RETRY_MULTIPLIER
        )

    return connection ? { transitSegments: connection.transitSegments } : null
}

function findOpenWaterConnection(
    startPose: BoatPose,
    endSlot: OpenWaterSlot,
    plannerContext: PlannerContext
): { transitSegments: BoatMotionSegment[]; goalSegments: BoatMotionSegment[] } | null {
    const directConnection = findOpenWaterConnectionDirect(startPose, endSlot, plannerContext)
    if (!directConnection) {
        return null
    }

    if (!shouldUseTransitChannelsForOpenWaterRoute(startPose, endSlot, plannerContext)) {
        return directConnection
    }

    const preferredChannelChain = selectPreferredTransitChannelChain(
        directConnection.transitSegments,
        startPose,
        endSlot.stagingPose,
        plannerContext
    )
    if (preferredChannelChain.length === 0) {
        return directConnection
    }

    const chainedConnection = findOpenWaterConnectionViaChannelChain(
        startPose,
        endSlot,
        plannerContext,
        preferredChannelChain
    )

    return chainedConnection ?? directConnection
}

function shouldUseTransitChannelsForOpenWaterRoute(
    startPose: BoatPose,
    endSlot: OpenWaterSlot,
    plannerContext: PlannerContext
): boolean {
    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!mainIslandObstacle) {
        return true
    }

    const islandCenterX = (mainIslandObstacle.bounds.minX + mainIslandObstacle.bounds.maxX) / 2

    const startsOnRightSide = startPose.x > islandCenterX + 140
    const endsOnRightSide = endSlot.stagingPose.x > islandCenterX + 140

    if (startsOnRightSide && endsOnRightSide) {
        return false
    }

    return true
}

function findOpenWaterConnectionDirect(
    startPose: BoatPose,
    endSlot: OpenWaterSlot,
    plannerContext: PlannerContext
): { transitSegments: BoatMotionSegment[]; goalSegments: BoatMotionSegment[] } | null {
    let bestConnection:
        | {
              transitSegments: BoatMotionSegment[]
              goalSegments: BoatMotionSegment[]
              totalLength: number
          }
        | null = null

    for (const goal of buildOpenWaterGoalCandidates(endSlot, startPose)) {
        const connection =
            runTransitSearch(startPose, goal, plannerContext, MAX_SEARCH_ITERATIONS) ??
            runTransitSearch(
                startPose,
                goal,
                plannerContext,
                MAX_SEARCH_ITERATIONS * SEARCH_ITERATION_RETRY_MULTIPLIER
            )

        if (!connection) {
            continue
        }

        const totalLength = getMotionPathLength([
            ...connection.transitSegments,
            ...connection.dockSegments
        ])

        if (!bestConnection || totalLength < bestConnection.totalLength) {
            bestConnection = {
                transitSegments: connection.transitSegments,
                goalSegments: connection.dockSegments,
                totalLength
            }
        }
    }

    return bestConnection
        ? {
              transitSegments: bestConnection.transitSegments,
              goalSegments: bestConnection.goalSegments
          }
        : null
}

function findExactDockConnectionViaChannels(
    startPose: BoatPose,
    endDock: DockSlot,
    plannerContext: PlannerContext,
    referencePose: BoatPose
): { transitSegments: BoatMotionSegment[]; dockSegments: BoatMotionSegment[]; endDock: DockSlot } | null {
    let bestConnection:
        | { transitSegments: BoatMotionSegment[]; dockSegments: BoatMotionSegment[]; endDock: DockSlot }
        | null = null

    for (const channel of getUsableTransitChannels(
        startPose,
        endDock.stagingPose,
        plannerContext,
        referencePose
    )) {
        const firstLeg = findTransitChannelConnection(startPose, channel, plannerContext)
        if (!firstLeg) continue

        const secondLeg = findExactDockConnectionDirect(firstLeg.channelPose, endDock, plannerContext)
        if (!secondLeg) continue

        const candidate = {
            transitSegments: [...firstLeg.transitSegments, ...secondLeg.transitSegments],
            dockSegments: secondLeg.dockSegments,
            endDock: secondLeg.endDock
        }

        if (
            !bestConnection ||
            getMotionPathLength([...candidate.transitSegments, ...candidate.dockSegments]) <
                getMotionPathLength([...bestConnection.transitSegments, ...bestConnection.dockSegments])
        ) {
            bestConnection = candidate
        }
    }

    return bestConnection
}

function findExactDockConnectionViaChannelChain(
    startPose: BoatPose,
    endDock: DockSlot,
    plannerContext: PlannerContext,
    channels: TransitChannel[]
): { transitSegments: BoatMotionSegment[]; dockSegments: BoatMotionSegment[]; endDock: DockSlot } | null {
    let currentPose = startPose
    const transitSegments: BoatMotionSegment[] = []

    for (const channel of channels) {
        const leg = findTransitChannelConnection(currentPose, channel, plannerContext)
        if (!leg) {
            return null
        }

        transitSegments.push(...leg.transitSegments)
        currentPose = leg.channelPose
    }

    const finalConnection = findExactDockConnectionDirect(currentPose, endDock, plannerContext)
    if (!finalConnection) {
        return null
    }

    return {
        transitSegments: [...transitSegments, ...finalConnection.transitSegments],
        dockSegments: finalConnection.dockSegments,
        endDock: finalConnection.endDock
    }
}

function findOpenWaterConnectionViaChannelChain(
    startPose: BoatPose,
    endSlot: OpenWaterSlot,
    plannerContext: PlannerContext,
    channels: TransitChannel[]
): { transitSegments: BoatMotionSegment[]; goalSegments: BoatMotionSegment[] } | null {
    let currentPose = startPose
    const transitSegments: BoatMotionSegment[] = []

    for (const channel of channels) {
        const leg = findTransitChannelConnection(currentPose, channel, plannerContext)
        if (!leg) {
            return null
        }

        transitSegments.push(...leg.transitSegments)
        currentPose = leg.channelPose
    }

    const finalConnection = findOpenWaterConnectionDirect(currentPose, endSlot, plannerContext)
    if (!finalConnection) {
        return null
    }

    return {
        transitSegments: [...transitSegments, ...finalConnection.transitSegments],
        goalSegments: finalConnection.goalSegments
    }
}

function getUsableTransitChannels(
    startPose: BoatPose,
    endPose: BoatPose,
    plannerContext: PlannerContext,
    referencePose?: BoatPose
): TransitChannel[] {
    return plannerContext.geometry.transitChannels
        .filter(
            (channel) =>
                distanceBetween(startPose, getTransitChannelCenter(channel)) >= CHANNEL_ENDPOINT_MIN_DISTANCE &&
                distanceBetween(endPose, getTransitChannelCenter(channel)) >= CHANNEL_ENDPOINT_MIN_DISTANCE
        )
        .sort(
            (a, b) =>
                (referencePose
                    ? distanceBetween(referencePose, getTransitChannelCenter(a))
                    : distanceBetween(startPose, getTransitChannelCenter(a)) +
                      distanceBetween(endPose, getTransitChannelCenter(a))) -
                (referencePose
                    ? distanceBetween(referencePose, getTransitChannelCenter(b))
                    : distanceBetween(startPose, getTransitChannelCenter(b)) +
                      distanceBetween(endPose, getTransitChannelCenter(b)))
        )
        .slice(0, 1)
}

function shouldPreferChannelRouting(
    startPose: BoatPose,
    endPose: BoatPose,
    plannerContext: PlannerContext
): boolean {
    return (
        plannerContext.geometry.transitChannels.length > 0 &&
        distanceBetween(startPose, endPose) >= CHANNEL_ROUTE_DISTANCE_THRESHOLD
    )
}

function findTransitChannelConnection(
    startPose: BoatPose,
    channel: TransitChannel,
    plannerContext: PlannerContext
): { transitSegments: BoatMotionSegment[]; channelPose: BoatPose } | null {
    const channelGoal = buildTransitChannelGoalCandidate(channel)
    const connection =
        runTransitSearch(startPose, channelGoal, plannerContext, MAX_SEARCH_ITERATIONS) ??
        runTransitSearch(
            startPose,
            channelGoal,
            plannerContext,
            MAX_SEARCH_ITERATIONS * SEARCH_ITERATION_RETRY_MULTIPLIER
        )

    return connection
        ? {
              transitSegments: connection.transitSegments,
              channelPose: connection.endPose
          }
        : null
}

function getPathMidPose(segments: BoatMotionSegment[]): BoatPose {
    const length = getMotionPathLength(segments)
    if (length <= 0) {
        const lastSegment = segments.at(-1)
        return lastSegment ? lastSegment.endPose : { x: 0, y: 0, heading: 0 }
    }

    return sampleMotionPath(segments, length / 2)
}

function getTransitChannelCenter(channel: TransitChannel): Point {
    return {
        x: channel.x,
        y: channel.y
    }
}

function isPoseWithinTransitChannel(pose: BoatPose, channel: TransitChannel): boolean {
    return (
        Math.abs(pose.x - channel.x) <= channel.width / 2 &&
        Math.abs(pose.y - channel.y) <= channel.height / 2
    )
}

function selectPreferredTransitChannelChain(
    transitSegments: BoatMotionSegment[],
    startPose: BoatPose,
    endPose: BoatPose,
    plannerContext: PlannerContext
): TransitChannel[] {
    if (
        transitSegments.length === 0 ||
        !shouldPreferChannelRouting(startPose, endPose, plannerContext)
    ) {
        return []
    }

    const transitChannelsById = new Map(
        plannerContext.geometry.transitChannels.map((channel) => [channel.id, channel])
    )
    const leftMiddle = transitChannelsById.get('channel-left-middle')
    const topCenter = transitChannelsById.get('channel-top-center')
    const bottomCenter = transitChannelsById.get('channel-bottom-center')

    if (!leftMiddle || !topCenter || !bottomCenter) {
        return []
    }

    const directTouchesBottom = pathTouchesTransitChannel(transitSegments, bottomCenter)
    const directTouchesTop = pathTouchesTransitChannel(transitSegments, topCenter)
    const directTouchesLeft = pathTouchesTransitChannel(transitSegments, leftMiddle)
    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!mainIslandObstacle) {
        return []
    }

    const islandCenterX = (mainIslandObstacle.bounds.minX + mainIslandObstacle.bounds.maxX) / 2
    const islandCenterY = (mainIslandObstacle.bounds.minY + mainIslandObstacle.bounds.maxY) / 2
    const isCrossingToRight = endPose.x > islandCenterX + 220
    const isCrossingToLeft = endPose.x < islandCenterX - 220
    const isHeadingDown = endPose.y > islandCenterY + 80
    const isHeadingUp = endPose.y < islandCenterY - 80
    const startsRight = startPose.x > islandCenterX + 140
    const startsHigh = startPose.y < islandCenterY - 40
    const startsLow = startPose.y > islandCenterY + 40
    const endsLow = endPose.y > islandCenterY + 180

    if (isCrossingToRight && isHeadingDown) {
        if (startsRight) {
            if (startsHigh) {
                return directTouchesTop && directTouchesBottom
                    ? []
                    : directTouchesTop
                        ? [bottomCenter]
                        : [topCenter, bottomCenter]
            }

            return directTouchesBottom ? [] : [bottomCenter]
        }

        if (startsHigh) {
            return directTouchesLeft && directTouchesBottom
                ? []
                : directTouchesLeft
                    ? [bottomCenter]
                    : [leftMiddle, bottomCenter]
        }

        return directTouchesBottom ? [] : [bottomCenter]
    }

    if (isCrossingToRight && isHeadingUp) {
        if (startsLow) {
            return directTouchesLeft && directTouchesTop
                ? []
                : directTouchesLeft
                    ? [topCenter]
                    : [leftMiddle, topCenter]
        }

        return directTouchesTop ? [] : [topCenter]
    }

    if (isCrossingToLeft && isHeadingDown) {
        if (startsRight) {
            if (endsLow) {
                return directTouchesBottom ? [] : [bottomCenter]
            }

            return directTouchesBottom && directTouchesLeft
                ? []
                : directTouchesBottom
                    ? [leftMiddle]
                    : [bottomCenter, leftMiddle]
        }

        return directTouchesBottom ? [] : [bottomCenter]
    }

    if (isCrossingToLeft && isHeadingUp) {
        if (startsRight) {
            return directTouchesTop && directTouchesLeft
                ? []
                : directTouchesTop
                    ? [leftMiddle]
                    : [topCenter, leftMiddle]
        }

        return directTouchesTop ? [] : [topCenter]
    }

    return []
}

function pathTouchesTransitChannel(
    segments: BoatMotionSegment[],
    transitChannel: TransitChannel
): boolean {
    const totalLength = getMotionPathLength(segments)
    if (totalLength <= 0) {
        return false
    }

    for (let distance = 0; distance <= totalLength; distance += COLLISION_SAMPLE_STEP * 2) {
        const pose = sampleMotionPath(segments, distance)
        if (isPoseWithinTransitChannel(pose, transitChannel)) {
            return true
        }
    }

    const endPose = sampleMotionPath(segments, totalLength)
    return isPoseWithinTransitChannel(endPose, transitChannel)
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
): { transitSegments: BoatMotionSegment[]; dockSegments: BoatMotionSegment[]; endPose: BoatPose } | null {
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
                dockSegments: goalConnection,
                endPose: current.pose
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

function buildPoseGoalCandidate(goalPose: BoatPose): DockManeuverCandidate {
    return {
        heuristicPose: goalPose,
        estimateFrom: (pose) => heuristic(pose, goalPose),
        allowsPose: () => true,
        completeFrom: (currentPose, plannerContext) =>
            buildPoseGoalConnectionSegments(currentPose, goalPose, plannerContext),
        score: 0
    }
}

function buildTransitChannelGoalCandidate(channel: TransitChannel): DockManeuverCandidate {
    const channelPose: BoatPose = {
        x: channel.x,
        y: channel.y,
        heading: 0
    }

    return {
        heuristicPose: channelPose,
        estimateFrom: (pose) => estimateTransitChannelDistance(pose, channel),
        allowsPose: () => true,
        completeFrom: (currentPose) =>
            isPoseWithinTransitChannel(currentPose, channel) ? [] : null,
        score: 0
    }
}

function estimateTransitChannelDistance(pose: BoatPose, channel: TransitChannel): number {
    const dx = Math.max(0, Math.abs(pose.x - channel.x) - channel.width / 2)
    const dy = Math.max(0, Math.abs(pose.y - channel.y) - channel.height / 2)
    return Math.hypot(dx, dy)
}

function buildOpenWaterGoalCandidates(
    endSlot: OpenWaterSlot,
    sourcePose: BoatPose
): DockManeuverCandidate[] {
    const preferredBearing = Math.atan2(
        endSlot.stagingPose.y - sourcePose.y,
        endSlot.stagingPose.x - sourcePose.x
    )
    const perpendicularCandidates = buildPerpendicularCandidates(
        endSlot.stagingPose.heading,
        preferredBearing
    )

    const validCandidates: DockManeuverCandidate[] = OPEN_WATER_STRAIGHT_APPROACH_DISTANCES.map(
        (approachDistance, index) => {
            const approachPose = {
                x: endSlot.stagingPose.x - Math.cos(endSlot.stagingPose.heading) * approachDistance,
                y: endSlot.stagingPose.y - Math.sin(endSlot.stagingPose.heading) * approachDistance,
                heading: endSlot.stagingPose.heading
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

                    const finalStraight = createStraightSegment(
                        approachPose,
                        endSlot.stagingPose,
                        'forward'
                    )
                    if (!analyzeSegment(finalStraight, plannerContext).isCollisionFree) {
                        return null
                    }

                    return [...connector, finalStraight]
                },
                score: index * 0.01
            }
        }
    )

    for (const candidateHeading of perpendicularCandidates) {
        const arcSegment = createArcToEndPose(
            endSlot.stagingPose,
            candidateHeading.heading,
            normalizeAngle(endSlot.stagingPose.heading - candidateHeading.heading),
            OPEN_WATER_TURN_RADIUS
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
            score: 0.2 + candidateHeading.score
        })
    }

    return validCandidates.sort((a, b) => a.score - b.score)
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

function buildHarborExitUndockCandidates(
    dock: DockSlot,
    targetPose: BoatPose
): UndockManeuverCandidate[] {
    const config = DOCK_MANEUVER_CONFIG[dock.family]
    const preferredBearing = Math.atan2(
        targetPose.y - dock.stagingPose.y,
        targetPose.x - dock.stagingPose.x
    )
    const perpendicularCandidates = buildPerpendicularCandidates(
        dock.stagingPose.heading,
        preferredBearing
    )

    return perpendicularCandidates.flatMap((headingCandidate, headingIndex) =>
        [HARBOR_K_TURN_REENTRY_DISTANCE, ...config.straightApproachDistances].map(
            (approachDistance, distanceIndex) => {
                const clearancePose = {
                    x:
                        dock.stagingPose.x -
                        Math.cos(dock.stagingPose.heading) * approachDistance,
                    y:
                        dock.stagingPose.y -
                        Math.sin(dock.stagingPose.heading) * approachDistance,
                    heading: dock.stagingPose.heading
                }
                const reverseSegment = createStraightSegment(
                    dock.stagingPose,
                    clearancePose,
                    'reverse'
                )
                const forwardTurnSegment = createForwardArcFromStartPose(
                    clearancePose,
                    normalizeAngle(headingCandidate.heading - clearancePose.heading),
                    HARBOR_K_TURN_LATERAL_OFFSET
                )
                const transitPose = forwardTurnSegment.endPose

                return {
                    transitPose,
                    maneuverSegments: [reverseSegment, forwardTurnSegment],
                    score:
                        heuristic(transitPose, targetPose) +
                        headingCandidate.score * HARBOR_K_TURN_LATERAL_OFFSET * 0.5 +
                        headingIndex * 0.02 +
                        distanceIndex * 0.01
                }
            }
        )
    ).sort((a, b) => a.score - b.score)
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

function buildOpenWaterUndockCandidates(
    startSlot: OpenWaterSlot,
    targetPose: BoatPose
): UndockManeuverCandidate[] {
    const preferredBearing = Math.atan2(
        targetPose.y - startSlot.parkedPose.y,
        targetPose.x - startSlot.parkedPose.x
    )
    const candidates = buildPerpendicularCandidates(
        startSlot.parkedPose.heading,
        preferredBearing
    )

    return [
        {
            transitPose: startSlot.stagingPose,
            maneuverSegments: [
                createStraightSegment(startSlot.parkedPose, startSlot.stagingPose, 'reverse')
            ],
            score: heuristic(startSlot.stagingPose, targetPose)
        },
        ...buildReverseThenTurnCandidates(
            startSlot.parkedPose,
            targetPose,
            candidates,
            OPEN_WATER_SHARP_UNDOCK_CONFIG
        )
    ].sort((a, b) => a.score - b.score)
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
    const nearestChannelDistance = analysis.nearestChannelDistance

    if (nearestClearance < OBSTACLE_CLEARANCE_TARGET) {
        const clearanceDeficit = OBSTACLE_CLEARANCE_TARGET - nearestClearance
        cost += clearanceDeficit * OBSTACLE_PROXIMITY_WEIGHT
        cost +=
            (clearanceDeficit * clearanceDeficit * OBSTACLE_PROXIMITY_CURVE_WEIGHT) /
            OBSTACLE_CLEARANCE_TARGET
    }

    if (nearestChannelDistance > CHANNEL_CLEARANCE_TARGET) {
        const channelDeficit = nearestChannelDistance - CHANNEL_CLEARANCE_TARGET
        cost += channelDeficit * CHANNEL_PREFERENCE_WEIGHT
        cost +=
            (channelDeficit * channelDeficit * CHANNEL_PREFERENCE_CURVE_WEIGHT) /
            CHANNEL_CLEARANCE_TARGET
    }

    return cost
}

function smoothRoutePlan(plan: BoatRoutePlan, plannerContext: PlannerContext): BoatRoutePlan {
    const transitSegments = smoothTransitSegments(plan.transitSegments, plannerContext)
    return {
        ...plan,
        transitSegments,
        segments: [...plan.undockSegments, ...transitSegments, ...plan.dockSegments]
    }
}

function smoothTransitSegments(
    segments: BoatMotionSegment[],
    plannerContext: PlannerContext
): BoatMotionSegment[] {
    let smoothed = mergeConsecutiveTransitSegments(segments, plannerContext)
    let changed = true

    while (changed) {
        changed = false

        for (let windowSize = 4; windowSize >= 2; windowSize -= 1) {
            let replacedWindow = false
            for (let index = 0; index <= smoothed.length - windowSize; index += 1) {
                const window = smoothed.slice(index, index + windowSize)
                const replacement = buildTransitShortcut(window, plannerContext)
                if (!replacement) {
                    continue
                }

                smoothed = [
                    ...smoothed.slice(0, index),
                    ...replacement,
                    ...smoothed.slice(index + windowSize)
                ]
                smoothed = mergeConsecutiveTransitSegments(smoothed, plannerContext)
                changed = true
                replacedWindow = true
                break
            }

            if (replacedWindow) {
                break
            }
        }
    }

    return smoothed
}

function mergeConsecutiveTransitSegments(
    segments: BoatMotionSegment[],
    plannerContext: PlannerContext
): BoatMotionSegment[] {
    const merged: BoatMotionSegment[] = []

    for (const segment of segments) {
        const previous = merged.at(-1)
        if (!previous) {
            merged.push(segment)
            continue
        }

        const combined = tryMergeTransitPair(previous, segment, plannerContext)
        if (combined) {
            merged[merged.length - 1] = combined
        } else {
            merged.push(segment)
        }
    }

    return merged
}

function tryMergeTransitPair(
    first: BoatMotionSegment,
    second: BoatMotionSegment,
    plannerContext: PlannerContext
): BoatMotionSegment | null {
    if (
        !posesMatch(first.endPose, second.startPose) ||
        first.direction !== second.direction ||
        first.kind === 'pivot' ||
        second.kind === 'pivot'
    ) {
        return null
    }

    if (first.kind === 'straight' && second.kind === 'straight') {
        if (
            !anglesNear(first.startPose.heading, second.endPose.heading) ||
            !isStraightTravelAligned(first.startPose, second.endPose)
        ) {
            return null
        }

        const merged = createStraightSegment(first.startPose, second.endPose, first.direction)
        return analyzeSegment(merged, plannerContext).isCollisionFree ? merged : null
    }

    if (first.kind === 'arc' && second.kind === 'arc') {
        if (
            first.clockwise !== second.clockwise ||
            distanceBetween(first.center, second.center) > SMOOTHING_CENTER_EPSILON ||
            Math.abs(first.radius - second.radius) > SMOOTHING_RADIUS_EPSILON
        ) {
            return null
        }

        const merged = createArcSegment({
            direction: first.direction,
            startPose: first.startPose,
            endPose: second.endPose,
            center: first.center,
            radius: (first.radius + second.radius) / 2,
            startAngle: first.startAngle,
            endAngle: second.endAngle,
            clockwise: first.clockwise
        })
        return analyzeSegment(merged, plannerContext).isCollisionFree ? merged : null
    }

    return null
}

function buildTransitShortcut(
    window: BoatMotionSegment[],
    plannerContext: PlannerContext
): BoatMotionSegment[] | null {
    if (
        window.length < 2 ||
        window.some((segment) => segment.kind === 'pivot') ||
        window.some((segment) => segment.direction !== window[0]!.direction)
    ) {
        return null
    }

    const originalLength = window.reduce((sum, segment) => sum + segment.length, 0)
    const startPose = window[0]!.startPose
    const endPose = window.at(-1)!.endPose

    const straightShortcut = buildStraightTransitShortcut(startPose, endPose, window[0]!.direction, plannerContext)
    if (straightShortcut && straightShortcut.length < window.length) {
        const straightLength = straightShortcut.reduce((sum, segment) => sum + segment.length, 0)
        if (straightLength <= originalLength + 4) {
            return straightShortcut
        }
    }

    if (!hasMonotonicTransitCurvature(window)) {
        return null
    }

    const arcShortcut = buildArcTransitShortcut(startPose, endPose, window[0]!.direction, plannerContext)
    if (arcShortcut && arcShortcut.length < window.length) {
        const arcLength = arcShortcut.reduce((sum, segment) => sum + segment.length, 0)
        if (arcLength <= originalLength + 12) {
            return arcShortcut
        }
    }

    return null
}

function buildStraightTransitShortcut(
    startPose: BoatPose,
    endPose: BoatPose,
    direction: 'forward' | 'reverse',
    plannerContext: PlannerContext
): BoatMotionSegment[] | null {
    if (!anglesNear(startPose.heading, endPose.heading) || !isStraightTravelAligned(startPose, endPose)) {
        return null
    }

    const segment = createStraightSegment(startPose, endPose, direction)
    return analyzeSegment(segment, plannerContext).isCollisionFree ? [segment] : null
}

function buildArcTransitShortcut(
    startPose: BoatPose,
    endPose: BoatPose,
    direction: 'forward' | 'reverse',
    plannerContext: PlannerContext
): BoatMotionSegment[] | null {
    const arc = createShortcutArc(startPose, endPose, direction)
    if (!arc) {
        return null
    }

    return analyzeSegment(arc, plannerContext).isCollisionFree ? [arc] : null
}

function createShortcutArc(
    startPose: BoatPose,
    endPose: BoatPose,
    direction: 'forward' | 'reverse'
): BoatMotionSegment | null {
    const startHeading = direction === 'forward' ? startPose.heading : normalizeAngle(startPose.heading + Math.PI)
    const endHeading = direction === 'forward' ? endPose.heading : normalizeAngle(endPose.heading + Math.PI)
    const delta = normalizeAngle(endHeading - startHeading)

    if (Math.abs(delta) < SMOOTHING_ANGLE_EPSILON) {
        return null
    }

    const startNormal = getNormalVector(startHeading, delta > 0)
    const endNormal = getNormalVector(endHeading, delta > 0)
    const center = intersectLines(startPose, startNormal, endPose, endNormal)
    if (!center) {
        return null
    }

    const radius = distanceBetween(startPose, center)
    if (radius < SMOOTHING_MIN_SHORTCUT_RADIUS) {
        return null
    }

    const endRadius = distanceBetween(endPose, center)
    if (Math.abs(radius - endRadius) > SMOOTHING_RADIUS_EPSILON) {
        return null
    }

    const startAngle = Math.atan2(startPose.y - center.y, startPose.x - center.x)
    const endAngle = Math.atan2(endPose.y - center.y, endPose.x - center.x)
    return createArcSegment({
        direction,
        startPose,
        endPose,
        center,
        radius,
        startAngle,
        endAngle,
        clockwise: delta < 0
    })
}

function hasMonotonicTransitCurvature(window: BoatMotionSegment[]): boolean {
    const arcSigns = window
        .filter((segment): segment is BoatArcSegment => segment.kind === 'arc')
        .map((segment) => (segment.clockwise ? -1 : 1))

    if (arcSigns.length === 0) {
        return false
    }

    const firstSign = arcSigns[0]!
    return arcSigns.every((sign) => sign === firstSign)
}

function getNormalVector(heading: number, turnLeft: boolean): { x: number; y: number } {
    return turnLeft
        ? { x: -Math.sin(heading), y: Math.cos(heading) }
        : { x: Math.sin(heading), y: -Math.cos(heading) }
}

function intersectLines(
    originA: Point,
    directionA: Point,
    originB: Point,
    directionB: Point
): Point | null {
    const determinant = directionA.x * directionB.y - directionA.y * directionB.x
    if (Math.abs(determinant) < 0.0001) {
        return null
    }

    const dx = originB.x - originA.x
    const dy = originB.y - originA.y
    const t = (dx * directionB.y - dy * directionB.x) / determinant
    return {
        x: originA.x + directionA.x * t,
        y: originA.y + directionA.y * t
    }
}

function posesMatch(a: BoatPose, b: BoatPose): boolean {
    return distanceBetween(a, b) <= SMOOTHING_POSE_EPSILON && anglesNear(a.heading, b.heading)
}

function anglesNear(a: number, b: number): boolean {
    return Math.abs(normalizeAngle(a - b)) <= SMOOTHING_ANGLE_EPSILON
}

function isStraightTravelAligned(startPose: BoatPose, endPose: BoatPose): boolean {
    const dx = endPose.x - startPose.x
    const dy = endPose.y - startPose.y
    if (Math.hypot(dx, dy) <= SMOOTHING_POSE_EPSILON) {
        return true
    }

    const bearing = Math.atan2(dy, dx)
    return anglesNear(startPose.heading, bearing) && anglesNear(endPose.heading, bearing)
}

type SegmentAnalysis = {
    isCollisionFree: boolean
    nearestClearance: number
    nearestChannelDistance: number
}

function analyzeSegment(
    segment: BoatMotionSegment,
    plannerContext: PlannerContext
): SegmentAnalysis {
    let nearestClearance = Number.POSITIVE_INFINITY
    let nearestChannelDistance = Number.POSITIVE_INFINITY
    const clearanceStep = Math.max(COLLISION_SAMPLE_STEP, CLEARANCE_SAMPLE_STEP)
    for (let distance = 0; distance <= segment.length; distance += COLLISION_SAMPLE_STEP) {
        const pose = sampleMotionPath([segment], distance)
        const poseAnalysis = analyzePose(pose, plannerContext)
        if (!poseAnalysis.isCollisionFree) {
            return {
                isCollisionFree: false,
                nearestClearance: 0,
                nearestChannelDistance: Number.POSITIVE_INFINITY
            }
        }
        if (distance === 0 || distance >= segment.length || distance % clearanceStep === 0) {
            nearestClearance = Math.min(nearestClearance, poseAnalysis.clearance)
            nearestChannelDistance = Math.min(nearestChannelDistance, poseAnalysis.channelDistance)
        }
    }

    const endPoseAnalysis = analyzePose(segment.endPose, plannerContext)
    if (!endPoseAnalysis.isCollisionFree) {
        return {
            isCollisionFree: false,
            nearestClearance: 0,
            nearestChannelDistance: Number.POSITIVE_INFINITY
        }
    }

    return {
        isCollisionFree: true,
        nearestClearance: Math.min(nearestClearance, endPoseAnalysis.clearance),
        nearestChannelDistance: Math.min(nearestChannelDistance, endPoseAnalysis.channelDistance)
    }
}

function analyzePose(
    pose: BoatPose,
    plannerContext: PlannerContext
): { isCollisionFree: boolean; clearance: number; channelDistance: number } {
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
            clearance: 0,
            channelDistance: Number.POSITIVE_INFINITY
        }
    }

    for (const obstacle of obstacles) {
        if (!boundsOverlap(boatBounds, obstacle.bounds)) {
            continue
        }
        if (polygonsIntersect(boatPolygon, obstacle.polygon)) {
            return {
                isCollisionFree: false,
                clearance: 0,
                channelDistance: Number.POSITIVE_INFINITY
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
                clearance: 0,
                channelDistance: Number.POSITIVE_INFINITY
            }
        }
    }

    let nearest = Number.POSITIVE_INFINITY
    const forwardX = Math.cos(pose.heading)
    const forwardY = Math.sin(pose.heading)
    const rightX = Math.cos(pose.heading + Math.PI / 2)
    const rightY = Math.sin(pose.heading + Math.PI / 2)
    const hullProbePoints: Point[] = [
        pose,
        {
            x: pose.x + forwardX * geometry.boatHeight * 0.35,
            y: pose.y + forwardY * geometry.boatHeight * 0.35
        },
        {
            x: pose.x - forwardX * geometry.boatHeight * 0.35,
            y: pose.y - forwardY * geometry.boatHeight * 0.35
        }
    ]

    for (const obstacle of obstacles) {
        for (const probePoint of hullProbePoints) {
            nearest = Math.min(nearest, distanceFromPointToPolygon(probePoint, obstacle.polygon))
        }
    }

    for (const occupiedPolygon of occupiedBoatPolygons) {
        for (const probePoint of hullProbePoints) {
            nearest = Math.min(nearest, distanceFromPointToPolygon(probePoint, occupiedPolygon))
        }
    }

    return {
        isCollisionFree: true,
        clearance: nearest,
        channelDistance: getNearestTransitChannelDistance(pose, plannerContext.preferredTransitChannel)
    }
}

function getNearestTransitChannelDistance(
    pose: BoatPose,
    preferredTransitChannel: TransitChannel | undefined
): number {
    if (!preferredTransitChannel) {
        return 0
    }

    const dx = Math.max(0, Math.abs(pose.x - preferredTransitChannel.x) - preferredTransitChannel.width / 2)
    const dy = Math.max(0, Math.abs(pose.y - preferredTransitChannel.y) - preferredTransitChannel.height / 2)
    return Math.hypot(dx, dy)
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

function withPreferredTransitChannel(
    plannerContext: PlannerContext,
    preferredTransitChannel: TransitChannel
): PlannerContext {
    return {
        ...plannerContext,
        preferredTransitChannel
    }
}

function isDockSlot(endpoint: RouteEndpoint): endpoint is DockSlot {
    return 'dockedPose' in endpoint
}

function isOpenWaterSlot(endpoint: RouteEndpoint): endpoint is OpenWaterSlot {
    return endpoint.family === 'open-water'
}
