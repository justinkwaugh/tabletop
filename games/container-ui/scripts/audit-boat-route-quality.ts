import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildBoardLayout } from '../src/lib/definitions/boardLayout.js'
import {
    buildBoatNavigationGeometry,
    type NavigationObstacle,
    type RouteEndpoint,
    type TransitChannel
} from '../src/lib/definitions/boatNavigation.js'
import { getPolygonBounds, distanceFromPointToPolygon } from '../src/lib/definitions/geometry2d.js'
import { getMotionPathLength, sampleMotionPath, type BoatPose } from '../src/lib/definitions/boatMotion.js'
import { getPrecomputedBoatRoutePlanForEndpoints } from '../src/lib/definitions/boatPrecomputedRoutes.js'
import {
    isGameplayRelevantBoatRoute,
    type BoatRouteLayoutKey
} from '../src/lib/definitions/boatRouteKeys.js'

type LayoutSpec = {
    playerCount: 3 | 4 | 5
    hasOffshore: boolean
}

type SampleMetrics = {
    distanceAlong: number
    pose: BoatPose
    distanceToDestination: number
    distanceToIsland: number
    nearestChannelDistance: number
}

type RouteQualityFinding = {
    routeKey: string
    length: number
    middleChannelFraction: number
    middleNearIslandFraction: number
    middleAverageIslandDistance: number
    destinationLoopBacktrack: number
    destinationLateLength: number
    score: number
    flags: string[]
}

type AuditReport = {
    layoutKey: BoatRouteLayoutKey
    routeCount: number
    flaggedCount: number
    findings: RouteQualityFinding[]
}

const LAYOUT_SPECS: Record<BoatRouteLayoutKey, LayoutSpec> = {
    '3p-no-offshore': { playerCount: 3, hasOffshore: false },
    '3p-offshore': { playerCount: 3, hasOffshore: true },
    '4p-no-offshore': { playerCount: 4, hasOffshore: false },
    '4p-offshore': { playerCount: 4, hasOffshore: true },
    '5p-no-offshore': { playerCount: 5, hasOffshore: false },
    '5p-offshore': { playerCount: 5, hasOffshore: true }
}

const DEFAULT_LAYOUT_KEY: BoatRouteLayoutKey = '3p-no-offshore'
const DEFAULT_OUTPUT_PATH = '/tmp/container-boat-route-quality.json'
const SAMPLE_STEP = 36
const MIDDLE_START_FRACTION = 0.2
const MIDDLE_END_FRACTION = 0.8
const ISLAND_HUG_DISTANCE = 150
const CHANNEL_USE_DISTANCE = 36
const DESTINATION_NEAR_DISTANCE = 220
const DESTINATION_REEXIT_DISTANCE = 320
const DESTINATION_LOOP_BACKTRACK_THRESHOLD = 120
const DESTINATION_LOOP_OUTSIDE_LENGTH_THRESHOLD = 180

function parseFlag(name: string): string | undefined {
    const index = process.argv.indexOf(name)
    return index >= 0 ? process.argv[index + 1] : undefined
}

function getPlayerIds(playerCount: 3 | 4 | 5): string[] {
    return Array.from({ length: playerCount }, (_, index) => `p${index + 1}`)
}

function getEndpointFinalPose(endpoint: RouteEndpoint): BoatPose {
    return 'dockedPose' in endpoint ? endpoint.dockedPose : endpoint.parkedPose
}

function getNearestChannelDistance(pose: BoatPose, channels: TransitChannel[]): number {
    if (channels.length === 0) {
        return Number.POSITIVE_INFINITY
    }

    return Math.min(
        ...channels.map((channel) => {
            const dx = Math.max(0, Math.abs(pose.x - channel.x) - channel.width / 2)
            const dy = Math.max(0, Math.abs(pose.y - channel.y) - channel.height / 2)
            return Math.hypot(dx, dy)
        })
    )
}

function getDistanceToObstacle(pose: BoatPose, obstacle: NavigationObstacle): number {
    return distanceFromPointToPolygon({ x: pose.x, y: pose.y }, obstacle.polygon)
}

