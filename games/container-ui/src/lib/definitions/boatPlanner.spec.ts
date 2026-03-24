import { describe, expect, it } from 'vitest'
import { buildBoardLayout } from '$lib/definitions/boardLayout.js'
import { buildBoatNavigationGeometry } from '$lib/definitions/boatNavigation.js'
import { polygonsIntersect } from '$lib/definitions/geometry2d.js'
import { getBoatFootprintPolygon } from '$lib/definitions/boatNavigation.js'
import { buildDockTransferPlan, buildRoutePlan } from '$lib/definitions/boatPlanner.js'
import { getFilledRouteOccupiedBoatPoses } from '$lib/definitions/boatRouteOccupancy.js'
import { getMotionPathLength } from '$lib/definitions/boatMotion.js'

const THREE_PLAYER_NO_OFFSHORE_PREVIOUS_IMPOSSIBLES = [
    ['p1-dock-0', 'main-island-dock-0'],
    ['p1-dock-0', 'main-island-dock-2'],
    ['p1-dock-0', 'main-island-dock-3'],
    ['p1-dock-0', 'main-island-dock-4'],
    ['p1-dock-1', 'main-island-dock-0'],
    ['p1-dock-1', 'main-island-dock-1'],
    ['p1-dock-1', 'main-island-dock-2'],
    ['p1-dock-1', 'main-island-dock-3'],
    ['p1-dock-2', 'main-island-dock-0'],
    ['p1-dock-2', 'main-island-dock-4'],
    ['p1-dock-2', 'p2-dock-3'],
    ['p1-dock-3', 'main-island-dock-2'],
    ['p1-dock-3', 'main-island-dock-3'],
    ['p1-dock-3', 'main-island-dock-4'],
    ['p2-dock-2', 'p1-dock-3'],
    ['p2-dock-2', 'p3-dock-0'],
    ['p3-dock-0', 'main-island-dock-0'],
    ['p3-dock-0', 'main-island-dock-1'],
    ['p3-dock-0', 'main-island-dock-2'],
    ['p3-dock-0', 'main-island-dock-3'],
    ['p3-dock-0', 'main-island-dock-4'],
    ['p3-dock-0', 'p1-dock-3'],
    ['p3-dock-1', 'main-island-dock-0'],
    ['p3-dock-1', 'main-island-dock-1'],
    ['p3-dock-1', 'main-island-dock-2'],
    ['p3-dock-1', 'main-island-dock-3'],
    ['p3-dock-2', 'main-island-dock-0'],
    ['p3-dock-2', 'main-island-dock-1'],
    ['p3-dock-2', 'main-island-dock-3'],
    ['p3-dock-2', 'main-island-dock-4'],
    ['p3-dock-3', 'main-island-dock-2'],
    ['p3-dock-3', 'main-island-dock-3'],
    ['p3-dock-3', 'main-island-dock-4']
] as const

const THREE_PLAYER_OFFSHORE_PREVIOUS_IMPOSSIBLES = [
    ['main-island-dock-0', 'p1-dock-1']
] as const

const FOUR_PLAYER_OFFSHORE_PREVIOUS_IMPOSSIBLES = [
    ['main-island-dock-0', 'p1-dock-1'],
    ['offshore-dock-0', 'p3-dock-0'],
    ['offshore-dock-2', 'p3-dock-2'],
    ['offshore-dock-3', 'p3-dock-2']
] as const

const FOUR_PLAYER_NO_OFFSHORE_CROWDED_REGRESSIONS = [
    ['p1-dock-0', 'main-island-dock-1'],
    ['p2-dock-0', 'main-island-dock-2'],
    ['p3-dock-1', 'main-island-dock-1'],
    ['p4-dock-1', 'main-island-dock-4']
] as const

const FOUR_PLAYER_NO_OFFSHORE_ROUTE_REGRESSIONS = [
    ['p4-dock-0', 'main-island-dock-1'],
    ['p1-dock-0', 'open-water-0'],
    ['p1-dock-0', 'open-water-1'],
    ['p1-dock-2', 'open-water-0'],
    ['open-water-0', 'main-island-dock-0'],
    ['main-island-dock-0', 'open-water-0'],
    ['p4-dock-3', 'open-water-3']
] as const

const FOUR_PLAYER_NO_OFFSHORE_P1_BOTTOM_LEFT_OPEN_WATER_REGRESSIONS = [
    'p1-dock-0',
    'p1-dock-1',
    'p1-dock-2',
    'p1-dock-3'
] as const

