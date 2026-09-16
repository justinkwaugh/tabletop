import { expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMap, createCityTileFace, type TileEdge } from '@tabletop/18xx'
import { mapTrackJoins } from '../lib/maps/trackJoins.js'
import { createMapDrawing, mapSelectionPoint } from '../lib/maps/mapDrawing.js'

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
