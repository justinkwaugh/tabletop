import { expect, it } from 'vitest'
import { HexOrientation, assertExists } from '@tabletop/common'
import { RailwayMap, createCityTileFace } from '@tabletop/18xx'
import { createMapDrawing, type MapRoute } from '../lib/maps/mapDrawing.js'
import { ExtensionDash, cityOutline, drawMapRoutes } from '../lib/maps/routeDrawing.js'

function cityScene(slots: number) {
    return createMapDrawing(
        new RailwayMap({
            id: 'routes',
            name: 'Routes',
            orientation: HexOrientation.Flat,
            locations: [
                {
                    id: 'A1',
                    coordinates: { q: 0, r: 0 },
                    buildable: true,
                    preprintedTile: createCityTileFace('green', [0, 2, 4], 30, slots)
                }
            ]
        })
    )
}

it.each([1, 2, 3, 4])('outlines a %i-slot city with one closed perimeter', (slots) => {
    const city = cityScene(slots).locations[0].drawing.nodes[0]
    const outline = cityOutline(city)
    expect(outline.match(/M /g)).toHaveLength(1)
    expect(outline.endsWith(' Z')).toBe(true)
    expect(outline).not.toMatch(/NaN|Infinity/)
    expect(outline.match(/A /g)).toHaveLength(slots === 1 ? 2 : slots)
})

it('masks shared cities once while preserving complete track geometry', () => {
    const scene = cityScene(3)
    const [first, second, third] = scene.locations[0].drawing.paths
    const routes: MapRoute[] = [
        {
            id: 'a',
            color: 'red',
            segments: [first, second].map((path) => ({ locationId: 'A1', pathId: path.id }))
        },
        { id: 'b', color: 'blue', segments: [{ locationId: 'A1', pathId: third.id }] }
    ]
    const [drawing] = drawMapRoutes(scene, routes)
    expect(drawing.cities).toHaveLength(1)
    expect(drawing.paths.map((path) => path.d)).toEqual([first.d, second.d, third.d])
    expect(drawMapRoutes(scene, [])).toEqual([])
})

it('marks an extension’s paths apart from the route’s own', () => {
    const scene = cityScene(1)
    const [first, second] = scene.locations[0].drawing.paths
    const [drawing] = drawMapRoutes(scene, [
        {
            id: 'a',
            color: 'red',
            segments: [{ locationId: 'A1', pathId: first.id }],
            extension: [{ locationId: 'A1', pathId: second.id }]
        }
    ])
    expect(drawing.paths.map((path) => [path.pathId, path.extension])).toEqual([
        [first.id, false],
        [second.id, true]
    ])
})

it('mirrors an extension’s dashes on track it runs backwards', () => {
    const scene = cityScene(3)
    const [first, second] = scene.locations[0].drawing.paths
    const [drawing] = drawMapRoutes(scene, [
        {
            id: 'a',
            color: 'red',
            segments: [{ locationId: 'A1', pathId: first.id }],
            extension: [{ locationId: 'A1', pathId: second.id }]
        }
    ])
    const length = Math.hypot(second.end.x - second.start.x, second.end.y - second.start.y)
    const period = ExtensionDash.drawn + ExtensionDash.gap
    const wrap = (value: number) => ((value % period) + period) % period
    // The extension leaves the city along the second path, which is drawn from its edge.
    expect(drawing.paths[1].dashOffset).toBeCloseTo(wrap(ExtensionDash.drawn - length), 1)
})

it('splits track that routes share into lanes that meet their continuation in the next hex', () => {
    const scene = createMapDrawing(
        new RailwayMap({
            id: 'shared',
            name: 'Shared',
            orientation: HexOrientation.Flat,
            locations: (
                [
                    ['A1', 0, 0],
                    ['A2', 1, 3]
                ] as const
            ).map(([id, r, edge]) => ({
                id,
                coordinates: { q: 0, r },
                buildable: true,
                preprintedTile: createCityTileFace('green', [edge], 30, 1)
            }))
        })
    )
    const segments = [
        { locationId: 'A1', pathId: 'edge-0' },
        { locationId: 'A2', pathId: 'edge-3' }
    ]
    const drawn = drawMapRoutes(scene, [
        { id: 'a', color: 'red', segments },
        { id: 'b', color: 'blue', segments }
    ])
    const atSide = (locationId: string, routeId: string) => {
        const location = drawn.find((entry) => entry.id === locationId)
        const path = location?.paths.find((candidate) => candidate.routeId === routeId)
        const points = [...(path?.d.matchAll(/[ML] (-?[\d.e-]+) (-?[\d.e-]+)/g) ?? [])].map(
            ([, x, y]) => ({ x: Number(x), y: Number(y) })
        )
        const far = points.reduce((best, point) =>
            Math.hypot(point.x, point.y) > Math.hypot(best.x, best.y) ? point : best
        )
        return { x: far.x + (location?.center.x ?? 0), y: far.y + (location?.center.y ?? 0) }
    }
    for (const routeId of ['a', 'b']) {
        const [above, below] = ['A1', 'A2'].map((id) => atSide(id, routeId))
        expect(Math.hypot(above.x - below.x, above.y - below.y)).toBeLessThan(0.01)
    }
    const [a, b] = ['a', 'b'].map((routeId) => atSide('A1', routeId))
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(6.75, 1)
    expect(drawn[0].paths.every((path) => (path.width ?? 0) < 6.5)).toBe(true)
})

it('splits an off-board spike that routes share into lanes', () => {
    const scene = createMapDrawing(
        new RailwayMap({
            id: 'offboard',
            name: 'Off-board',
            orientation: HexOrientation.Flat,
            locations: [
                {
                    id: 'A1',
                    coordinates: { q: 0, r: 0 },
                    buildable: false,
                    preprintedTile: {
                        color: 'red',
                        labels: [],
                        nodes: [
                            { id: 'away', kind: 'offboard', revenue: { kind: 'fixed', amount: 20 } }
                        ],
                        paths: [
                            {
                                id: 'in',
                                endpoints: [
                                    { kind: 'edge', edge: 0 },
                                    { kind: 'node', nodeId: 'away' }
                                ]
                            }
                        ]
                    }
                }
            ]
        })
    )
    const segments = [{ locationId: 'A1', pathId: 'in' }]
    const [drawing] = drawMapRoutes(scene, [
        { id: 'a', color: 'red', segments },
        { id: 'b', color: 'blue', segments }
    ])
    const [a, b] = drawing.paths.map((path) => path.spike)
    assertExists(a)
    assertExists(b)
    expect(Math.hypot(a.base.x - b.base.x, a.base.y - b.base.y)).toBeCloseTo(6.75, 1)
    expect(drawing.paths.every((path) => (path.width ?? 0) < 6.5)).toBe(true)
})