const FOUR_PLAYER_NO_OFFSHORE_P1_BOTTOM_RIGHT_OPEN_WATER_REGRESSIONS = [
    'p1-dock-0',
    'p1-dock-1',
    'p1-dock-2',
    'p1-dock-3'
] as const

const FOUR_PLAYER_NO_OFFSHORE_P4_TOP_LEFT_OPEN_WATER_REGRESSIONS = [
    'p4-dock-0',
    'p4-dock-1',
    'p4-dock-2',
    'p4-dock-3'
] as const

const FOUR_PLAYER_NO_OFFSHORE_P4_TOP_RIGHT_OPEN_WATER_REGRESSIONS = [
    'p4-dock-0',
    'p4-dock-1',
    'p4-dock-2',
    'p4-dock-3'
] as const

const FOUR_PLAYER_NO_OFFSHORE_P1_MAIN_HARBOR_REGRESSIONS = [
    ['p1-dock-0', 'main-island-dock-0'],
    ['p1-dock-0', 'main-island-dock-1'],
    ['p1-dock-0', 'main-island-dock-2'],
    ['p1-dock-0', 'main-island-dock-3'],
    ['p1-dock-1', 'main-island-dock-0'],
    ['p1-dock-1', 'main-island-dock-1'],
    ['p1-dock-1', 'main-island-dock-2'],
    ['p1-dock-1', 'main-island-dock-3'],
    ['p1-dock-2', 'main-island-dock-0'],
    ['p1-dock-2', 'main-island-dock-1'],
    ['p1-dock-2', 'main-island-dock-2'],
    ['p1-dock-2', 'main-island-dock-3'],
    ['p1-dock-3', 'main-island-dock-0'],
    ['p1-dock-3', 'main-island-dock-1'],
    ['p1-dock-3', 'main-island-dock-2'],
    ['p1-dock-3', 'main-island-dock-3']
] as const

const FOUR_PLAYER_NO_OFFSHORE_P4_MAIN_HARBOR_REGRESSIONS = [
    ['p4-dock-0', 'main-island-dock-0'],
    ['p4-dock-0', 'main-island-dock-1'],
    ['p4-dock-0', 'main-island-dock-2'],
    ['p4-dock-0', 'main-island-dock-3'],
    ['p4-dock-1', 'main-island-dock-0'],
    ['p4-dock-1', 'main-island-dock-1'],
    ['p4-dock-1', 'main-island-dock-2'],
    ['p4-dock-1', 'main-island-dock-3'],
    ['p4-dock-2', 'main-island-dock-0'],
    ['p4-dock-2', 'main-island-dock-1'],
    ['p4-dock-2', 'main-island-dock-2'],
    ['p4-dock-2', 'main-island-dock-3'],
    ['p4-dock-3', 'main-island-dock-0'],
    ['p4-dock-3', 'main-island-dock-1'],
    ['p4-dock-3', 'main-island-dock-2'],
    ['p4-dock-3', 'main-island-dock-3']
] as const

const FOUR_PLAYER_NO_OFFSHORE_P2_MAIN_HARBOR_REGRESSIONS = [
    ['p2-dock-0', 'main-island-dock-0'],
    ['p2-dock-0', 'main-island-dock-1'],
    ['p2-dock-0', 'main-island-dock-2'],
    ['p2-dock-0', 'main-island-dock-3'],
    ['p2-dock-1', 'main-island-dock-0'],
    ['p2-dock-1', 'main-island-dock-1'],
    ['p2-dock-1', 'main-island-dock-2'],
    ['p2-dock-1', 'main-island-dock-3'],
    ['p2-dock-2', 'main-island-dock-0'],
    ['p2-dock-2', 'main-island-dock-1'],
    ['p2-dock-2', 'main-island-dock-2'],
    ['p2-dock-2', 'main-island-dock-3'],
    ['p2-dock-3', 'main-island-dock-0'],
    ['p2-dock-3', 'main-island-dock-1'],
    ['p2-dock-3', 'main-island-dock-2'],
    ['p2-dock-3', 'main-island-dock-3']
] as const

