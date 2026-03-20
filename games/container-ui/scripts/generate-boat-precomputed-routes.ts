import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { buildBoardLayout } from '../src/lib/definitions/boardLayout.js'
import {
    buildBoatNavigationGeometry,
    type RouteEndpoint
} from '../src/lib/definitions/boatNavigation.js'
import { buildRoutePlan } from '../src/lib/definitions/boatPlanner.js'
import {
    getBoatRouteKey,
    getBoatRouteLayoutKey,
    isGameplayRelevantBoatRoute,
    type BoatRouteLayoutKey
} from '../src/lib/definitions/boatRouteKeys.js'
import {
    getFilledRouteOccupiedBoatPoses
} from '../src/lib/definitions/boatRouteOccupancy.js'
import {
    serializeBoatRoutePlan,
    type PrecomputedBoatRoutesFile
} from '../src/lib/definitions/boatRouteSerialization.js'

type LayoutSpec = {
    playerCount: 3 | 4 | 5
    hasOffshore: boolean
}

const LAYOUT_SPECS: Record<BoatRouteLayoutKey, LayoutSpec> = {
    '3p-no-offshore': { playerCount: 3, hasOffshore: false },
    '3p-offshore': { playerCount: 3, hasOffshore: true },
    '4p-no-offshore': { playerCount: 4, hasOffshore: false },
    '4p-offshore': { playerCount: 4, hasOffshore: true },
    '5p-no-offshore': { playerCount: 5, hasOffshore: false },
    '5p-offshore': { playerCount: 5, hasOffshore: true }
}
const PROGRESS_UPDATE_INTERVAL = 10

function parseFlag(name: string): string | undefined {
    const index = process.argv.indexOf(name)
    return index >= 0 ? process.argv[index + 1] : undefined
}

function ensureParentDir(path: string): void {
    mkdirSync(dirname(path), { recursive: true })
}

function writeJson(path: string, value: unknown): void {
    ensureParentDir(path)
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function getPlayerIds(playerCount: 3 | 4 | 5): string[] {
    return Array.from({ length: playerCount }, (_, index) => `p${index + 1}`)
}

function getAllRouteEndpoints(layoutKey: BoatRouteLayoutKey): RouteEndpoint[] {
    const spec = LAYOUT_SPECS[layoutKey]
    const layout = buildBoardLayout(getPlayerIds(spec.playerCount), {
        hasOffshore: spec.hasOffshore
    })
    const navigation = buildBoatNavigationGeometry(layout)

    return [
        ...navigation.playerBoardDockSlots,
        ...navigation.mainIslandDockSlots,
        ...navigation.offshoreDockSlots,
        ...navigation.openWaterSlots
    ]
}

function buildPrecomputedRoutesFile(
    layoutKey: BoatRouteLayoutKey,
    progressPath?: string
): PrecomputedBoatRoutesFile {
    const endpoints = getAllRouteEndpoints(layoutKey)
    const spec = LAYOUT_SPECS[layoutKey]
    const layout = buildBoardLayout(getPlayerIds(spec.playerCount), {
        hasOffshore: spec.hasOffshore
    })
    const navigation = buildBoatNavigationGeometry(layout)
    const routes: Record<string, ReturnType<typeof serializeBoatRoutePlan>> = {}
    const relevantPairs = endpoints.flatMap((start) =>
        endpoints
            .filter((end) => isGameplayRelevantBoatRoute(start, end))
            .map((end) => ({ start, end }))
    )
    let completedRoutes = 0

    for (const { start, end } of relevantPairs) {
        const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(endpoints, [
            start.id,
            end.id
        ])
        const plan = buildRoutePlan(start, end, navigation, occupiedBoatPoses)

        if (!plan) {
            throw new Error(`Missing route for ${layoutKey}: ${start.id} -> ${end.id}`)
        }

        routes[getBoatRouteKey(start.id, end.id)] = serializeBoatRoutePlan(plan)
        completedRoutes += 1

        if (progressPath && completedRoutes % PROGRESS_UPDATE_INTERVAL === 0) {
            writeJson(progressPath, {
                layoutKey,
                completedRoutes,
                totalRoutes: relevantPairs.length,
                currentRoute: `${start.id}->${end.id}`
            })
        }
    }

    return {
        layoutKey,
        routeCount: Object.keys(routes).length,
        generatedAt: new Date().toISOString(),
        routes
    }
}

function main(): void {
    const layoutKeyArg = parseFlag('--layout')
    if (!layoutKeyArg || !(layoutKeyArg in LAYOUT_SPECS)) {
        throw new Error(
            `Missing or invalid --layout. Expected one of: ${Object.keys(LAYOUT_SPECS).join(', ')}`
        )
    }

    const layoutKey = layoutKeyArg as BoatRouteLayoutKey
    const outputPath = resolve(
        parseFlag('--output') ??
            `src/lib/definitions/precomputedBoatRoutes/${layoutKey}.json`
    )
    const progressPath = parseFlag('--progress')
        ? resolve(parseFlag('--progress')!)
        : resolve(`/tmp/${layoutKey}-precompute-progress.json`)
    const precomputedRoutesFile = buildPrecomputedRoutesFile(layoutKey, progressPath)

    ensureParentDir(outputPath)
    writeFileSync(outputPath, JSON.stringify(precomputedRoutesFile))
    console.log(
        JSON.stringify(
            {
                layoutKey,
                routeCount: precomputedRoutesFile.routeCount,
                outputPath
            },
            null,
            2
        )
    )
}

main()
