import { describe, expect, it } from 'vitest'
import { calculateHexGeometry, HexOrientation } from '@tabletop/common'
import { StandardTileCatalog, rotateTileFace, type TileRotation } from '@tabletop/18xx'
import { createTileDrawing } from '@tabletop/18xx-ui'
import { TileSpecimenGroups, SpecimenLayouts } from './specimens.js'

const rotations: readonly TileRotation[] = [0, 1, 2, 3, 4, 5]

describe('title tile drawing integration', () => {
    it.each([HexOrientation.Flat, HexOrientation.Pointy])(
        'preserves every semantic endpoint in all rotations, %s',
        (orientation) => {
            const hex = calculateHexGeometry(
                { orientation, dimensions: { radius: 50 } },
                { q: 0, r: 0 }
            )
            const edgeCorners =
                orientation === HexOrientation.Flat ? [3, 4, 5, 0, 1, 2] : [2, 3, 4, 5, 0, 1]
            for (const tile of TileSpecimenGroups['All specimens']) {
                const serialized = JSON.stringify(tile)
                for (const rotation of rotations) {
                    const drawing = createTileDrawing(
                        tile.face,
                        orientation,
                        rotation,
                        SpecimenLayouts[tile.id]
                    )
                    const rotated = rotateTileFace(tile.face, rotation)
                    expect(drawing.paths.map((path) => path.id)).toEqual(
                        tile.face.paths.map((path) => path.id)
                    )
                    for (const [index, path] of rotated.paths.entries()) {
                        const actual = [drawing.paths[index].start, drawing.paths[index].end]
                        path.endpoints.forEach((endpoint, i) => {
                            if (endpoint.kind === 'edge') {
                                const corner = edgeCorners[endpoint.edge]
                                const a = hex.vertices[corner],
                                    b = hex.vertices[(corner + 1) % 6]
                                expect(actual[i]).toEqual({
                                    x: (a.x + b.x) / 2,
                                    y: (a.y + b.y) / 2
                                })
                            } else {
                                expect(actual[i]).toEqual(
                                    drawing.nodes.find((node) => node.node.id === endpoint.nodeId)
                                        ?.center
                                )
                            }
                        })
                    }
                    for (const node of drawing.nodes) {
                        expect(node.slots).toHaveLength(
                            node.node.kind === 'city' ? node.node.stationSlots : 0
                        )
                    }
                }
                expect(JSON.stringify(tile)).toBe(serialized)
            }
        }
    )

    it('keeps pointy separate-city revenues attached to their cities through every rotation', () => {
        const tile = TileSpecimenGroups['All specimens'].find(
            (tile) => tile.id === 'example:double-city'
        )!
        for (const rotation of rotations) {
            const drawing = createTileDrawing(
                tile.face,
                HexOrientation.Pointy,
                rotation,
                SpecimenLayouts[tile.id]
            )
            const [west, east] = drawing.nodes
            for (const [city, other] of [
                [west, east],
                [east, west]
            ]) {
                const revenue = city.revenuePosition
                expect(
                    Math.hypot(revenue.x - city.center.x, revenue.y - city.center.y)
                ).toBeLessThan(Math.hypot(revenue.x - other.center.x, revenue.y - other.center.y))
            }
        }
    })

    it('requires layout for multiple nodes and rotates hints without changing edge endpoints', () => {
        const tile = TileSpecimenGroups['All specimens'].find(
            (tile) => tile.id === 'example:double-city'
        )!
        expect(() => createTileDrawing(tile.face)).toThrow('requires a position')
        const base = createTileDrawing(tile.face, HexOrientation.Flat, 0, SpecimenLayouts[tile.id])
        const rotated = createTileDrawing(
            tile.face,
            HexOrientation.Flat,
            3,
            SpecimenLayouts[tile.id]
        )
        expect(rotated.nodes[0].center.x).toBeCloseTo(-base.nodes[0].center.x)
        expect(rotated.nodes[0].center.y).toBeCloseTo(-base.nodes[0].center.y)
        const curve = StandardTileCatalog.get('18xx:8').face
        const hinted = createTileDrawing(curve, HexOrientation.Flat, 0, {
            pathControls: {
                'path-0': [
                    { x: 20, y: 10 },
                    { x: -20, y: -10 }
                ]
            }
        })
        const normal = createTileDrawing(curve)
        expect(hinted.paths[0].start).toEqual(normal.paths[0].start)
        expect(hinted.paths[0].end).toEqual(normal.paths[0].end)
        expect(hinted.paths[0].d).not.toBe(normal.paths[0].d)
    })
})
