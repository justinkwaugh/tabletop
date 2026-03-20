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

export type RouteSmoothingMode = 'none' | 'conservative' | 'aggressive'

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
const FOUR_PLAYER_MAIN_HARBOR_CHANNEL_OFFSET_X = 220
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
    const smoothingMode = getRouteSmoothingMode(start, end)
    const precomputedPlan = getPrecomputedBoatRoutePlanForEndpoints(geometry, start, end)
    if (precomputedPlan) {
        return smoothingMode === 'none'
            ? precomputedPlan
            : smoothRoutePlan(precomputedPlan, plannerContext, smoothingMode)
    }

    if (isDockSlot(start) && isDockSlot(end)) {
        const plan = buildDockTransferPlanWithContext(
            start,
            end,
            plannerContext,
            buildUndockCandidates(start, end.stagingPose)
        )
        return plan ? (smoothingMode === 'none' ? plan : smoothRoutePlan(plan, plannerContext, smoothingMode)) : null
    }

    if (isDockSlot(start) && isOpenWaterSlot(end)) {
        const standardPlan = evaluateDockToOpenWaterPlan(
            start,
            end,
            plannerContext,
            buildUndockCandidates(start, end.stagingPose)
        )
        if (standardPlan) {
            return smoothingMode === 'none' ?
                    standardPlan
                :   smoothRoutePlan(standardPlan, plannerContext, smoothingMode)
        }

        let fallbackPlan: BoatRoutePlan | null = null

        if (start.family === 'main-island-harbor') {
            fallbackPlan = evaluateDockToOpenWaterPlan(
                start,
                end,
                plannerContext,
                buildHarborExitUndockCandidates(start, end.stagingPose)
            )
        }

        return fallbackPlan
            ? smoothingMode === 'none'
                ? fallbackPlan
                : smoothRoutePlan(fallbackPlan, plannerContext, smoothingMode)
            : null
    }

    if (isOpenWaterSlot(start) && isDockSlot(end)) {
        const plan = buildOpenWaterToDockPlan(start, end, plannerContext)
        return plan ? (smoothingMode === 'none' ? plan : smoothRoutePlan(plan, plannerContext, smoothingMode)) : null
    }

    if (isOpenWaterSlot(start) && isOpenWaterSlot(end)) {
        return null
    }

    return null
}

function getRouteSmoothingMode(start: RouteEndpoint, end: RouteEndpoint): RouteSmoothingMode {
    if (isOpenWaterSlot(start) && isOpenWaterSlot(end)) {
        return 'none'
    }

    if (isDockSlot(end) && end.family === 'main-island-harbor') {
        if (isDockSlot(start) && getPlayerBoardCanonicalSeatId(start) === 'p3') {
            return 'aggressive'
        }
        return 'conservative'
    }

    return 'aggressive'
}

