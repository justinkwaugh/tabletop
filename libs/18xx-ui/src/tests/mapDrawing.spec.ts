import { expect, it } from 'vitest'
import { assert, HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    createCityTileFace,
    createOffboardTileFace,
    type TileEdge
} from '@tabletop/18xx'
import { mapTrackJoins } from '../lib/maps/trackJoins.js'
import {
    createMapDrawing,
    mapSelectionPoint,
    mapSelectionRect,
    mapViewport
} from '../lib/maps/mapDrawing.js'

it.each([HexOrientation.Flat, HexOrientation.Pointy])(
    'aligns borders and selectable stations in %s maps',
    (orientation) => {
        const edges: readonly TileEdge[] = orientation === HexOrientation.Flat ? [0, 3] : [5, 2]
        const scene = createMapDrawing(
            new RailwayMap({
                id: 'border-example',
                name: 'Border example',
                orientation,
                locations: edges.map((edge, index) => ({
                    id: `location-${index}`,
                    coordinates: { q: 0, r: index },
                    buildable: true,
                    preprintedTile: createCityTileFace('white', [edge], 20, 2),
                    borders: [{ edge, kind: 'water', cost: 40 }]
                }))
            })
        )
        expect(mapTrackJoins(scene)).toHaveLength(1)
        expect(mapTrackJoins({ ...scene, locations: scene.locations.slice(0, 1) })).toHaveLength(0)
        const [first, second] = scene.locations
        const a = first.borders[0],
            b = second.borders[0]
        expect(first.center.x + a.start.x).toBeCloseTo(second.center.x + b.end.x, 1)
        expect(first.center.y + a.start.y).toBeCloseTo(second.center.y + b.end.y, 1)
        expect(first.center.x + a.end.x).toBeCloseTo(second.center.x + b.start.x, 1)
        expect(first.center.y + a.end.y).toBeCloseTo(second.center.y + b.start.y, 1)
        const slot = second.drawing.nodes[0].slots[1]
        expect(
            mapSelectionPoint(scene, {
                kind: 'slot',
                locationId: second.location.id,
                nodeId: 'city',
                slot: 1
            })
        ).toEqual({ x: second.center.x + slot.x, y: second.center.y + slot.y })
        expect(() =>
            mapSelectionPoint(scene, {
                kind: 'path',
                locationId: first.location.id,
                pathId: 'missing'
            })
        ).toThrow('path')
    }
)

it.each([HexOrientation.Flat, HexOrientation.Pointy])(
    'focuses a station in native artwork coordinates on a %s map',
    (orientation) => {
        const scene = createMapDrawing(
            new RailwayMap({
                id: 'artwork-example',
                name: 'Artwork example',
                orientation,
                locations: [
                    {
                        id: 'home',
                        coordinates: { q: -2, r: 3 },
                        buildable: true,
                        preprintedTile: createCityTileFace('white', [], 20, 2)
                    }
                ]
            })
        )
        const artwork = {
            imageUrl: '/board.jpg',
            width: 2048,
            height: 1394,
            origin: { x: 400, y: 200 },
            scale: 1.5
        }
        const selection = { kind: 'slot', locationId: 'home', nodeId: 'city', slot: 1 } as const
        const point = mapSelectionPoint(scene, selection)
        const rect = mapSelectionRect(scene, selection, 140, 60, artwork)
        expect(rect.x + rect.width / 2).toBeCloseTo(400 + point.x * 1.5)
        expect(rect.y + rect.height / 2).toBeCloseTo(200 + point.y * 1.5)
        expect(rect.width).toBe(180)
        expect(mapViewport(scene, 140, artwork)).toMatchObject({ width: 2048, height: 1394 })
        const generic = mapSelectionRect(scene, selection, 140)
        expect(generic.x + generic.width / 2).toBeCloseTo((point.x - scene.bounds.x) * 1.4)
    }
)