function buildSampleMetrics(
    start: RouteEndpoint,
    end: RouteEndpoint,
    channels: TransitChannel[],
    islandObstacle: NavigationObstacle,
    planLength: number,
    sampleAt: (distance: number) => BoatPose
): SampleMetrics[] {
    const samples: SampleMetrics[] = []
    const endPose = getEndpointFinalPose(end)

    for (let distance = 0; distance <= planLength; distance += SAMPLE_STEP) {
        const pose = sampleAt(distance)
        samples.push({
            distanceAlong: distance,
            pose,
            distanceToDestination: Math.hypot(endPose.x - pose.x, endPose.y - pose.y),
            distanceToIsland: getDistanceToObstacle(pose, islandObstacle),
            nearestChannelDistance: getNearestChannelDistance(pose, channels)
        })
    }

    const finalPose = sampleAt(planLength)
    if (samples.length === 0 || samples.at(-1)!.distanceAlong !== planLength) {
        samples.push({
            distanceAlong: planLength,
            pose: finalPose,
            distanceToDestination: Math.hypot(endPose.x - finalPose.x, endPose.y - finalPose.y),
            distanceToIsland: getDistanceToObstacle(finalPose, islandObstacle),
            nearestChannelDistance: getNearestChannelDistance(finalPose, channels)
        })
    }

    return samples
}

function evaluateRouteQuality(
    routeKey: string,
    start: RouteEndpoint,
    end: RouteEndpoint,
    channels: TransitChannel[],
    islandObstacle: NavigationObstacle,
    sampleAt: (distance: number) => BoatPose,
    length: number
): RouteQualityFinding | null {
    const samples = buildSampleMetrics(start, end, channels, islandObstacle, length, sampleAt)
    const middleSamples = samples.filter((sample) => {
        const fraction = length === 0 ? 0 : sample.distanceAlong / length
        return fraction >= MIDDLE_START_FRACTION && fraction <= MIDDLE_END_FRACTION
    })

    const middleChannelFraction =
        middleSamples.length > 0 ?
            middleSamples.filter((sample) => sample.nearestChannelDistance <= CHANNEL_USE_DISTANCE)
                .length / middleSamples.length
        :   0

    const middleNearIslandFraction =
        middleSamples.length > 0 ?
            middleSamples.filter((sample) => sample.distanceToIsland <= ISLAND_HUG_DISTANCE).length /
            middleSamples.length
        :   0

    const middleAverageIslandDistance =
        middleSamples.length > 0 ?
            middleSamples.reduce((sum, sample) => sum + sample.distanceToIsland, 0) /
            middleSamples.length
        :   Number.POSITIVE_INFINITY

    let destinationLoopBacktrack = 0
    let destinationLateLength = 0
    const insideDestination = samples.map(
        (sample) => sample.distanceToDestination <= DESTINATION_NEAR_DISTANCE
    )
    const insideRuns: Array<{ start: number; end: number }> = []
    let runStart = -1
    for (let index = 0; index < insideDestination.length; index += 1) {
        if (insideDestination[index] && runStart < 0) {
            runStart = index
        }
        if ((!insideDestination[index] || index === insideDestination.length - 1) && runStart >= 0) {
            const runEnd =
                insideDestination[index] && index === insideDestination.length - 1 ? index : index - 1
            insideRuns.push({ start: runStart, end: runEnd })
            runStart = -1
        }
    }

    if (insideRuns.length >= 2) {
        for (let runIndex = 0; runIndex < insideRuns.length - 1; runIndex += 1) {
            const currentRun = insideRuns[runIndex]!
            const nextRun = insideRuns[runIndex + 1]!
            const gapSamples = samples.slice(currentRun.end + 1, nextRun.start)
            if (gapSamples.length === 0) {
                continue
            }

            const maxGapDistance = Math.max(
                ...gapSamples.map((sample) => sample.distanceToDestination)
            )
            const gapLength =
                samples[nextRun.start]!.distanceAlong - samples[currentRun.end]!.distanceAlong
            const backtrack = maxGapDistance - DESTINATION_NEAR_DISTANCE

            if (
                maxGapDistance >= DESTINATION_REEXIT_DISTANCE &&
                backtrack >= DESTINATION_LOOP_BACKTRACK_THRESHOLD &&
                gapLength >= DESTINATION_LOOP_OUTSIDE_LENGTH_THRESHOLD
            ) {
                destinationLoopBacktrack = Math.max(destinationLoopBacktrack, backtrack)
                destinationLateLength = Math.max(
                    destinationLateLength,
                    length - samples[currentRun.start]!.distanceAlong
                )
            }
        }
    }

    const flags: string[] = []
    if (
        middleNearIslandFraction >= 0.35 &&
        middleChannelFraction <= 0.1 &&
        middleAverageIslandDistance <= ISLAND_HUG_DISTANCE
    ) {
        flags.push('avoids-channels')
    }

    if (destinationLoopBacktrack > 0) {
        flags.push('loops-near-destination')
    }

    if (flags.length === 0) {
        return null
    }

    return {
        routeKey,
        length: Math.round(length * 10) / 10,
        middleChannelFraction: Math.round(middleChannelFraction * 1000) / 1000,
        middleNearIslandFraction: Math.round(middleNearIslandFraction * 1000) / 1000,
        middleAverageIslandDistance: Math.round(middleAverageIslandDistance * 10) / 10,
        destinationLoopBacktrack: Math.round(destinationLoopBacktrack * 10) / 10,
        destinationLateLength: Math.round(destinationLateLength * 10) / 10,
        score:
            Math.round(
                (
                    (1 - middleChannelFraction) * 200 +
                    middleNearIslandFraction * 160 +
                    destinationLoopBacktrack +
                    destinationLateLength * 0.2
                ) * 10
            ) / 10,
        flags
    }
}