const FOUR_PLAYER_NO_OFFSHORE_P3_MAIN_HARBOR_REGRESSIONS = [
    ['p3-dock-0', 'main-island-dock-0'],
    ['p3-dock-0', 'main-island-dock-1'],
    ['p3-dock-0', 'main-island-dock-2'],
    ['p3-dock-0', 'main-island-dock-3'],
    ['p3-dock-1', 'main-island-dock-0'],
    ['p3-dock-1', 'main-island-dock-1'],
    ['p3-dock-1', 'main-island-dock-2'],
    ['p3-dock-1', 'main-island-dock-3'],
    ['p3-dock-2', 'main-island-dock-0'],
    ['p3-dock-2', 'main-island-dock-1'],
    ['p3-dock-2', 'main-island-dock-2'],
    ['p3-dock-2', 'main-island-dock-3'],
    ['p3-dock-3', 'main-island-dock-0'],
    ['p3-dock-3', 'main-island-dock-1'],
    ['p3-dock-3', 'main-island-dock-2'],
    ['p3-dock-3', 'main-island-dock-3']
] as const

const FOUR_PLAYER_NO_OFFSHORE_MAIN_TO_P1_REGRESSIONS = [
    ['main-island-dock-0', 'p1-dock-0'],
    ['main-island-dock-0', 'p1-dock-1'],
    ['main-island-dock-0', 'p1-dock-2'],
    ['main-island-dock-0', 'p1-dock-3'],
    ['main-island-dock-1', 'p1-dock-0'],
    ['main-island-dock-1', 'p1-dock-1'],
    ['main-island-dock-1', 'p1-dock-2'],
    ['main-island-dock-1', 'p1-dock-3'],
    ['main-island-dock-2', 'p1-dock-0'],
    ['main-island-dock-2', 'p1-dock-1'],
    ['main-island-dock-2', 'p1-dock-2'],
    ['main-island-dock-2', 'p1-dock-3'],
    ['main-island-dock-3', 'p1-dock-0'],
    ['main-island-dock-3', 'p1-dock-1'],
    ['main-island-dock-3', 'p1-dock-2'],
    ['main-island-dock-3', 'p1-dock-3']
] as const

const FOUR_PLAYER_NO_OFFSHORE_MAIN_TO_P4_REGRESSIONS = [
    ['main-island-dock-0', 'p4-dock-0'],
    ['main-island-dock-0', 'p4-dock-1'],
    ['main-island-dock-0', 'p4-dock-2'],
    ['main-island-dock-0', 'p4-dock-3'],
    ['main-island-dock-1', 'p4-dock-0'],
    ['main-island-dock-1', 'p4-dock-1'],
    ['main-island-dock-1', 'p4-dock-2'],
    ['main-island-dock-1', 'p4-dock-3'],
    ['main-island-dock-2', 'p4-dock-0'],
    ['main-island-dock-2', 'p4-dock-1'],
    ['main-island-dock-2', 'p4-dock-2'],
    ['main-island-dock-2', 'p4-dock-3'],
    ['main-island-dock-3', 'p4-dock-0'],
    ['main-island-dock-3', 'p4-dock-1'],
    ['main-island-dock-3', 'p4-dock-2'],
    ['main-island-dock-3', 'p4-dock-3']
] as const

const FOUR_PLAYER_NO_OFFSHORE_MAIN_TO_P2_REGRESSIONS = [
    ['main-island-dock-0', 'p2-dock-0'],
    ['main-island-dock-0', 'p2-dock-1'],
    ['main-island-dock-0', 'p2-dock-2'],
    ['main-island-dock-0', 'p2-dock-3'],
    ['main-island-dock-1', 'p2-dock-0'],
    ['main-island-dock-1', 'p2-dock-1'],
    ['main-island-dock-1', 'p2-dock-2'],
    ['main-island-dock-1', 'p2-dock-3'],
    ['main-island-dock-2', 'p2-dock-0'],
    ['main-island-dock-2', 'p2-dock-1'],
    ['main-island-dock-2', 'p2-dock-2'],
    ['main-island-dock-2', 'p2-dock-3'],
    ['main-island-dock-3', 'p2-dock-0'],
    ['main-island-dock-3', 'p2-dock-1'],
    ['main-island-dock-3', 'p2-dock-2'],
    ['main-island-dock-3', 'p2-dock-3']
] as const