it('leaves joined edges out of the outline and hides a duplicate revenue', () => {
    const map = new RailwayMap({
        id: 'joined',
        name: 'Joined',
        orientation: HexOrientation.Pointy,
        locations: [0, 1].map((r) => ({
            id: `location-${r}`,
            coordinates: { q: 0, r },
            buildable: false,
            preprintedTile: createCityTileFace('red', [r ? 2 : 5], 30, 1)
        }))
    })
    const scene = createMapDrawing(map, undefined, {
        layouts: { 'location-0': { hideRevenue: true } },
        joinedEdges: { 'location-0': [5], 'location-1': [2] }
    })
    const [first, second] = scene.locations
    expect([first.outline.length, second.outline.length]).toEqual([5, 5])
    expect(first.drawing.nodes[0].revenueHidden).toBe(true)
    expect(second.drawing.nodes[0].revenueHidden).toBe(false)
    const plain = createMapDrawing(map).locations[0]
    expect(plain.outline).toHaveLength(6)
})

it('divides neighbouring offboard areas and joins the hexes of one area', () => {
    const map = new RailwayMap({
        id: 'offboards',
        name: 'Offboards',
        orientation: HexOrientation.Pointy,
        locations: [0, 1, 2, 3].map((r) => ({
            id: `location-${r}`,
            coordinates: { q: 0, r },
            buildable: false,
            preprintedTile:
                r < 3
                    ? createOffboardTileFace([1], { kind: 'fixed', amount: 30 })
                    : createCityTileFace('gray', [2], 10, 1)
        }))
    })
    const scene = createMapDrawing(map, undefined, {
        joinedEdges: { 'location-0': [5], 'location-1': [2] }
    })
    expect(
        scene.locations.map((entry) => [
            entry.outline.length,
            entry.joints.length,
            entry.divisions.length
        ])
    ).toEqual([
        [5, 1, 0],
        [4, 1, 1],
        [5, 0, 1],
        [6, 0, 0]
    ])
})

it('prints a bonus badge beneath the revenue and each port clear of it inside the hex', () => {
    const map = new RailwayMap({
        id: 'ports',
        name: 'Ports',
        orientation: HexOrientation.Pointy,
        locations: [
            {
                id: 'harbour',
                name: 'Harbour',
                coordinates: { q: 0, r: 0 },
                buildable: false,
                preprintedTile: createOffboardTileFace([1], {
                    kind: 'staged',
                    values: [
                        { stage: 'yellow', amount: 40 },
                        { stage: 'brown', amount: 10 }
                    ]
                }),
                markers: [
                    { id: 'bonus', label: '+$20', description: 'Bonus' },
                    { id: 'ports', label: 'Port ×2', description: 'Ports', count: 2 }
                ]
            }
        ]
    })
    const [entry] = createMapDrawing(map, undefined, {
        markerArt: { bonus: { revenueBadge: true }, ports: { revenueSymbol: 'port' } }
    }).locations
    const cells = entry.drawing.nodes[0].revenueCells
    const [badge, ...ports] = entry.revenueAnnotations
    assert(badge.kind === 'badge')
    expect(badge.x).toBeCloseTo(cells[0].x)
    expect(badge.y - badge.height / 2).toBeGreaterThan(
        Math.max(...cells.map((cell) => cell.y + cell.height / 2))
    )
    expect(ports).toHaveLength(2)
    for (const port of ports) {
        assert(port.kind === 'symbol')
        expect(Math.hypot(port.x, port.y) + port.radius).toBeLessThan(43.3)
        for (const cell of cells)
            expect(
                Math.abs(port.x - cell.x) > port.radius + cell.width / 2 ||
                    Math.abs(port.y - cell.y) > port.radius + cell.height / 2
            ).toBe(true)
    }
    expect(Math.hypot(ports[0].x - ports[1].x, ports[0].y - ports[1].y)).toBeGreaterThanOrEqual(
        2 * 8.7
    )
})
