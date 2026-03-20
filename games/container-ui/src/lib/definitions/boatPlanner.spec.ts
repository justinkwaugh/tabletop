import { describe, expect, it } from 'vitest'
import { buildBoardLayout } from '$lib/definitions/boardLayout.js'
import { buildBoatNavigationGeometry } from '$lib/definitions/boatNavigation.js'
import { polygonsIntersect } from '$lib/definitions/geometry2d.js'
import { getBoatFootprintPolygon } from '$lib/definitions/boatNavigation.js'
import { buildDockTransferPlan, buildRoutePlan } from '$lib/definitions/boatPlanner.js'
import { getFilledRouteOccupiedBoatPoses } from '$lib/definitions/boatRouteOccupancy.js'

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
    ['p1-dock-2', 'open-water-0'],
    ['open-water-0', 'main-island-dock-0'],
    ['main-island-dock-0', 'open-water-0']
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
})
