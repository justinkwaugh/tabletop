import { describe, expect, it } from 'vitest'
import { calculateHexGeometry, HexOrientation } from '@tabletop/common'
import {
    StandardTileCatalog,
    parseTileDefinition,
    type TileFace,
    type TileRotation
} from '@tabletop/18xx'
import { createTileDrawing } from '../lib/tiles/tileDrawing.js'
import { filterTileDefinitions } from '../lib/tiles/tilePresentation.js'
import { tilePathPoint } from '../lib/tiles/tileTrackGeometry.js'
import { StandardTileLayouts } from '../lib/tiles/standardTileLayouts.js'

const rotations: readonly TileRotation[] = [0, 1, 2, 3, 4, 5]

describe('tile drawing geometry', () => {
    it('keeps the two town markers on 56 outside the other track circle', () => {
        const tile = StandardTileCatalog.get('18xx:56')
        for (const orientation of [HexOrientation.Flat, HexOrientation.Pointy]) {
            for (const rotation of rotations) {
                const drawing = createTileDrawing(
                    tile.face,
                    orientation,
                    rotation,
                    StandardTileLayouts[tile.id]
                )
                for (const node of drawing.nodes) {
                    const otherIds = tile.face.paths
                        .filter(
                            (path) =>
                                !path.endpoints.some(
                                    (endpoint) =>
                                        endpoint.kind === 'node' && endpoint.nodeId === node.node.id
                                )
                        )
                        .map((path) => path.id)
                    const distances = drawing.paths
                        .filter((path) => otherIds.includes(path.id))
                        .flatMap((path) =>
                            Array.from({ length: 51 }, (_, index) => {
                                const point = tilePathPoint(path, index / 50)
                                return Math.hypot(point.x - node.center.x, point.y - node.center.y)
                            })
                        )
                    expect(Math.min(...distances)).toBeGreaterThan(9)
                    for (const path of drawing.paths.filter((path) => otherIds.includes(path.id))) {
                        expect(path.arc).toBeDefined()
                        if (!path.arc) throw new Error('Expected circular track on 56')
                        expect(
                            Math.hypot(
                                node.center.x - path.arc.center.x,
                                node.center.y - path.arc.center.y
                            )
                        ).toBeGreaterThan(path.arc.radius + 9)
                    }
                }
            }
        }
        const drawing = createTileDrawing(
            tile.face,
            HexOrientation.Flat,
            0,
            StandardTileLayouts[tile.id]
        )
        const [first, second] = drawing.nodes
        expect(first.center.x).toBeCloseTo(second.center.x, 2)
        expect(first.center.y).toBeCloseTo(-second.center.y, 2)
        expect(first.revenuePosition.x).toBeCloseTo(second.revenuePosition.x)
        expect(first.revenuePosition.y).toBeCloseTo(-second.revenuePosition.y)
    })
    it('draws a continuous curve through a town with matching tangents', () => {
        const drawing = createTileDrawing(StandardTileCatalog.get('18xx:3').face)
        const [a, b] = drawing.paths
        expect(a.end).toEqual(b.end)
        expect(drawing.nodes[0].center).not.toEqual({ x: 0, y: 0 })
        expect(a.end.x - a.controls[1].x).toBeCloseTo(b.controls[1].x - b.end.x)
        expect(a.end.y - a.controls[1].y).toBeCloseTo(b.controls[1].y - b.end.y)
        expect(a.arc?.center).toEqual(b.arc?.center)
        expect(a.arc?.radius).toBeCloseTo(25)
    })

    it('uses circular track with perpendicular edge tangents for tight and gentle curves', () => {
        for (const orientation of [HexOrientation.Flat, HexOrientation.Pointy]) {
            for (const rotation of rotations) {
                for (const id of ['18xx:7', '18xx:8', '18xx:16']) {
                    const drawing = createTileDrawing(
                        StandardTileCatalog.get(id).face,
                        orientation,
                        rotation
                    )
                    for (const path of drawing.paths) {
                        const arc = path.arc!
                        expect(arc.radius).toBeCloseTo(id === '18xx:7' ? 25 : 75)
                        for (const point of [path.start, path.end]) {
                            const radial = { x: point.x - arc.center.x, y: point.y - arc.center.y }
                            expect(Math.hypot(radial.x, radial.y)).toBeCloseTo(arc.radius)
                            expect(radial.x * point.x + radial.y * point.y).toBeCloseTo(0)
                        }
                    }
                }
                expect(
                    createTileDrawing(StandardTileCatalog.get('18xx:9').face, orientation, rotation)
                        .paths[0].arc
                ).toBeUndefined()
            }
        }
    })

    it('keeps circular revenues on corner-to-center lines in both orientations', () => {
        for (const orientation of [HexOrientation.Flat, HexOrientation.Pointy]) {
            const hex = calculateHexGeometry(
                { orientation, dimensions: { radius: 50 } },
                { q: 0, r: 0 }
            )
            for (const tile of StandardTileCatalog.entries()) {
                for (const rotation of rotations) {
                    const drawing = createTileDrawing(tile.face, orientation, rotation)
                    for (const { node, revenuePosition } of drawing.nodes) {
                        if (node.kind === 'junction' || node.revenue.kind !== 'fixed') continue
                        expect(
                            hex.vertices.some(
                                (corner) =>
                                    Math.abs(
                                        corner.x * revenuePosition.y - corner.y * revenuePosition.x
                                    ) < 0.001 &&
                                    corner.x * revenuePosition.x + corner.y * revenuePosition.y > 0
                            )
                        ).toBe(true)
                    }
                }
            }
        }
    })

    it('keeps crossings distinct and uses explicit node identity for junctions', () => {
        const crossing = createTileDrawing(StandardTileCatalog.get('18xx:16').face)
        expect(crossing.nodes).toEqual([])
        expect(crossing.paths).toHaveLength(2)
        const junction = createTileDrawing(StandardTileCatalog.get('18xx:81').face)
        expect(junction.nodes[0].node.kind).toBe('junction')
        expect(junction.paths.every((path) => path.end === junction.nodes[0].center)).toBe(true)
    })

    it('renders a blank preprinted tile without requiring an invented tile number', () => {
        const face: TileFace = { color: 'white', nodes: [], paths: [], labels: [] }
        expect(createTileDrawing(face).paths).toEqual([])
    })
})

