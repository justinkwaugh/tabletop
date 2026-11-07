import { describe, expect, it } from 'vitest'
import { RegionIds, Regions, RouteMedia, Routes, Spaces, StartingSpaceIds } from '@tabletop/feudum'
import {
    MapArea,
    PieceSlotCount,
    RegionOutlines,
    RouteControls,
    RoutePaths,
    SideBySideSpacing,
    SpaceCentres,
    isInside,
    routePointAt,
    spaceGeometry,
    type Point
} from './boardGeometry.js'

function distance(a: Point, b: Point) {
    return Math.hypot(a.x - b.x, a.y - b.y)
}

function inMap({ x, y }: Point) {
    return (
        x >= MapArea.x &&
        x <= MapArea.x + MapArea.width &&
        y >= MapArea.y &&
        y <= MapArea.y + MapArea.height
    )
}

describe('the map geometry against the logic data (S72)', () => {
    it('R-1.2.1 places every space, and no space the data lacks', () => {
        expect(Object.keys(SpaceCentres).toSorted()).toEqual(Spaces.map(({ id }) => id).toSorted())
    })

    it('R-1.2.2 places every route, and no route the data lacks', () => {
        expect(Object.keys(RouteControls).toSorted()).toEqual(Routes.map(({ id }) => id).toSorted())
        expect([...RoutePaths.keys()].toSorted()).toEqual(Routes.map(({ id }) => id).toSorted())
    })

    it('R-1.2.1 keeps each space inside its own region', () => {
        for (const space of Spaces) {
            const inRegion = RegionOutlines[space.region].some((outline) =>
                isInside(SpaceCentres[space.id], outline)
            )
            expect(inRegion, space.id).toBe(true)
        }
    })

    it('R-1.2.1 keeps each region drawn', () => {
        for (const region of RegionIds) {
            expect(RegionOutlines[region].length, region).toBeGreaterThan(0)
        }
        expect(Regions.length).toBe(RegionIds.length)
    })
})

describe('the piece slots (S72)', () => {
    it('R-4.1 gives each space four slots, a chip and a place for each thing on it, all on the map', () => {
        for (const { id } of Spaces) {
            const geometry = spaceGeometry(id)
            expect(geometry.pieceSlots).toHaveLength(PieceSlotCount)
            const anchors = [
                geometry.centre,
                ...geometry.pieceSlots,
                geometry.countChip,
                geometry.ruler,
                geometry.subject,
                geometry.serf,
                geometry.landscape,
                ...geometry.goods,
                ...Object.values(geometry.vessels)
            ]
            for (const anchor of anchors) {
                expect(inMap(anchor), id).toBe(true)
            }
        }
    })

    it('R-4.1 keeps the four slots of a space apart', () => {
        for (const { id } of Spaces) {
            const { pieceSlots } = spaceGeometry(id)
            for (const [index, slot] of pieceSlots.entries()) {
                for (const other of pieceSlots.slice(index + 1)) {
                    expect(distance(slot, other), id).toBeGreaterThan(20)
                }
            }
        }
    })
})

describe('the routes (S72)', () => {
    it('R-1.2.2 ends each route on its two spaces', () => {
        for (const route of Routes) {
            const path = RoutePaths.get(route.id)
            if (!path) {
                throw new Error(route.id)
            }
            const { a, b } = route
            const tolerance = 2 * SideBySideSpacing
            expect(distance(path.from, SpaceCentres[a]), route.id).toBeLessThanOrEqual(tolerance)
            expect(distance(path.to, SpaceCentres[b]), route.id).toBeLessThanOrEqual(tolerance)
        }
    })

    it('R-1.2.2 keeps two media on one pair apart, side by side', () => {
        const pairs = Map.groupBy(Routes, ({ a, b }) => `${a}--${b}`)
        const doubled = [...pairs.values()].filter((routes) => routes.length > 1)
        expect(doubled.length).toBeGreaterThan(0)
        for (const routes of doubled) {
            const middles = routes.flatMap(({ id }) => {
                const path = RoutePaths.get(id)
                return path ? [routePointAt(path, 0.5)] : []
            })
            expect(middles).toHaveLength(routes.length)
            for (const [index, middle] of middles.entries()) {
                for (const other of middles.slice(index + 1)) {
                    expect(distance(middle, other)).toBeGreaterThanOrEqual(SideBySideSpacing - 0.01)
                }
            }
        }
    })

    it('R-1.2.2 uses each medium on the map', () => {
        expect(new Set(Routes.map(({ medium }) => medium))).toEqual(new Set(RouteMedia))
    })

    it('R-4.2 marks each starting space among the placed spaces', () => {
        for (const id of StartingSpaceIds) {
            expect(SpaceCentres[id]).toBeDefined()
        }
    })
})