const FOUR_PLAYER_NO_OFFSHORE_MAIN_TO_P3_REGRESSIONS = [
    ['main-island-dock-0', 'p3-dock-0'],
    ['main-island-dock-0', 'p3-dock-1'],
    ['main-island-dock-0', 'p3-dock-2'],
    ['main-island-dock-0', 'p3-dock-3'],
    ['main-island-dock-1', 'p3-dock-0'],
    ['main-island-dock-1', 'p3-dock-1'],
    ['main-island-dock-1', 'p3-dock-2'],
    ['main-island-dock-1', 'p3-dock-3'],
    ['main-island-dock-2', 'p3-dock-0'],
    ['main-island-dock-2', 'p3-dock-1'],
    ['main-island-dock-2', 'p3-dock-2'],
    ['main-island-dock-2', 'p3-dock-3'],
    ['main-island-dock-3', 'p3-dock-0'],
    ['main-island-dock-3', 'p3-dock-1'],
    ['main-island-dock-3', 'p3-dock-2'],
    ['main-island-dock-3', 'p3-dock-3']
] as const

const FOUR_PLAYER_NO_OFFSHORE_MAIN_TO_OPEN_WATER_REGRESSIONS = [
    ['main-island-dock-0', 'open-water-0'],
    ['main-island-dock-0', 'open-water-1'],
    ['main-island-dock-0', 'open-water-2'],
    ['main-island-dock-0', 'open-water-3'],
    ['main-island-dock-1', 'open-water-0'],
    ['main-island-dock-1', 'open-water-1'],
    ['main-island-dock-1', 'open-water-2'],
    ['main-island-dock-1', 'open-water-3'],
    ['main-island-dock-2', 'open-water-0'],
    ['main-island-dock-2', 'open-water-1'],
    ['main-island-dock-2', 'open-water-2'],
    ['main-island-dock-2', 'open-water-3'],
    ['main-island-dock-3', 'open-water-0'],
    ['main-island-dock-3', 'open-water-1'],
    ['main-island-dock-3', 'open-water-2'],
    ['main-island-dock-3', 'open-water-3']
] as const

const FOUR_PLAYER_NO_OFFSHORE_OPEN_TO_MAIN_HARBOR_REGRESSIONS = [
    ['open-water-0', 'main-island-dock-0'],
    ['open-water-0', 'main-island-dock-1'],
    ['open-water-0', 'main-island-dock-2'],
    ['open-water-0', 'main-island-dock-3'],
    ['open-water-1', 'main-island-dock-0'],
    ['open-water-1', 'main-island-dock-1'],
    ['open-water-1', 'main-island-dock-2'],
    ['open-water-1', 'main-island-dock-3'],
    ['open-water-2', 'main-island-dock-0'],
    ['open-water-2', 'main-island-dock-1'],
    ['open-water-2', 'main-island-dock-2'],
    ['open-water-2', 'main-island-dock-3'],
    ['open-water-3', 'main-island-dock-0'],
    ['open-water-3', 'main-island-dock-1'],
    ['open-water-3', 'main-island-dock-2'],
    ['open-water-3', 'main-island-dock-3']
] as const