export function getRouteSmoothingModeForPrecomputed(
    start: RouteEndpoint,
    end: RouteEndpoint
): RouteSmoothingMode {
    return getRouteSmoothingMode(start, end)
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

    const fourPlayerLanePlan = buildFourPlayerNoOffshoreMainHarborLanePlan(
        startDock,
        endDock,
        plannerContext
    )
    if (fourPlayerLanePlan) {
        return fourPlayerLanePlan
    }

    if (shouldUseFourPlayerNoOffshoreMainHarborBypass(plannerContext.geometry, startDock, endDock)) {
        const bypassPlan = buildFourPlayerNoOffshoreMainHarborBypassPlan(
            startDock,
            endDock,
            plannerContext,
            undockCandidates
        )
        if (bypassPlan) {
            return bypassPlan
        }
    }

    const structuredChannelPlan = buildStructuredChannelDockTransferPlan(
        startDock,
        endDock,
        plannerContext,
        undockCandidates
    )
    if (structuredChannelPlan) {
        return structuredChannelPlan
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
    const explicitFourPlayerPlan = buildFourPlayerNoOffshoreP4BottomOpenWaterPlan(
        startDock,
        endSlot,
        plannerContext
    )
    if (explicitFourPlayerPlan) {
        return explicitFourPlayerPlan
    }

    let filteredUndockCandidates = undockCandidates
    if (shouldForceTopDockToOpenWaterUndock4pNoOffshore(startDock, endSlot, plannerContext)) {
        const upwardCandidates = filteredUndockCandidates.filter(
            (candidate) => Math.sin(candidate.transitPose.heading) < -0.5
        )
        if (upwardCandidates.length > 0) {
            filteredUndockCandidates = upwardCandidates
        }
    }
    if (shouldForceBottomDockToOpenWaterUndock4pNoOffshore(startDock, endSlot, plannerContext)) {
        const downwardCandidates = filteredUndockCandidates.filter(
            (candidate) => Math.sin(candidate.transitPose.heading) > 0.5
        )
        if (downwardCandidates.length > 0) {
            filteredUndockCandidates = downwardCandidates
        }
    }

    const forcedChannelChain = selectDockToOpenWaterChannelChain(
        startDock,
        endSlot,
        plannerContext
    )
    let bestPlan: BoatRoutePlan | null = null

    for (const undockCandidate of filteredUndockCandidates) {
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
        const parkSegments = usesLegacyOpenWaterManeuverModel(plannerContext.geometry)
            ? [
                  ...poseConnection.goalSegments,
                  createStraightSegment(endSlot.stagingPose, endSlot.parkedPose, 'forward')
              ]
            : poseConnection.goalSegments

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

function buildFourPlayerNoOffshoreP4BottomOpenWaterPlan(
    startDock: DockSlot,
    endSlot: OpenWaterSlot,
    plannerContext: PlannerContext
): BoatRoutePlan | null {
    if (
        plannerContext.geometry.layoutKey !== '4p-no-offshore' ||
        getPlayerBoardCanonicalSeatId(startDock) !== 'p4' ||
        endSlot.parkedPose.y <= plannerContext.geometry.boardHeight / 2
    ) {
        return null
    }

    const downwardCandidates = buildUndockCandidates(startDock, endSlot.parkedPose).filter(
        (candidate) => Math.sin(candidate.transitPose.heading) > 0.35
    )

    let bestPlan: BoatRoutePlan | null = null

    for (const undockCandidate of downwardCandidates) {
        const finalConnection = findOpenWaterConnectionDirect(
            undockCandidate.transitPose,
            endSlot,
            plannerContext
        )
        if (!finalConnection) {
            continue
        }

        const undockSegments = [
            createStraightSegment(startDock.dockedPose, startDock.stagingPose, 'reverse'),
            ...undockCandidate.maneuverSegments
        ]

        const candidatePlan: BoatRoutePlan = {
            undockSegments,
            transitSegments: finalConnection.transitSegments,
            dockSegments: finalConnection.goalSegments,
            segments: [
                ...undockSegments,
                ...finalConnection.transitSegments,
                ...finalConnection.goalSegments
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

function buildOpenWaterToDockPlan(
    startSlot: OpenWaterSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext
): BoatRoutePlan | null {
    const forcedChannelChain = selectOpenWaterToDockChannelChain4pNoOffshore(
        startSlot,
        endDock,
        plannerContext
    )
    const preferredRightHarborCorridor = shouldPreferRightHarborCorridor(
        startSlot,
        endDock,
        plannerContext
    )
        ? buildRightHarborPreferredChannel(startSlot, endDock, plannerContext)
        : null
    let bestPlan: BoatRoutePlan | null = null

    for (const undockCandidate of buildOpenWaterUndockCandidates(
        startSlot,
        endDock.stagingPose,
        plannerContext
    )) {
        const dockConnection =
            forcedChannelChain.length > 0
                ? findExactDockConnectionViaChannelChain(
                      undockCandidate.transitPose,
                      endDock,
                      plannerContext,
                      forcedChannelChain
                  ) ??
                  (forcedChannelChain.length > 1
                      ? findExactDockConnectionViaChannelChain(
                            undockCandidate.transitPose,
                            endDock,
                            plannerContext,
                            [forcedChannelChain.at(-1)!]
                        )
                      : null) ??
                  findExactDockConnection(
                      undockCandidate.transitPose,
                      endDock,
                      plannerContext
                  )
                : preferredRightHarborCorridor
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
    const startPose = getOpenWaterStartPose(startSlot, plannerContext)

    return startPose.x > islandCenterX + 140 && endDock.stagingPose.x > islandCenterX + 140
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
        getOpenWaterStartPose(startSlot, plannerContext),
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
    const fourPlayerChannels = selectDockToOpenWaterChannelChain4pNoOffshore(
        startDock,
        endSlot,
        plannerContext
    )
    if (fourPlayerChannels.length > 0) {
        return fourPlayerChannels
    }

    const transitChannelsById = new Map(
        plannerContext.geometry.transitChannels.map((channel) => [channel.id, channel])
    )
    const leftMiddle = transitChannelsById.get('channel-left-middle')
    const bottomCenter = transitChannelsById.get('channel-bottom-center')
    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!leftMiddle || !bottomCenter || !mainIslandObstacle) {
        return []
    }

    const goalPose = getOpenWaterGoalPose(endSlot, plannerContext)
    const islandCenterX = (mainIslandObstacle.bounds.minX + mainIslandObstacle.bounds.maxX) / 2
    const islandCenterY = (mainIslandObstacle.bounds.minY + mainIslandObstacle.bounds.maxY) / 2
    const startIsLeft = startDock.stagingPose.x < islandCenterX - 220
    const endIsRight = goalPose.x > islandCenterX + 140
    const endIsLow = goalPose.y > islandCenterY + 180

    if (!startIsLeft || !endIsRight || !endIsLow) {
        return []
    }

    const startIsHigh = startDock.stagingPose.y < islandCenterY - 40
    return startIsHigh ? [leftMiddle, bottomCenter] : [bottomCenter]
}

function selectDockToOpenWaterChannelChain4pNoOffshore(
    startDock: DockSlot,
    endSlot: OpenWaterSlot,
    plannerContext: PlannerContext
): TransitChannel[] {
    if (plannerContext.geometry.layoutKey !== '4p-no-offshore') {
        return []
    }

    const transitChannelsById = new Map(
        plannerContext.geometry.transitChannels.map((channel) => [channel.id, channel])
    )
    const leftMiddle = transitChannelsById.get('channel-left-middle')
    const topCenter = transitChannelsById.get('channel-top-center')
    const bottomCenter = transitChannelsById.get('channel-bottom-center')
    const middleRightHarbor = buildFourPlayerMiddleRightHarborApproachChannel(plannerContext)
    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!leftMiddle || !topCenter || !bottomCenter || !mainIslandObstacle) {
        return []
    }

    const islandCenterY = (mainIslandObstacle.bounds.minY + mainIslandObstacle.bounds.maxY) / 2
    const startSeat = getPlayerBoardCanonicalSeatId(startDock)
    const targetIsTop = endSlot.parkedPose.y < islandCenterY
    const targetIsBottom = endSlot.parkedPose.y > islandCenterY

    if (startDock.family === 'main-island-harbor') {
        if (targetIsTop) {
            return middleRightHarbor ? [middleRightHarbor, topCenter] : [topCenter]
        }
        if (targetIsBottom) {
            return middleRightHarbor ? [middleRightHarbor, bottomCenter] : [bottomCenter]
        }
        return []
    }

    if (startDock.family !== 'player-board') {
        return []
    }

    if (targetIsTop) {
        if (startSeat === 'p1' || startSeat === 'p2') {
            return [topCenter]
        }
        if (startSeat === 'p4') {
            return [leftMiddle, topCenter]
        }
    }

    if (targetIsBottom) {
        if (startSeat === 'p4' || startSeat === 'p3') {
            return [bottomCenter]
        }
        if (startSeat === 'p1') {
            return [leftMiddle, bottomCenter]
        }
    }

    return []
}

function selectOpenWaterToDockChannelChain4pNoOffshore(
    startSlot: OpenWaterSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext
): TransitChannel[] {
    if (plannerContext.geometry.layoutKey !== '4p-no-offshore') {
        return []
    }

    const transitChannelsById = new Map(
        plannerContext.geometry.transitChannels.map((channel) => [channel.id, channel])
    )
    const leftMiddle = transitChannelsById.get('channel-left-middle')
    const topCenter = transitChannelsById.get('channel-top-center')
    const bottomCenter = transitChannelsById.get('channel-bottom-center')
    const middleRightHarbor = buildFourPlayerMiddleRightHarborApproachChannel(plannerContext)
    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!leftMiddle || !topCenter || !bottomCenter || !mainIslandObstacle) {
        return []
    }

    const islandCenterY = (mainIslandObstacle.bounds.minY + mainIslandObstacle.bounds.maxY) / 2
    const endSeat = getPlayerBoardCanonicalSeatId(endDock)
    const startIsTop = startSlot.parkedPose.y < islandCenterY
    const startIsBottom = startSlot.parkedPose.y > islandCenterY

    if (endDock.family === 'main-island-harbor') {
        if (startIsTop) {
            return middleRightHarbor ? [topCenter, middleRightHarbor] : [topCenter]
        }
        if (startIsBottom) {
            return middleRightHarbor ? [bottomCenter, middleRightHarbor] : [bottomCenter]
        }
        return []
    }

    if (endDock.family !== 'player-board') {
        return []
    }

    if (startIsTop) {
        if (endSeat === 'p1' || endSeat === 'p2') {
            return [topCenter]
        }
        if (endSeat === 'p4') {
            return [topCenter, leftMiddle]
        }
    }

    if (startIsBottom) {
        if (endSeat === 'p4' || endSeat === 'p3') {
            return [bottomCenter]
        }
        if (endSeat === 'p1') {
            return [bottomCenter, leftMiddle]
        }
    }

    return []
}

function getPlayerBoardCanonicalSeatId(dock: DockSlot): string | null {
    if (dock.family !== 'player-board') {
        return null
    }

    const match = /^p\d+/.exec(dock.canonicalId)
    return match?.[0] ?? null
}

function isUpperP1Dock(dock: DockSlot): boolean {
    return dock.family === 'player-board' && (dock.canonicalId === 'p1-dock-0' || dock.canonicalId === 'p1-dock-1')
}

function shouldForceTopStructuredUndock3pNoOffshore(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext
): boolean {
    return (
        plannerContext.geometry.layoutKey === '3p-no-offshore' &&
        getPlayerBoardCanonicalSeatId(startDock) === 'p1' &&
        endDock.family === 'main-island-harbor'
    )
}

function shouldForceBottomStructuredUndock3pNoOffshore(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext
): boolean {
    return (
        plannerContext.geometry.layoutKey === '3p-no-offshore' &&
        getPlayerBoardCanonicalSeatId(startDock) === 'p3' &&
        endDock.family === 'main-island-harbor'
    )
}

function shouldForceTopStructuredUndock4pNoOffshore(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext
): boolean {
    return (
        plannerContext.geometry.layoutKey === '4p-no-offshore' &&
        getPlayerBoardCanonicalSeatId(startDock) === 'p1' &&
        endDock.family === 'main-island-harbor'
    )
}

function shouldForceBottomStructuredUndock4pNoOffshore(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext
): boolean {
    return (
        plannerContext.geometry.layoutKey === '4p-no-offshore' &&
        getPlayerBoardCanonicalSeatId(startDock) === 'p4' &&
        endDock.family === 'main-island-harbor'
    )
}

function shouldForceTopDockToOpenWaterUndock4pNoOffshore(
    startDock: DockSlot,
    endSlot: OpenWaterSlot,
    plannerContext: PlannerContext
): boolean {
    if (
        plannerContext.geometry.layoutKey !== '4p-no-offshore' ||
        getPlayerBoardCanonicalSeatId(startDock) !== 'p1'
    ) {
        return false
    }

    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!mainIslandObstacle) {
        return false
    }

    const islandCenterY = (mainIslandObstacle.bounds.minY + mainIslandObstacle.bounds.maxY) / 2
    return endSlot.parkedPose.y < islandCenterY
}

function shouldForceBottomDockToOpenWaterUndock4pNoOffshore(
    startDock: DockSlot,
    endSlot: OpenWaterSlot,
    plannerContext: PlannerContext
): boolean {
    if (
        plannerContext.geometry.layoutKey !== '4p-no-offshore' ||
        getPlayerBoardCanonicalSeatId(startDock) !== 'p4'
    ) {
        return false
    }

    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!mainIslandObstacle) {
        return false
    }

    const islandCenterY = (mainIslandObstacle.bounds.minY + mainIslandObstacle.bounds.maxY) / 2
    return endSlot.parkedPose.y > islandCenterY
}

function usesLegacyOpenWaterManeuverModel(
    geometry: BoatNavigationGeometry
): boolean {
    return geometry.layoutKey === '3p-no-offshore'
}

function getOpenWaterGoalPose(
    endSlot: OpenWaterSlot,
    plannerContext: PlannerContext
): BoatPose {
    return usesLegacyOpenWaterManeuverModel(plannerContext.geometry)
        ? endSlot.stagingPose
        : endSlot.parkedPose
}

function getOpenWaterStartPose(
    startSlot: OpenWaterSlot,
    plannerContext: PlannerContext
): BoatPose {
    return usesLegacyOpenWaterManeuverModel(plannerContext.geometry)
        ? startSlot.stagingPose
        : startSlot.parkedPose
}

function buildTopRightTransitChannel(anchorChannel: TransitChannel): TransitChannel {
    return {
        id: 'implicit-top-right-lane',
        x: anchorChannel.x + anchorChannel.width / 2 - 60,
        y: anchorChannel.y,
        width: 120,
        height: anchorChannel.height
    }
}

function buildBottomRightTransitChannel(anchorChannel: TransitChannel): TransitChannel {
    return {
        id: 'implicit-bottom-right-lane',
        x: anchorChannel.x + anchorChannel.width / 2 - 60,
        y: anchorChannel.y,
        width: 120,
        height: anchorChannel.height
    }
}

function buildRightMainHarborApproachChannel(
    anchorChannel: TransitChannel,
    endDock: DockSlot,
    plannerContext: PlannerContext
): TransitChannel {
    return buildImplicitRightCorridor(
        {
            x: anchorChannel.x + anchorChannel.width / 2 - 40,
            y: anchorChannel.y,
            heading: 0
        },
        endDock.stagingPose,
        plannerContext,
        'implicit-right-main-harbor-approach'
    )
}

function buildFourPlayerMiddleRightHarborApproachChannel(
    plannerContext: PlannerContext
): TransitChannel | null {
    if (plannerContext.geometry.layoutKey !== '4p-no-offshore') {
        return null
    }

    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!mainIslandObstacle) {
        return null
    }

    const rightBoardObstacles = plannerContext.obstacles
        .filter(
            (obstacle) =>
                obstacle.id.startsWith('player-board-') &&
                obstacle.bounds.minX > mainIslandObstacle.bounds.maxX
        )
        .sort((a, b) => a.bounds.minY - b.bounds.minY)

    if (rightBoardObstacles.length < 2) {
        return null
    }

    const topRightBoard = rightBoardObstacles[0]!
    const bottomRightBoard = rightBoardObstacles.at(-1)!
    const gapWidth = topRightBoard.bounds.minX - mainIslandObstacle.bounds.maxX
    const gapHeight = bottomRightBoard.bounds.minY - topRightBoard.bounds.maxY
    if (gapWidth <= 80 || gapHeight <= 80) {
        return null
    }

    return {
        id: 'implicit-4p-middle-right-harbor-approach',
        x: mainIslandObstacle.bounds.maxX + gapWidth * 0.6,
        y: (topRightBoard.bounds.maxY + bottomRightBoard.bounds.minY) / 2,
        width: gapWidth - 50,
        height: gapHeight - 30
    }
}

function buildFourPlayerNoOffshoreMainHarborLanePlan(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext
): BoatRoutePlan | null {
    if (
        plannerContext.geometry.layoutKey !== '4p-no-offshore' ||
        startDock.family !== 'player-board' ||
        endDock.family !== 'main-island-harbor'
    ) {
        return null
    }

    const startSeat = getPlayerBoardCanonicalSeatId(startDock)
    if (startSeat !== 'p1' && startSeat !== 'p4') {
        return null
    }

    const transitChannelsById = new Map(
        plannerContext.geometry.transitChannels.map((channel) => [channel.id, channel])
    )
    const laneChannel =
        startSeat === 'p1'
            ? transitChannelsById.get('channel-top-center')
            : transitChannelsById.get('channel-bottom-center')
    const middleRightHarbor = buildFourPlayerMiddleRightHarborApproachChannel(plannerContext)
    if (!laneChannel || !middleRightHarbor) {
        return null
    }

    const desiredVerticalHeading = startSeat === 'p1' ? -Math.PI / 2 : Math.PI / 2
    const undockTargetPose: BoatPose = {
        x: startDock.stagingPose.x,
        y: laneChannel.y,
        heading: desiredVerticalHeading
    }
    const undockCandidates = buildUndockCandidates(startDock, undockTargetPose).filter((candidate) =>
        startSeat === 'p1'
            ? Math.sin(candidate.transitPose.heading) < -0.35
            : Math.sin(candidate.transitPose.heading) > 0.35
    )

    for (const undockCandidate of undockCandidates) {
        const transitSegments: BoatMotionSegment[] = []
        let currentPose = undockCandidate.transitPose

        const alignmentDelta = normalizeAngle(desiredVerticalHeading - currentPose.heading)
        if (Math.abs(alignmentDelta) > Math.PI / 24) {
            const alignmentArc = createForwardArcFromStartPose(
                currentPose,
                alignmentDelta,
                FOUR_PLAYER_MAIN_HARBOR_ARC_RADIUS
            )
            if (!analyzeSegment(alignmentArc, plannerContext).isCollisionFree) {
                continue
            }
            transitSegments.push(alignmentArc)
            currentPose = alignmentArc.endPose
        }

        const laneEntryPose: BoatPose = {
            x: currentPose.x,
            y: laneChannel.y,
            heading: desiredVerticalHeading
        }
        const toLaneVertical = createStraightSegment(currentPose, laneEntryPose, 'forward')
        const arcToHorizontal = createForwardArcFromStartPose(
            laneEntryPose,
            normalizeAngle(0 - desiredVerticalHeading),
            FOUR_PLAYER_MAIN_HARBOR_ARC_RADIUS
        )
        const acrossPose: BoatPose = {
            x: middleRightHarbor.x,
            y: arcToHorizontal.endPose.y,
            heading: 0
        }
        const acrossSegment = createStraightSegment(arcToHorizontal.endPose, acrossPose, 'forward')
        const skeletonSegments = [toLaneVertical, arcToHorizontal, acrossSegment]
        if (skeletonSegments.some((segment) => !analyzeSegment(segment, plannerContext).isCollisionFree)) {
            continue
        }
        transitSegments.push(...skeletonSegments)
        currentPose = acrossPose

        if (Math.abs(currentPose.y - middleRightHarbor.y) > 1) {
            const gapVerticalHeading = middleRightHarbor.y >= currentPose.y ? Math.PI / 2 : -Math.PI / 2
            const arcIntoGap = createForwardArcFromStartPose(
                currentPose,
                normalizeAngle(gapVerticalHeading - currentPose.heading),
                FOUR_PLAYER_MAIN_HARBOR_ARC_RADIUS
            )
            const gapPose: BoatPose = {
                x: arcIntoGap.endPose.x,
                y: middleRightHarbor.y,
                heading: gapVerticalHeading
            }
            const gapVertical = createStraightSegment(arcIntoGap.endPose, gapPose, 'forward')
            if (
                !analyzeSegment(arcIntoGap, plannerContext).isCollisionFree ||
                !analyzeSegment(gapVertical, plannerContext).isCollisionFree
            ) {
                continue
            }
            transitSegments.push(arcIntoGap, gapVertical)
            currentPose = gapPose
        }

        const dockSegments = buildMiddleRightMainHarborDockSegments(
            currentPose,
            endDock.stagingPose,
            plannerContext
        )
        if (!dockSegments) {
            continue
        }

        const undockSegments = [
            createStraightSegment(startDock.dockedPose, startDock.stagingPose, 'reverse'),
            ...undockCandidate.maneuverSegments
        ]
        const finalDockSegment = createStraightSegment(endDock.stagingPose, endDock.dockedPose, 'forward')

        return {
            undockSegments,
            transitSegments,
            dockSegments: [...dockSegments, finalDockSegment],
            segments: [...undockSegments, ...transitSegments, ...dockSegments, finalDockSegment]
        }
    }

    return null
}

function selectStructuredDockChannelChain3pNoOffshore(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext
): TransitChannel[] {
    if (plannerContext.geometry.layoutKey !== '3p-no-offshore') {
        return []
    }

    const transitChannelsById = new Map(
        plannerContext.geometry.transitChannels.map((channel) => [channel.id, channel])
    )
    const leftMiddle = transitChannelsById.get('channel-left-middle')
    const topCenter = transitChannelsById.get('channel-top-center')
    const bottomCenter = transitChannelsById.get('channel-bottom-center')
    const mainIslandObstacle = plannerContext.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!leftMiddle || !topCenter || !bottomCenter || !mainIslandObstacle) {
        return []
    }

    const islandCenterY = (mainIslandObstacle.bounds.minY + mainIslandObstacle.bounds.maxY) / 2
    const startPlayerSeat = getPlayerBoardCanonicalSeatId(startDock)
    const endPlayerSeat = getPlayerBoardCanonicalSeatId(endDock)
    const startIsUpperHarbor =
        startDock.family === 'main-island-harbor' && startDock.stagingPose.y < islandCenterY

    if (startPlayerSeat === 'p1' && endDock.family === 'main-island-harbor') {
        const topRight = buildTopRightTransitChannel(topCenter)
        return [topRight, buildRightMainHarborApproachChannel(topRight, endDock, plannerContext)]
    }

    if (startPlayerSeat === 'p3' && endDock.family === 'main-island-harbor') {
        const bottomRight = buildBottomRightTransitChannel(bottomCenter)
        return [bottomRight, buildRightMainHarborApproachChannel(bottomRight, endDock, plannerContext)]
    }

    if (startDock.family === 'main-island-harbor' && endPlayerSeat === 'p1') {
        return startIsUpperHarbor ? [topCenter, leftMiddle] : [bottomCenter, leftMiddle]
    }

    if (startPlayerSeat === 'p2' && endPlayerSeat === 'p1') {
        return [topCenter, leftMiddle]
    }

    return []
}

function selectStructuredDockChannelChain4pNoOffshore(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext
): TransitChannel[] {
    if (plannerContext.geometry.layoutKey !== '4p-no-offshore') {
        return []
    }

    const transitChannelsById = new Map(
        plannerContext.geometry.transitChannels.map((channel) => [channel.id, channel])
    )
    const leftMiddle = transitChannelsById.get('channel-left-middle')
    const topCenter = transitChannelsById.get('channel-top-center')
    const bottomCenter = transitChannelsById.get('channel-bottom-center')
    const middleRightHarbor = buildFourPlayerMiddleRightHarborApproachChannel(plannerContext)
    if (!leftMiddle || !topCenter || !bottomCenter) {
        return []
    }

    const startPlayerSeat = getPlayerBoardCanonicalSeatId(startDock)
    const endPlayerSeat = getPlayerBoardCanonicalSeatId(endDock)

    if (startPlayerSeat === 'p1' && endDock.family === 'main-island-harbor') {
        return middleRightHarbor ? [topCenter, middleRightHarbor] : [topCenter]
    }

    if (startPlayerSeat === 'p4' && endDock.family === 'main-island-harbor') {
        return middleRightHarbor ? [bottomCenter, middleRightHarbor] : [bottomCenter]
    }

    if (startPlayerSeat === 'p2' && endDock.family === 'main-island-harbor') {
        return middleRightHarbor ? [middleRightHarbor] : [topCenter]
    }

    if (startPlayerSeat === 'p3' && endDock.family === 'main-island-harbor') {
        return middleRightHarbor ? [middleRightHarbor] : [bottomCenter]
    }

    if (startDock.family === 'main-island-harbor' && endPlayerSeat === 'p1') {
        return [topCenter, leftMiddle]
    }

    if (startDock.family === 'main-island-harbor' && endPlayerSeat === 'p4') {
        return [bottomCenter, leftMiddle]
    }

    if (startDock.family !== 'player-board' || endDock.family !== 'player-board') {
        return []
    }

    if (!startPlayerSeat || !endPlayerSeat || startPlayerSeat === endPlayerSeat) {
        return []
    }

    if (
        (startPlayerSeat === 'p1' && endPlayerSeat === 'p2') ||
        (startPlayerSeat === 'p2' && endPlayerSeat === 'p1')
    ) {
        return [topCenter]
    }

    if (
        (startPlayerSeat === 'p1' && endPlayerSeat === 'p4') ||
        (startPlayerSeat === 'p4' && endPlayerSeat === 'p1')
    ) {
        return [leftMiddle]
    }

    if (
        (startPlayerSeat === 'p3' && endPlayerSeat === 'p4') ||
        (startPlayerSeat === 'p4' && endPlayerSeat === 'p3')
    ) {
        return [bottomCenter]
    }

    if (startPlayerSeat === 'p4' && endPlayerSeat === 'p2') {
        return [leftMiddle, topCenter]
    }

    if (startPlayerSeat === 'p2' && endPlayerSeat === 'p4') {
        return [topCenter, leftMiddle]
    }

    if (startPlayerSeat === 'p1' && endPlayerSeat === 'p3') {
        return [leftMiddle, bottomCenter]
    }

    if (startPlayerSeat === 'p3' && endPlayerSeat === 'p1') {
        return [bottomCenter, leftMiddle]
    }

    return []
}

function selectStructuredDockChannelChain(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext
): TransitChannel[] {
    const channels3p = selectStructuredDockChannelChain3pNoOffshore(
        startDock,
        endDock,
        plannerContext
    )
    if (channels3p.length > 0) {
        return channels3p
    }

    return selectStructuredDockChannelChain4pNoOffshore(startDock, endDock, plannerContext)
}

function buildStructuredChannelDockTransferPlan(
    startDock: DockSlot,
    endDock: DockSlot,
    plannerContext: PlannerContext,
    undockCandidates: UndockManeuverCandidate[]
): BoatRoutePlan | null {
    const channels = selectStructuredDockChannelChain(startDock, endDock, plannerContext)
    if (channels.length === 0) {
        return null
    }

    const initialChannelTarget: BoatPose = {
        x: channels[0]!.x,
        y: channels[0]!.y,
        heading: 0
    }
    let structuredUndockCandidates = buildUndockCandidates(startDock, initialChannelTarget)
    if (shouldForceTopStructuredUndock3pNoOffshore(startDock, endDock, plannerContext)) {
        const upwardCandidates = structuredUndockCandidates.filter(
            (candidate) => Math.sin(candidate.transitPose.heading) < -0.5
        )
        if (upwardCandidates.length > 0) {
            structuredUndockCandidates = upwardCandidates
        }
    }
    if (shouldForceTopStructuredUndock4pNoOffshore(startDock, endDock, plannerContext)) {
        const upwardCandidates = structuredUndockCandidates.filter(
            (candidate) => Math.sin(candidate.transitPose.heading) < -0.5
        )
        if (upwardCandidates.length > 0) {
            structuredUndockCandidates = upwardCandidates
        }
    }
    if (shouldForceBottomStructuredUndock3pNoOffshore(startDock, endDock, plannerContext)) {
        const downwardCandidates = structuredUndockCandidates.filter(
            (candidate) => Math.sin(candidate.transitPose.heading) > 0.5
        )
        if (downwardCandidates.length > 0) {
            structuredUndockCandidates = downwardCandidates
        }
    }
    if (shouldForceBottomStructuredUndock4pNoOffshore(startDock, endDock, plannerContext)) {
        const downwardCandidates = structuredUndockCandidates.filter(
            (candidate) => Math.sin(candidate.transitPose.heading) > 0.5
        )
        if (downwardCandidates.length > 0) {
            structuredUndockCandidates = downwardCandidates
        }
    }
    let bestPlan = buildForcedChannelDockTransferPlan(
        startDock,
        endDock,
        plannerContext,
        structuredUndockCandidates,
        channels
    )

    if (startDock.family === 'main-island-harbor') {
        const harborExitPlan = buildForcedChannelDockTransferPlan(
            startDock,
            endDock,
            plannerContext,
            buildHarborExitUndockCandidates(startDock, initialChannelTarget),
            channels
        )

        if (
            harborExitPlan &&
            (!bestPlan ||
                getMotionPathLength(harborExitPlan.segments) < getMotionPathLength(bestPlan.segments))
        ) {
            bestPlan = harborExitPlan
        }
    }

    return bestPlan
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
    const shouldPreferHarborKTurn =
        plannerContext.geometry.layoutKey !== '3p-no-offshore' &&
        endDocks.some((endDock) => endDock.family === 'main-island-harbor')
    const primaryGoals = endDocks.flatMap((endDock) =>
        buildDockCandidates(endDock, startPose, {
            useHarborKTurn: shouldPreferHarborKTurn && endDock.family === 'main-island-harbor'
        }).map((candidate) => ({
            endDock,
            candidate
        }))
    )
    const primaryConnection = planTransitSegmentsToAnyGoal(
        startPose,
        primaryGoals,
        plannerContext
    )
    if (primaryConnection) {
        return primaryConnection
    }

    const fallbackGoals = endDocks.flatMap((endDock) =>
        buildDockCandidates(endDock, startPose, {
            useHarborKTurn: !shouldPreferHarborKTurn && endDock.family === 'main-island-harbor'
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
    const shouldPreferHarborKTurn =
        plannerContext.geometry.layoutKey !== '3p-no-offshore' &&
        endDock.family === 'main-island-harbor'
    const standardGoals = buildDockCandidates(endDock, startPose, {
        useHarborKTurn: shouldPreferHarborKTurn
    }).map((candidate) => ({
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
        useHarborKTurn: !shouldPreferHarborKTurn
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
        getOpenWaterGoalPose(endSlot, plannerContext),
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
    const endsOnRightSide = getOpenWaterGoalPose(endSlot, plannerContext).x > islandCenterX + 140

    if (startsOnRightSide && endsOnRightSide) {
        return false
    }

    return true
}

function findImmediateOpenWaterConnection(
    startPose: BoatPose,
    endSlot: OpenWaterSlot,
    plannerContext: PlannerContext
): { transitSegments: BoatMotionSegment[]; goalSegments: BoatMotionSegment[] } | null {
    type ImmediateOpenWaterConnection = {
        transitSegments: BoatMotionSegment[]
        goalSegments: BoatMotionSegment[]
        totalLength: number
    }

    let bestConnection: ImmediateOpenWaterConnection | null = null

    const goals = buildOpenWaterGoalCandidates(endSlot, startPose, plannerContext)

    const consider = (transitSegments: BoatMotionSegment[], goalSegments: BoatMotionSegment[]) => {
        const totalLength = getMotionPathLength([...transitSegments, ...goalSegments])
        if (!bestConnection || totalLength < bestConnection.totalLength) {
            bestConnection = { transitSegments, goalSegments, totalLength }
        }
    }

    for (const goal of goals) {
        const directGoalSegments = goal.completeFrom(startPose, plannerContext)
        if (directGoalSegments) {
            consider([], directGoalSegments)
        }

        for (const localSegment of expandSegments(startPose, true)) {
            if (!goal.allowsPose(localSegment.endPose)) {
                continue
            }

            const segmentAnalysis = analyzeSegment(localSegment, plannerContext)
            if (!segmentAnalysis.isCollisionFree) {
                continue
            }

            const goalSegments = goal.completeFrom(localSegment.endPose, plannerContext)
            if (!goalSegments) {
                continue
            }

            consider([localSegment], goalSegments)
        }
    }

    if (!bestConnection) {
        return null
    }

    const resolved = bestConnection as ImmediateOpenWaterConnection

    return {
        transitSegments: resolved.transitSegments,
        goalSegments: resolved.goalSegments
    }
}

function findOpenWaterConnectionDirect(
    startPose: BoatPose,
    endSlot: OpenWaterSlot,
    plannerContext: PlannerContext
): { transitSegments: BoatMotionSegment[]; goalSegments: BoatMotionSegment[] } | null {
    const immediateConnection = findImmediateOpenWaterConnection(
        startPose,
        endSlot,
        plannerContext
    )
    if (immediateConnection) {
        return immediateConnection
    }

    let bestConnection:
        | {
              transitSegments: BoatMotionSegment[]
              goalSegments: BoatMotionSegment[]
              totalLength: number
          }
        | null = null

    for (const goal of buildOpenWaterGoalCandidates(endSlot, startPose, plannerContext)) {
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

    const lastChannel = channels.at(-1)
    if (
        lastChannel?.id === 'implicit-4p-middle-right-harbor-approach' &&
        endDock.family === 'main-island-harbor'
    ) {
        const deterministicDockSegments = buildMiddleRightMainHarborDockSegments(
            currentPose,
            endDock.stagingPose,
            plannerContext
        )
        if (deterministicDockSegments) {
            return {
                transitSegments,
                dockSegments: deterministicDockSegments,
                endDock
            }
        }
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

    if (dock.family === 'player-board') {
        validCandidates.push(
            ...buildObliqueArcGoalCandidates(
                dock.stagingPose,
                config.turnRadius,
                preferredBearing,
                0.12
            )
        )
    }

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

const OBLIQUE_APPROACH_ANGLE_OFFSETS = [Math.PI / 6, Math.PI / 4]
const OPEN_WATER_PERPENDICULAR_RADIUS_MULTIPLIERS = [1, 1.35, 1.7]
const OPEN_WATER_REAR_CONE_HALF_ANGLE = Math.PI / 3
const OPEN_WATER_REAR_CONE_MIN_DISTANCE = 24
const OPEN_WATER_REAR_CONE_MAX_DISTANCE = 420
const OPEN_WATER_EXACT_GOAL_DISTANCE = 28
const OPEN_WATER_EXACT_ALIGNMENT_TOLERANCE = Math.PI / 48

function buildObliqueArcGoalCandidates(
    goalPose: BoatPose,
    turnRadius: number,
    preferredBearing: number,
    scoreBase: number
): DockManeuverCandidate[] {
    const candidates: DockManeuverCandidate[] = []
    const desiredDelta = normalizeAngle(preferredBearing - goalPose.heading)
    const preferredSign = desiredDelta >= 0 ? 1 : -1
    const signs = [preferredSign, -preferredSign] as const

    for (const angleOffset of OBLIQUE_APPROACH_ANGLE_OFFSETS) {
        for (const sign of signs) {
            const entryHeading = normalizeAngle(goalPose.heading - sign * angleOffset)
            const arcSegment = createArcToEndPose(
                goalPose,
                entryHeading,
                normalizeAngle(goalPose.heading - entryHeading),
                turnRadius
            )

            candidates.push({
                heuristicPose: arcSegment.startPose,
                estimateFrom: (pose) =>
                    estimateLaneHeuristic(pose, arcSegment.startPose, entryHeading),
                allowsPose: (pose) =>
                    allowsLanePose(pose, arcSegment.startPose, entryHeading),
                completeFrom: (currentPose, plannerContext) => {
                    const connector = buildLaneGoalConnectionSegments(
                        currentPose,
                        arcSegment.startPose,
                        entryHeading,
                        plannerContext
                    )
                    return connector ? [...connector, arcSegment] : null
                },
                score:
                    scoreBase +
                    Math.abs(normalizeAngle(preferredBearing - entryHeading)) * 0.05 +
                    (sign === preferredSign ? 0 : 0.02)
            })
        }
    }

    return candidates
}

function buildPerpendicularArcGoalCandidates(
    goalPose: BoatPose,
    preferredBearing: number,
    turnRadii: readonly number[],
    scoreBase: number
): DockManeuverCandidate[] {
    const perpendicularCandidates = buildPerpendicularCandidates(goalPose.heading, preferredBearing)
    const candidates: DockManeuverCandidate[] = []

    for (const candidateHeading of perpendicularCandidates) {
        for (const [radiusIndex, turnRadius] of turnRadii.entries()) {
            const arcSegment = createArcToEndPose(
                goalPose,
                candidateHeading.heading,
                normalizeAngle(goalPose.heading - candidateHeading.heading),
                turnRadius
            )

            candidates.push({
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
                score: scoreBase + candidateHeading.score + radiusIndex * 0.03
            })
        }
    }

    return candidates
}

function buildFlexiblePerpendicularGoalCandidates(
    goalPose: BoatPose,
    preferredBearing: number,
    turnRadii: readonly number[],
    alignmentTurnRadius: number,
    scoreBase: number
): DockManeuverCandidate[] {
    const perpendicularCandidates = buildPerpendicularCandidates(goalPose.heading, preferredBearing)
    const candidates: DockManeuverCandidate[] = []

    for (const candidateHeading of perpendicularCandidates) {
        for (const [radiusIndex, turnRadius] of turnRadii.entries()) {
            const finalArc = createArcToEndPose(
                goalPose,
                candidateHeading.heading,
                normalizeAngle(goalPose.heading - candidateHeading.heading),
                turnRadius
            )

            candidates.push({
                heuristicPose: finalArc.startPose,
                estimateFrom: (pose) =>
                    estimateLaneHeuristic(pose, finalArc.startPose, candidateHeading.heading),
                allowsPose: () => true,
                completeFrom: (currentPose, plannerContext) => {
                    const directConnector = buildLaneGoalConnectionSegments(
                        currentPose,
                        finalArc.startPose,
                        candidateHeading.heading,
                        plannerContext
                    )
                    if (directConnector) {
                        return [...directConnector, finalArc]
                    }

                    const laneShiftConnector = buildParallelLaneShiftGoalConnectionSegments(
                        currentPose,
                        finalArc.startPose,
                        candidateHeading.heading,
                        alignmentTurnRadius,
                        plannerContext
                    )
                    if (laneShiftConnector) {
                        return [...laneShiftConnector, finalArc]
                    }

                    const alignmentDelta = normalizeAngle(
                        candidateHeading.heading - currentPose.heading
                    )
                    if (
                        Math.abs(alignmentDelta) <= Math.PI / 24 ||
                        Math.abs(alignmentDelta) > Math.PI * 0.75
                    ) {
                        return null
                    }

                    const alignmentArc = createForwardArcFromStartPose(
                        currentPose,
                        alignmentDelta,
                        alignmentTurnRadius
                    )
                    if (!analyzeSegment(alignmentArc, plannerContext).isCollisionFree) {
                        return null
                    }

                    const laneConnector = buildLaneGoalConnectionSegments(
                        alignmentArc.endPose,
                        finalArc.startPose,
                        candidateHeading.heading,
                        plannerContext
                    )
                    return laneConnector ? [alignmentArc, ...laneConnector, finalArc] : null
                },
                score: scoreBase + candidateHeading.score + radiusIndex * 0.03
            })
        }
    }

    return candidates
}

function buildParallelLaneShiftGoalConnectionSegments(
    currentPose: BoatPose,
    goalPose: BoatPose,
    laneHeading: number,
    maxTurnRadius: number,
    plannerContext: PlannerContext
): BoatMotionSegment[] | null {
    if (
        Math.abs(normalizeAngle(currentPose.heading - laneHeading)) > GOAL_CONNECTION_HEADING_TOLERANCE ||
        Math.abs(normalizeAngle(goalPose.heading - laneHeading)) > GOAL_CONNECTION_HEADING_TOLERANCE
    ) {
        return null
    }

    const forwardUnit = {
        x: Math.cos(laneHeading),
        y: Math.sin(laneHeading)
    }
    const rightUnit = {
        x: Math.sin(laneHeading),
        y: -Math.cos(laneHeading)
    }
    const dx = goalPose.x - currentPose.x
    const dy = goalPose.y - currentPose.y
    const forwardDistance = dx * forwardUnit.x + dy * forwardUnit.y
    const lateralDistance = dx * rightUnit.x + dy * rightUnit.y

    if (forwardDistance <= 0 || Math.abs(lateralDistance) < 1) {
        return null
    }

    const radius = Math.min(
        maxTurnRadius,
        Math.abs(lateralDistance) / 2,
        forwardDistance / 2
    )
    if (radius < 24) {
        return null
    }

    const middleStraightLength = Math.abs(lateralDistance) - 2 * radius
    const finalStraightLength = forwardDistance - 2 * radius
    if (middleStraightLength < -1 || finalStraightLength < -1) {
        return null
    }

    const firstDelta = lateralDistance > 0 ? -Math.PI / 2 : Math.PI / 2
    const secondDelta = -firstDelta
    const firstArc = createForwardArcFromStartPose(currentPose, firstDelta, radius)

    const segments: BoatMotionSegment[] = [firstArc]
    let current = firstArc.endPose

    if (middleStraightLength > 1) {
        const middlePose: BoatPose = {
            x: current.x + Math.cos(current.heading) * middleStraightLength,
            y: current.y + Math.sin(current.heading) * middleStraightLength,
            heading: current.heading
        }
        const middleStraight = createStraightSegment(current, middlePose, 'forward')
        segments.push(middleStraight)
        current = middlePose
    }

    const secondArc = createForwardArcFromStartPose(current, secondDelta, radius)
    segments.push(secondArc)
    current = secondArc.endPose

    if (finalStraightLength > 1) {
        const laneGoalPose: BoatPose = {
            x: goalPose.x,
            y: goalPose.y,
            heading: laneHeading
        }
        const finalStraight = createStraightSegment(current, laneGoalPose, 'forward')
        segments.push(finalStraight)
    }

    for (const segment of segments) {
        if (!analyzeSegment(segment, plannerContext).isCollisionFree) {
            return null
        }
    }

    const finalPose = segments[segments.length - 1]!.endPose
    if (distanceBetween(finalPose, goalPose) > 2) {
        return null
    }

    return segments
}

function buildFlexibleOpenWaterFinishSegments(
    currentPose: BoatPose,
    parkedPose: BoatPose,
    plannerContext: PlannerContext
): BoatMotionSegment[] | null {
    const preferredBearing = Math.atan2(
        parkedPose.y - currentPose.y,
        parkedPose.x - currentPose.x
    )

    for (const angleOffset of [Math.PI / 6, Math.PI / 4, Math.PI / 3]) {
        const desiredDelta = normalizeAngle(preferredBearing - parkedPose.heading)
        const preferredSign = desiredDelta >= 0 ? 1 : -1
        const candidateHeading = normalizeAngle(parkedPose.heading + preferredSign * angleOffset)

        for (const multiplier of OPEN_WATER_PERPENDICULAR_RADIUS_MULTIPLIERS) {
            const finalRadius = OPEN_WATER_TURN_RADIUS * multiplier
            const finalArc = createArcToEndPose(
                parkedPose,
                candidateHeading,
                normalizeAngle(parkedPose.heading - candidateHeading),
                finalRadius
            )

            const directConnector = buildLaneGoalConnectionSegments(
                currentPose,
                finalArc.startPose,
                candidateHeading,
                plannerContext
            )
            if (directConnector) {
                return [...directConnector, finalArc]
            }

            const alignmentDelta = normalizeAngle(candidateHeading - currentPose.heading)
            if (Math.abs(alignmentDelta) > Math.PI / 24 && Math.abs(alignmentDelta) <= Math.PI * 0.75) {
                const initialArc = createForwardArcFromStartPose(
                    currentPose,
                    alignmentDelta,
                    OPEN_WATER_TURN_RADIUS
                )
                if (analyzeSegment(initialArc, plannerContext).isCollisionFree) {
                    const laneConnector = buildLaneGoalConnectionSegments(
                        initialArc.endPose,
                        finalArc.startPose,
                        candidateHeading,
                        plannerContext
                    )
                    if (laneConnector) {
                        return [initialArc, ...laneConnector, finalArc]
                    }
                }
            }
        }
    }

    const headingDelta = normalizeAngle(parkedPose.heading - currentPose.heading)
    if (Math.abs(headingDelta) > Math.PI * 0.85) {
        return null
    }

    for (const multiplier of OPEN_WATER_PERPENDICULAR_RADIUS_MULTIPLIERS) {
        const radius = OPEN_WATER_TURN_RADIUS * multiplier
        const finalArc = createArcToEndPose(parkedPose, currentPose.heading, headingDelta, radius)
        const connector = buildLaneGoalConnectionSegments(
            currentPose,
            finalArc.startPose,
            currentPose.heading,
            plannerContext
        )
        if (connector) {
            return [...connector, finalArc]
        }
    }

    return null
}

function isPoseWithinOpenWaterArrivalCone(currentPose: BoatPose, parkedPose: BoatPose): boolean {
    const dx = currentPose.x - parkedPose.x
    const dy = currentPose.y - parkedPose.y
    const distance = Math.hypot(dx, dy)
    if (distance < OPEN_WATER_REAR_CONE_MIN_DISTANCE || distance > OPEN_WATER_REAR_CONE_MAX_DISTANCE) {
        return false
    }

    const rearHeading = normalizeAngle(parkedPose.heading + Math.PI)
    const rearBearing = Math.atan2(dy, dx)
    if (Math.abs(normalizeAngle(rearBearing - rearHeading)) > OPEN_WATER_REAR_CONE_HALF_ANGLE) {
        return false
    }

    const approachBearing = Math.atan2(parkedPose.y - currentPose.y, parkedPose.x - currentPose.x)
    return Math.abs(normalizeAngle(currentPose.heading - approachBearing)) <= OPEN_WATER_REAR_CONE_HALF_ANGLE
}

function buildOpenWaterExactPoseGoalConnectionSegments(
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
    if (distance > OPEN_WATER_EXACT_GOAL_DISTANCE) {
        return null
    }
    if (distance === 0) {
        return []
    }

    const travelBearing = Math.atan2(dy, dx)
    const alignmentDelta = Math.abs(normalizeAngle(travelBearing - currentPose.heading))
    if (alignmentDelta > OPEN_WATER_EXACT_ALIGNMENT_TOLERANCE) {
        return null
    }

    const connector = createStraightSegment(currentPose, goalPose, 'forward')
    return analyzeSegment(connector, plannerContext).isCollisionFree ? [connector] : null
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
    sourcePose: BoatPose,
    plannerContext: PlannerContext
): DockManeuverCandidate[] {
    if (!usesLegacyOpenWaterManeuverModel(plannerContext.geometry)) {
        const parkedPose = endSlot.parkedPose
        const preferredBearing = Math.atan2(
            parkedPose.y - sourcePose.y,
            parkedPose.x - sourcePose.x
        )
        const validCandidates: DockManeuverCandidate[] = [
            {
                heuristicPose: parkedPose,
                estimateFrom: (pose) => heuristic(pose, parkedPose),
                allowsPose: () => true,
                completeFrom: (currentPose, plannerContext) =>
                    buildOpenWaterExactPoseGoalConnectionSegments(
                        currentPose,
                        parkedPose,
                        plannerContext
                    ),
                score: 0
            },
            {
                heuristicPose: parkedPose,
                estimateFrom: (pose) => heuristic(pose, parkedPose),
                allowsPose: () => true,
                completeFrom: (currentPose, plannerContext) =>
                    buildFlexibleOpenWaterFinishSegments(currentPose, parkedPose, plannerContext),
                score: 0.01
            },
            {
                heuristicPose: {
                    x: parkedPose.x - Math.cos(parkedPose.heading) * 180,
                    y: parkedPose.y - Math.sin(parkedPose.heading) * 180,
                    heading: parkedPose.heading
                },
                estimateFrom: (pose) => heuristic(pose, parkedPose),
                allowsPose: (pose) => isPoseWithinOpenWaterArrivalCone(pose, parkedPose),
                completeFrom: (currentPose, plannerContext) =>
                    isPoseWithinOpenWaterArrivalCone(currentPose, parkedPose)
                        ? buildFlexibleOpenWaterFinishSegments(currentPose, parkedPose, plannerContext)
                        : null,
                score: 0.02
            },
            ...OPEN_WATER_STRAIGHT_APPROACH_DISTANCES.map((approachDistance, index) => {
                const approachPose = {
                    x: parkedPose.x - Math.cos(parkedPose.heading) * approachDistance,
                    y: parkedPose.y - Math.sin(parkedPose.heading) * approachDistance,
                    heading: parkedPose.heading
                }

                return {
                    heuristicPose: approachPose,
                    estimateFrom: (pose: BoatPose) =>
                        estimateStraightLaneHeuristic(pose, approachPose),
                    allowsPose: () => true,
                    completeFrom: (currentPose: BoatPose, plannerContext: PlannerContext) => {
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
                            parkedPose,
                            'forward'
                        )
                        return analyzeSegment(finalStraight, plannerContext).isCollisionFree
                            ? [...connector, finalStraight]
                            : null
                    },
                    score: 0.08 + index * 0.01
                }
            })
        ]

        validCandidates.push(
            ...buildObliqueArcGoalCandidates(
                parkedPose,
                OPEN_WATER_TURN_RADIUS,
                preferredBearing,
                0.12
            ),
            ...buildFlexiblePerpendicularGoalCandidates(
                parkedPose,
                preferredBearing,
                OPEN_WATER_PERPENDICULAR_RADIUS_MULTIPLIERS.map(
                    (multiplier) => OPEN_WATER_TURN_RADIUS * multiplier
                ),
                OPEN_WATER_TURN_RADIUS,
                0.2
            )
        )

        return validCandidates.sort((a, b) => a.score - b.score)
    }

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
        geometry.layoutKey === '4p-no-offshore' &&
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

    const topBypassY = FOUR_PLAYER_TOP_HARBOR_CHANNEL_Y
    const bottomBypassY =
        mainIslandObstacle.bounds.maxY + FOUR_PLAYER_MAIN_HARBOR_CHANNEL_OFFSET_Y
    const topCost =
        Math.abs(startDock.stagingPose.y - topBypassY) + Math.abs(endDock.stagingPose.y - topBypassY)
    const bottomCost =
        Math.abs(startDock.stagingPose.y - bottomBypassY) +
        Math.abs(endDock.stagingPose.y - bottomBypassY)
    const bypassOrders =
        topCost <= bottomCost ? (['top', 'bottom'] as const) : (['bottom', 'top'] as const)

    for (const bypassSide of bypassOrders) {
        const bypassTargetPose: BoatPose = {
            x: startDock.stagingPose.x,
            y: bypassSide === 'top' ? topBypassY : bottomBypassY,
            heading: bypassSide === 'top' ? -Math.PI / 2 : Math.PI / 2
        }
        const bypassUndockCandidates = buildUndockCandidates(startDock, bypassTargetPose)
        const deterministicBypass = buildDeterministicMainHarborBypassSegments(
            startDock,
            endDock,
            plannerContext,
            bypassUndockCandidates.length > 0 ? bypassUndockCandidates : undockCandidates,
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

function buildMiddleRightMainHarborDockSegments(
    channelPose: BoatPose,
    stagingPose: BoatPose,
    plannerContext: PlannerContext
): BoatMotionSegment[] | null {
    const verticalHeading = stagingPose.y >= channelPose.y ? Math.PI / 2 : -Math.PI / 2
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

    for (const segment of segments) {
        if (!analyzeSegment(segment, plannerContext).isCollisionFree) {
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

    for (const undockCandidate of undockCandidates) {
        const bypassTransitSegments: BoatMotionSegment[] = []
        let laneStartPose = undockCandidate.transitPose
        const alignmentDelta = normalizeAngle(desiredVerticalHeading - laneStartPose.heading)

        if (Math.abs(alignmentDelta) > Math.PI / 24) {
            const alignmentArc = createForwardArcFromStartPose(
                laneStartPose,
                alignmentDelta,
                FOUR_PLAYER_MAIN_HARBOR_ARC_RADIUS
            )
            if (!analyzeSegment(alignmentArc, plannerContext).isCollisionFree) {
                continue
            }
            bypassTransitSegments.push(alignmentArc)
            laneStartPose = alignmentArc.endPose
        }

        const verticalPose: BoatPose = {
            x: laneStartPose.x,
            y:
                bypassSide === 'top'
                    ? FOUR_PLAYER_TOP_HARBOR_CHANNEL_Y
                    : islandBounds.maxY + FOUR_PLAYER_MAIN_HARBOR_CHANNEL_OFFSET_Y,
            heading: desiredVerticalHeading
        }
        const verticalSegment = createStraightSegment(
            laneStartPose,
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
        bypassTransitSegments.push(verticalSegment, arcToChannel, channelSegment)

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
    targetPose: BoatPose,
    plannerContext: PlannerContext
): UndockManeuverCandidate[] {
    if (!usesLegacyOpenWaterManeuverModel(plannerContext.geometry)) {
        return [
            {
                transitPose: startSlot.parkedPose,
                maneuverSegments: [],
                score: heuristic(startSlot.parkedPose, targetPose)
            }
        ]
    }

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

function smoothRoutePlan(
    plan: BoatRoutePlan,
    plannerContext: PlannerContext,
    mode: RouteSmoothingMode
): BoatRoutePlan {
    const transitSegments = smoothTransitSegments(plan.transitSegments, plannerContext, mode)
    return {
        ...plan,
        transitSegments,
        segments: [...plan.undockSegments, ...transitSegments, ...plan.dockSegments]
    }
}

export function smoothRoutePlanForPrecomputed(
    plan: BoatRoutePlan,
    geometry: BoatNavigationGeometry,
    occupiedBoatPoses: BoatPose[],
    mode: RouteSmoothingMode
): BoatRoutePlan {
    if (mode === 'none') {
        return plan
    }

    return smoothRoutePlan(plan, createPlannerContext(geometry, occupiedBoatPoses), mode)
}

function smoothTransitSegments(
    segments: BoatMotionSegment[],
    plannerContext: PlannerContext,
    mode: RouteSmoothingMode
): BoatMotionSegment[] {
    let smoothed = mergeConsecutiveTransitSegments(segments, plannerContext)
    if (mode !== 'aggressive') {
        return smoothed
    }

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