function main(): void {
    const layoutKeyArg = parseFlag('--layout') ?? DEFAULT_LAYOUT_KEY
    if (!(layoutKeyArg in LAYOUT_SPECS)) {
        throw new Error(`Invalid --layout: ${layoutKeyArg}`)
    }

    const layoutKey = layoutKeyArg as BoatRouteLayoutKey
    const outputPath = resolve(parseFlag('--output') ?? DEFAULT_OUTPUT_PATH)
    const spec = LAYOUT_SPECS[layoutKey]
    const layout = buildBoardLayout(getPlayerIds(spec.playerCount), {
        hasOffshore: spec.hasOffshore
    })
    const geometry = buildBoatNavigationGeometry(layout)
    const endpoints = [
        ...geometry.playerBoardDockSlots,
        ...geometry.mainIslandDockSlots,
        ...geometry.offshoreDockSlots,
        ...geometry.openWaterSlots
    ]
    const islandObstacle = geometry.obstacles.find((obstacle) => obstacle.id === 'main-island')
    if (!islandObstacle) {
        throw new Error('Missing main island obstacle')
    }

    const findings: RouteQualityFinding[] = []
    let routeCount = 0

    for (const start of endpoints) {
        for (const end of endpoints) {
            if (!isGameplayRelevantBoatRoute(start, end)) {
                continue
            }

            const route = getPrecomputedBoatRoutePlanForEndpoints(geometry, start, end)
            if (!route) {
                throw new Error(`Missing route for ${start.canonicalId} -> ${end.canonicalId}`)
            }

            routeCount += 1
            const routeLength = getMotionPathLength(route.segments)
            const finding = evaluateRouteQuality(
                `${start.canonicalId}->${end.canonicalId}`,
                start,
                end,
                geometry.transitChannels,
                islandObstacle,
                (distance) => sampleMotionPath(route.segments, distance),
                routeLength
            )

            if (finding) {
                findings.push(finding)
            }
        }
    }

    findings.sort((a, b) => b.score - a.score)

    const report: AuditReport = {
        layoutKey,
        routeCount,
        flaggedCount: findings.length,
        findings
    }

    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
    console.log(
        JSON.stringify(
            {
                layoutKey,
                routeCount,
                flaggedCount: findings.length,
                outputPath
            },
            null,
            2
        )
    )
}

main()
