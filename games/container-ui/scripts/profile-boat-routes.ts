import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { buildBoardLayout } from '../src/lib/definitions/boardLayout.js'
import {
    buildBoatNavigationGeometry,
    type DockSlot
} from '../src/lib/definitions/boatNavigation.js'
import { buildDockTransferPlan } from '../src/lib/definitions/boatPlanner.js'

type LayoutCase = {
    label: string
    playerCount: 3 | 4 | 5
    hasOffshore: boolean
}

type RouteTiming = {
    layout: string
    start: string
    end: string
    startFamily: DockSlot['family']
    endFamily: DockSlot['family']
    durationMs: number
    found: boolean
}

type LayoutSummary = {
    layout: string
    slotCount: number
    tested: number
    foundCount: number
    impossibleCount: number
    totalDurationMs: number
    averageDurationMs: number
    maxDurationMs: number
    slowestRoutes: RouteTiming[]
}

type ProgressSnapshot = {
    startedAt: string
    updatedAt: string
    completedLayouts: number
    totalLayouts: number
    testedRoutes: number
    totalRoutes: number
    currentLayout?: string
    currentRoute?: {
        start: string
        end: string
        testedInLayout: number
        totalInLayout: number
    }
}

type FinalReport = {
    startedAt: string
    finishedAt: string
    totalRoutes: number
    totalDurationMs: number
    layouts: LayoutSummary[]
    slowestRoutes: RouteTiming[]
    impossibleRoutes: RouteTiming[]
}

const LAYOUT_CASES: LayoutCase[] = [
    { label: '3p no offshore', playerCount: 3, hasOffshore: false },
    { label: '3p offshore', playerCount: 3, hasOffshore: true },
    { label: '4p no offshore', playerCount: 4, hasOffshore: false },
    { label: '4p offshore', playerCount: 4, hasOffshore: true },
    { label: '5p no offshore', playerCount: 5, hasOffshore: false },
    { label: '5p offshore', playerCount: 5, hasOffshore: true }
]

const DEFAULT_OUTPUT_PATH = '/tmp/container-boat-route-profile.json'
const DEFAULT_PROGRESS_PATH = '/tmp/container-boat-route-progress.json'
const PROGRESS_UPDATE_INTERVAL = 25
const SLOW_ROUTE_COUNT = 25

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

function playerIds(count: number): string[] {
    return Array.from({ length: count }, (_, index) => `p${index + 1}`)
}

function getLayoutSlots(layoutCase: LayoutCase): DockSlot[] {
    const layout = buildBoardLayout(playerIds(layoutCase.playerCount), {
        hasOffshore: layoutCase.hasOffshore
    })
    const navigation = buildBoatNavigationGeometry(layout)

    return [
        ...navigation.playerBoardDockSlots,
        ...navigation.mainIslandDockSlots,
        ...navigation.offshoreDockSlots
    ]
}

function getSlowestRoutes(routes: RouteTiming[]): RouteTiming[] {
    return [...routes]
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, SLOW_ROUTE_COUNT)
}

function main(): void {
    const outputPath = resolve(parseFlag('--output') ?? DEFAULT_OUTPUT_PATH)
    const progressPath = resolve(parseFlag('--progress') ?? DEFAULT_PROGRESS_PATH)
    const startedAt = new Date().toISOString()
    const totalRoutes = LAYOUT_CASES.reduce((total, layoutCase) => {
        const slotCount = getLayoutSlots(layoutCase).length
        return total + slotCount * (slotCount - 1)
    }, 0)

    let testedRoutes = 0
    const layoutSummaries: LayoutSummary[] = []
    const allRoutes: RouteTiming[] = []

    const writeProgress = (
        completedLayouts: number,
        currentLayout?: string,
        currentRoute?: ProgressSnapshot['currentRoute']
    ) => {
        const snapshot: ProgressSnapshot = {
            startedAt,
            updatedAt: new Date().toISOString(),
            completedLayouts,
            totalLayouts: LAYOUT_CASES.length,
            testedRoutes,
            totalRoutes,
            currentLayout,
            currentRoute
        }
        writeJson(progressPath, snapshot)
    }

    writeProgress(0)

    for (const [layoutIndex, layoutCase] of LAYOUT_CASES.entries()) {
        const layoutSlots = getLayoutSlots(layoutCase)
        const layout = buildBoardLayout(playerIds(layoutCase.playerCount), {
            hasOffshore: layoutCase.hasOffshore
        })
        const navigation = buildBoatNavigationGeometry(layout)
        const layoutRoutes: RouteTiming[] = []
        const layoutRouteTotal = layoutSlots.length * (layoutSlots.length - 1)
        let testedInLayout = 0
        const layoutStart = performance.now()

        for (const startDock of layoutSlots) {
            for (const endDock of layoutSlots) {
                if (startDock.id === endDock.id) {
                    continue
                }

                const routeStart = performance.now()
                const plan = buildDockTransferPlan(startDock, endDock, navigation, [])
                const durationMs = performance.now() - routeStart

                const routeTiming: RouteTiming = {
                    layout: layoutCase.label,
                    start: startDock.id,
                    end: endDock.id,
                    startFamily: startDock.family,
                    endFamily: endDock.family,
                    durationMs: Number(durationMs.toFixed(3)),
                    found: !!plan
                }

                layoutRoutes.push(routeTiming)
                allRoutes.push(routeTiming)
                testedRoutes += 1
                testedInLayout += 1

                if (testedInLayout % PROGRESS_UPDATE_INTERVAL === 0) {
                    writeProgress(layoutIndex, layoutCase.label, {
                        start: startDock.id,
                        end: endDock.id,
                        testedInLayout,
                        totalInLayout: layoutRouteTotal
                    })
                }
            }
        }

        const totalDurationMs = performance.now() - layoutStart
        const impossibleRoutes = layoutRoutes.filter((route) => !route.found)
        const summary: LayoutSummary = {
            layout: layoutCase.label,
            slotCount: layoutSlots.length,
            tested: layoutRoutes.length,
            foundCount: layoutRoutes.length - impossibleRoutes.length,
            impossibleCount: impossibleRoutes.length,
            totalDurationMs: Number(totalDurationMs.toFixed(3)),
            averageDurationMs: Number((totalDurationMs / layoutRoutes.length).toFixed(3)),
            maxDurationMs: Math.max(...layoutRoutes.map((route) => route.durationMs)),
            slowestRoutes: getSlowestRoutes(layoutRoutes)
        }

        layoutSummaries.push(summary)
        writeProgress(layoutIndex + 1)
    }

    const finishedAt = new Date().toISOString()
    const totalDurationMs = layoutSummaries.reduce(
        (total, layoutSummary) => total + layoutSummary.totalDurationMs,
        0
    )
    const report: FinalReport = {
        startedAt,
        finishedAt,
        totalRoutes,
        totalDurationMs: Number(totalDurationMs.toFixed(3)),
        layouts: layoutSummaries,
        slowestRoutes: getSlowestRoutes(allRoutes),
        impossibleRoutes: allRoutes.filter((route) => !route.found)
    }

    writeJson(outputPath, report)
    writeProgress(LAYOUT_CASES.length)
    console.log(
        JSON.stringify(
            {
                outputPath,
                progressPath,
                totalRoutes,
                totalDurationMs: report.totalDurationMs,
                impossibleRouteCount: report.impossibleRoutes.length,
                slowestRoutes: report.slowestRoutes.slice(0, 10)
            },
            null,
            2
        )
    )
}

main()