describe('buildDockTransferPlan', () => {
    const boardLayout = buildBoardLayout(['p1', 'p2', 'p3'], { hasOffshore: false })
    const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
    const allSlots = [
        ...navigationGeometry.playerBoardDockSlots,
        ...navigationGeometry.mainIslandDockSlots
    ]
    const slotById = new Map(allSlots.map((slot) => [slot.id, slot]))

    it.each(THREE_PLAYER_NO_OFFSHORE_PREVIOUS_IMPOSSIBLES)(
        'finds a route for %s -> %s in 3p no-offshore',
        (startId, endId) => {
            const startDock = slotById.get(startId)
            const endDock = slotById.get(endId)

            expect(startDock).toBeDefined()
            expect(endDock).toBeDefined()

            const plan = buildDockTransferPlan(startDock!, endDock!, navigationGeometry, [])

            expect(plan).not.toBeNull()
        }
    )

    it.each(THREE_PLAYER_OFFSHORE_PREVIOUS_IMPOSSIBLES)(
        'finds a route for %s -> %s in 3p offshore',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3'], { hasOffshore: true })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allSlots = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots,
                ...navigationGeometry.offshoreDockSlots
            ]
            const slotById = new Map(allSlots.map((slot) => [slot.id, slot]))
            const startDock = slotById.get(startId)
            const endDock = slotById.get(endId)

            expect(startDock).toBeDefined()
            expect(endDock).toBeDefined()

            const plan = buildDockTransferPlan(startDock!, endDock!, navigationGeometry, [])

            expect(plan).not.toBeNull()
        }
    )

    it.each(FOUR_PLAYER_OFFSHORE_PREVIOUS_IMPOSSIBLES)(
        'finds a route for %s -> %s in 4p offshore',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: true })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allSlots = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots,
                ...navigationGeometry.offshoreDockSlots
            ]
            const slotById = new Map(allSlots.map((slot) => [slot.id, slot]))
            const startDock = slotById.get(startId)
            const endDock = slotById.get(endId)

            expect(startDock).toBeDefined()
            expect(endDock).toBeDefined()

            const plan = buildDockTransferPlan(startDock!, endDock!, navigationGeometry, [])

            expect(plan).not.toBeNull()
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_CROWDED_REGRESSIONS)(
        'finds a crowded route for %s -> %s in 4p no-offshore',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allSlots = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots
            ]
            const slotById = new Map(allSlots.map((slot) => [slot.id, slot]))
            const startDock = slotById.get(startId)
            const endDock = slotById.get(endId)

            expect(startDock).toBeDefined()
            expect(endDock).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allSlots, [
                startId,
                endId
            ])
            const plan = buildDockTransferPlan(
                startDock!,
                endDock!,
                navigationGeometry,
                occupiedBoatPoses
            )

            expect(plan).not.toBeNull()
        }
    )

    it('keeps failing offshore staging poses outside obstacles', () => {
        const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: true })
        const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
        const slotById = new Map(
            [...navigationGeometry.playerBoardDockSlots, ...navigationGeometry.mainIslandDockSlots, ...navigationGeometry.offshoreDockSlots].map((slot) => [
                slot.id,
                slot
            ])
        )

        for (const slotId of ['main-island-dock-0', 'offshore-dock-0', 'offshore-dock-2', 'offshore-dock-3', 'p1-dock-1', 'p3-dock-0', 'p3-dock-2']) {
            const slot = slotById.get(slotId)!
            const stagingFootprint = getBoatFootprintPolygon(slot.stagingPose)
            const collisions = navigationGeometry.obstacles
                .filter((obstacle) => polygonsIntersect(stagingFootprint, obstacle.polygon))
                .map((obstacle) => obstacle.id)

            expect(collisions, `${slotId} staging collisions: ${collisions.join(', ')}`).toEqual([])
        }
    })

    it.each(FOUR_PLAYER_NO_OFFSHORE_ROUTE_REGRESSIONS)(
        'finds a 4p no-offshore route for %s -> %s with all other endpoints occupied',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allEndpoints = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots,
                ...navigationGeometry.openWaterSlots
            ]
            const endpointById = new Map(allEndpoints.map((slot) => [slot.id, slot]))
            const start = endpointById.get(startId)
            const end = endpointById.get(endId)

            expect(start).toBeDefined()
            expect(end).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allEndpoints, [
                startId,
                endId
            ])
            const plan = buildRoutePlan(start!, end!, navigationGeometry, occupiedBoatPoses)

            expect(plan).not.toBeNull()
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_P1_BOTTOM_LEFT_OPEN_WATER_REGRESSIONS)(
        'keeps %s -> open-water-2 compact in 4p no-offshore with all other endpoints occupied',
        (startId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allEndpoints = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots,
                ...navigationGeometry.openWaterSlots
            ]
            const endpointById = new Map(allEndpoints.map((slot) => [slot.id, slot]))
            const start = endpointById.get(startId)
            const end = endpointById.get('open-water-2')

            expect(start).toBeDefined()
            expect(end).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allEndpoints, [
                startId,
                'open-water-2'
            ])
            const plan = buildRoutePlan(start!, end!, navigationGeometry, occupiedBoatPoses)

            expect(plan).not.toBeNull()
            expect(getMotionPathLength(plan!.segments)).toBeLessThan(1600)
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_P1_BOTTOM_RIGHT_OPEN_WATER_REGRESSIONS)(
        'keeps %s -> open-water-3 compact in 4p no-offshore with all other endpoints occupied',
        (startId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allEndpoints = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots,
                ...navigationGeometry.openWaterSlots
            ]
            const endpointById = new Map(allEndpoints.map((slot) => [slot.id, slot]))
            const start = endpointById.get(startId)
            const end = endpointById.get('open-water-3')

            expect(start).toBeDefined()
            expect(end).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allEndpoints, [
                startId,
                'open-water-3'
            ])
            const plan = buildRoutePlan(start!, end!, navigationGeometry, occupiedBoatPoses)

            expect(plan).not.toBeNull()
            expect(getMotionPathLength(plan!.segments)).toBeLessThan(1800)
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_P4_TOP_LEFT_OPEN_WATER_REGRESSIONS)(
        'keeps %s -> open-water-0 compact in 4p no-offshore with all other endpoints occupied',
        (startId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allEndpoints = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots,
                ...navigationGeometry.openWaterSlots
            ]
            const endpointById = new Map(allEndpoints.map((slot) => [slot.id, slot]))
            const start = endpointById.get(startId)
            const end = endpointById.get('open-water-0')

            expect(start).toBeDefined()
            expect(end).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allEndpoints, [
                startId,
                'open-water-0'
            ])
            const plan = buildRoutePlan(start!, end!, navigationGeometry, occupiedBoatPoses)

            expect(plan).not.toBeNull()
            expect(getMotionPathLength(plan!.segments)).toBeLessThan(1600)
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_P4_TOP_RIGHT_OPEN_WATER_REGRESSIONS)(
        'keeps %s -> open-water-1 compact in 4p no-offshore with all other endpoints occupied',
        (startId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allEndpoints = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots,
                ...navigationGeometry.openWaterSlots
            ]
            const endpointById = new Map(allEndpoints.map((slot) => [slot.id, slot]))
            const start = endpointById.get(startId)
            const end = endpointById.get('open-water-1')

            expect(start).toBeDefined()
            expect(end).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allEndpoints, [
                startId,
                'open-water-1'
            ])
            const plan = buildRoutePlan(start!, end!, navigationGeometry, occupiedBoatPoses)

            expect(plan).not.toBeNull()
            expect(getMotionPathLength(plan!.segments)).toBeLessThan(1800)
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_P1_MAIN_HARBOR_REGRESSIONS)(
        'keeps %s -> %s compact with a reverse-in harbor dock maneuver in 4p no-offshore',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allDocks = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots
            ]
            const dockById = new Map(allDocks.map((dock) => [dock.id, dock]))
            const startDock = dockById.get(startId)
            const endDock = dockById.get(endId)

            expect(startDock).toBeDefined()
            expect(endDock).toBeDefined()

            const plan = buildDockTransferPlan(startDock!, endDock!, navigationGeometry, [])

            expect(plan).not.toBeNull()
            expect(getMotionPathLength(plan!.segments)).toBeLessThan(2700)
            expect(plan!.dockSegments.some((segment) => segment.direction === 'reverse')).toBe(true)
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_P1_MAIN_HARBOR_REGRESSIONS)(
        'keeps %s -> %s compact with all docks occupied in 4p no-offshore',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allDocks = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots
            ]
            const dockById = new Map(allDocks.map((dock) => [dock.id, dock]))
            const startDock = dockById.get(startId)
            const endDock = dockById.get(endId)

            expect(startDock).toBeDefined()
            expect(endDock).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allDocks, [startId, endId])
            const plan = buildDockTransferPlan(
                startDock!,
                endDock!,
                navigationGeometry,
                occupiedBoatPoses
            )

            expect(plan).not.toBeNull()
            expect(getMotionPathLength(plan!.segments)).toBeLessThan(2600)
            expect(plan!.dockSegments.some((segment) => segment.direction === 'reverse')).toBe(true)
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_P4_MAIN_HARBOR_REGRESSIONS)(
        'keeps %s -> %s compact with all docks occupied in 4p no-offshore',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allDocks = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots
            ]
            const dockById = new Map(allDocks.map((dock) => [dock.id, dock]))
            const startDock = dockById.get(startId)
            const endDock = dockById.get(endId)

            expect(startDock).toBeDefined()
            expect(endDock).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allDocks, [startId, endId])
            const plan = buildDockTransferPlan(
                startDock!,
                endDock!,
                navigationGeometry,
                occupiedBoatPoses
            )

            expect(plan).not.toBeNull()
            expect(getMotionPathLength(plan!.segments)).toBeLessThan(2600)
            expect(plan!.dockSegments.some((segment) => segment.direction === 'reverse')).toBe(true)
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_P2_MAIN_HARBOR_REGRESSIONS)(
        'keeps %s -> %s compact with all docks occupied in 4p no-offshore',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allDocks = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots
            ]
            const dockById = new Map(allDocks.map((dock) => [dock.id, dock]))
            const startDock = dockById.get(startId)
            const endDock = dockById.get(endId)

            expect(startDock).toBeDefined()
            expect(endDock).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allDocks, [startId, endId])
            const plan = buildDockTransferPlan(
                startDock!,
                endDock!,
                navigationGeometry,
                occupiedBoatPoses
            )

            expect(plan).not.toBeNull()
            expect(getMotionPathLength(plan!.segments)).toBeLessThan(1500)
            expect(plan!.dockSegments.some((segment) => segment.direction === 'reverse')).toBe(true)
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_P3_MAIN_HARBOR_REGRESSIONS)(
        'keeps %s -> %s compact with all docks occupied in 4p no-offshore',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allDocks = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots
            ]
            const dockById = new Map(allDocks.map((dock) => [dock.id, dock]))
            const startDock = dockById.get(startId)
            const endDock = dockById.get(endId)

            expect(startDock).toBeDefined()
            expect(endDock).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allDocks, [startId, endId])
            const plan = buildDockTransferPlan(
                startDock!,
                endDock!,
                navigationGeometry,
                occupiedBoatPoses
            )

            expect(plan).not.toBeNull()
            expect(getMotionPathLength(plan!.segments)).toBeLessThan(1500)
            expect(plan!.dockSegments.some((segment) => segment.direction === 'reverse')).toBe(true)
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_MAIN_TO_P1_REGRESSIONS)(
        'keeps %s -> %s compact with all docks occupied in 4p no-offshore',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allDocks = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots
            ]
            const dockById = new Map(allDocks.map((dock) => [dock.id, dock]))
            const startDock = dockById.get(startId)
            const endDock = dockById.get(endId)

            expect(startDock).toBeDefined()
            expect(endDock).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allDocks, [startId, endId])
            const plan = buildDockTransferPlan(
                startDock!,
                endDock!,
                navigationGeometry,
                occupiedBoatPoses
            )

            expect(plan).not.toBeNull()
            expect(getMotionPathLength(plan!.segments)).toBeLessThan(2000)
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_MAIN_TO_P4_REGRESSIONS)(
        'keeps %s -> %s compact with all docks occupied in 4p no-offshore',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allDocks = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots
            ]
            const dockById = new Map(allDocks.map((dock) => [dock.id, dock]))
            const startDock = dockById.get(startId)
            const endDock = dockById.get(endId)

            expect(startDock).toBeDefined()
            expect(endDock).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allDocks, [startId, endId])
            const plan = buildDockTransferPlan(
                startDock!,
                endDock!,
                navigationGeometry,
                occupiedBoatPoses
            )

            expect(plan).not.toBeNull()
            expect(getMotionPathLength(plan!.segments)).toBeLessThan(2000)
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_MAIN_TO_P2_REGRESSIONS)(
        'keeps %s -> %s compact with all docks occupied in 4p no-offshore',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allDocks = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots
            ]
            const dockById = new Map(allDocks.map((dock) => [dock.id, dock]))
            const startDock = dockById.get(startId)
            const endDock = dockById.get(endId)

            expect(startDock).toBeDefined()
            expect(endDock).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allDocks, [startId, endId])
            const plan = buildDockTransferPlan(
                startDock!,
                endDock!,
                navigationGeometry,
                occupiedBoatPoses
            )

            expect(plan).not.toBeNull()
            expect(getMotionPathLength(plan!.segments)).toBeLessThan(2000)
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_MAIN_TO_P3_REGRESSIONS)(
        'keeps %s -> %s compact with all docks occupied in 4p no-offshore',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allDocks = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots
            ]
            const dockById = new Map(allDocks.map((dock) => [dock.id, dock]))
            const startDock = dockById.get(startId)
            const endDock = dockById.get(endId)

            expect(startDock).toBeDefined()
            expect(endDock).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allDocks, [startId, endId])
            const plan = buildDockTransferPlan(
                startDock!,
                endDock!,
                navigationGeometry,
                occupiedBoatPoses
            )

            expect(plan).not.toBeNull()
            expect(getMotionPathLength(plan!.segments)).toBeLessThan(2000)
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_MAIN_TO_OPEN_WATER_REGRESSIONS)(
        'keeps %s -> %s compact with all other endpoints occupied in 4p no-offshore',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allEndpoints = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots,
                ...navigationGeometry.openWaterSlots
            ]
            const endpointById = new Map(allEndpoints.map((slot) => [slot.id, slot]))
            const start = endpointById.get(startId)
            const end = endpointById.get(endId)

            expect(start).toBeDefined()
            expect(end).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allEndpoints, [
                startId,
                endId
            ])
            const plan = buildRoutePlan(start!, end!, navigationGeometry, occupiedBoatPoses)

            expect(plan).not.toBeNull()
            expect(getMotionPathLength(plan!.segments)).toBeLessThan(2600)
        }
    )

    it.each(FOUR_PLAYER_NO_OFFSHORE_OPEN_TO_MAIN_HARBOR_REGRESSIONS)(
        'keeps %s -> %s compact entering main harbor with all other endpoints occupied in 4p no-offshore',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allEndpoints = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots,
                ...navigationGeometry.openWaterSlots
            ]
            const endpointById = new Map(allEndpoints.map((slot) => [slot.id, slot]))
            const start = endpointById.get(startId)
            const end = endpointById.get(endId)

            expect(start).toBeDefined()
            expect(end).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allEndpoints, [
                startId,
                endId
            ])
            const plan = buildRoutePlan(start!, end!, navigationGeometry, occupiedBoatPoses)

            expect(plan).not.toBeNull()
            expect(getMotionPathLength(plan!.segments)).toBeLessThan(2600)
        }
    )

    it.each([
        ['open-water-0', 'main-island-dock-0'],
        ['open-water-0', 'main-island-dock-1'],
        ['open-water-0', 'main-island-dock-2'],
        ['open-water-0', 'main-island-dock-3'],
        ['open-water-2', 'main-island-dock-0'],
        ['open-water-2', 'main-island-dock-1'],
        ['open-water-2', 'main-island-dock-2'],
        ['open-water-2', 'main-island-dock-3']
    ] as const)(
        'keeps %s -> %s from backing up on the row before the harbor turn in 4p no-offshore',
        (startId, endId) => {
            const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
            const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
            const allEndpoints = [
                ...navigationGeometry.playerBoardDockSlots,
                ...navigationGeometry.mainIslandDockSlots,
                ...navigationGeometry.openWaterSlots
            ]
            const endpointById = new Map(allEndpoints.map((slot) => [slot.id, slot]))
            const start = endpointById.get(startId)
            const end = endpointById.get(endId)

            expect(start).toBeDefined()
            expect(end).toBeDefined()

            const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allEndpoints, [
                startId,
                endId
            ])
            const plan = buildRoutePlan(start!, end!, navigationGeometry, occupiedBoatPoses)

            expect(plan).not.toBeNull()

            for (const segment of plan!.undockSegments) {
                if (segment.kind !== 'straight') {
                    continue
                }
                expect(segment.endPose.x).toBeGreaterThanOrEqual(segment.startPose.x - 1)
            }
        }
    )


    it('keeps the smoothed route probe path aligned with the raw main-island-dock-3 -> p4-dock-3 transfer in 4p no-offshore', () => {
        const boardLayout = buildBoardLayout(['p1', 'p2', 'p3', 'p4'], { hasOffshore: false })
        const navigationGeometry = buildBoatNavigationGeometry(boardLayout)
        const allDocks = [
            ...navigationGeometry.playerBoardDockSlots,
            ...navigationGeometry.mainIslandDockSlots
        ]
        const dockById = new Map(allDocks.map((dock) => [dock.id, dock]))
        const startDock = dockById.get('main-island-dock-3')
        const endDock = dockById.get('p4-dock-3')

        expect(startDock).toBeDefined()
        expect(endDock).toBeDefined()

        const occupiedBoatPoses = getFilledRouteOccupiedBoatPoses(allDocks, [
            'main-island-dock-3',
            'p4-dock-3'
        ])
        const rawPlan = buildDockTransferPlan(
            startDock!,
            endDock!,
            navigationGeometry,
            occupiedBoatPoses
        )
        const routePlan = buildRoutePlan(
            startDock!,
            endDock!,
            navigationGeometry,
            occupiedBoatPoses
        )

        expect(rawPlan).not.toBeNull()
        expect(routePlan).not.toBeNull()
        expect(routePlan!.transitSegments).toEqual(rawPlan!.transitSegments)
        expect(getMotionPathLength(routePlan!.segments)).toBe(
            getMotionPathLength(rawPlan!.segments)
        )
    })
})