describe('tile viewer filtering', () => {
    const defaults = { search: '', color: '', track: 'all', stop: 'all' } as const
    it('preserves number collisions and combines title, label, color, track, and stop filters', () => {
        const tiles = [
            ...StandardTileCatalog.entries(),
            parseTileDefinition({
                ...StandardTileCatalog.get('18xx:611'),
                id: 'example:611',
                scope: 'Example set',
                face: { ...StandardTileCatalog.get('18xx:611').face, labels: ['CX'] }
            })
        ]
        expect(
            filterTileDefinitions(tiles, { ...defaults, search: '611' }).map((tile) => tile.id)
        ).toEqual(['18xx:611', 'example:611'])
        expect(
            filterTileDefinitions(tiles, {
                ...defaults,
                search: ' CX ',
                color: 'brown',
                stop: 'city'
            }).map((tile) => tile.id)
        ).toEqual(['example:611'])
        expect(
            filterTileDefinitions(tiles, { ...defaults, search: 'Example set', track: 'edge' })
        ).toEqual([])
        expect(
            filterTileDefinitions(tiles, { ...defaults, stop: 'town', track: 'node' }).map(
                (tile) => tile.id
            )
        ).toEqual([
            '18xx:1',
            '18xx:3',
            '18xx:56',
            '18xx:58',
            '18xx:143',
            '18xx:144',
            '18xx:437',
            '18xx:630',
            '18xx:631',
            '18xx:632',
            '18xx:633',
            '18xx:767',
            '18xx:769'
        ])
    })
})
