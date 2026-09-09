import { describe, expect, it } from 'vitest'
import {
    FlatHexDirection,
    HexGrid,
    HexOrientation,
    PointyHexDirection,
    calculateHexGeometry,
    createCoordinatedNode,
    hexNeighborCoords
} from '@tabletop/common'
import {
    parseTileDefinition,
    parseTileFace,
    rotateTileEdge,
    rotateTileFace,
    StandardTileCatalog,
    TileCatalog,
    tileEdgeDirection,
    tilePathsAtEndpoint,
    type TileDefinition,
    type TileEdge,
    type TileFace,
    type TileRotation
} from '../index.js'

const Edges: readonly TileEdge[] = [0, 1, 2, 3, 4, 5]
const Rotations: readonly TileRotation[] = Edges

describe('tile catalog identity', () => {
    it('preserves distinct same-number variants', () => {
        const standard = StandardTileCatalog.get('18xx:611')
        const variant: TileDefinition = {
            ...standard,
            id: '1832:611',
            scope: '1832',
            face: { ...standard.face, labels: ['Y'] }
        }
        const catalog = new TileCatalog([standard, variant])
        expect(catalog.findByPrintedNumber('611').map((tile) => tile.id)).toEqual([
            '18xx:611',
            '1832:611'
        ])
        expect(catalog.get('1832:611').face.paths).toEqual(standard.face.paths)
        expect(catalog.get('1832:611').face.labels).toEqual(['Y'])
        expect(catalog.get('18xx:611').face.labels).toEqual([])
        expect(parseTileDefinition(JSON.parse(JSON.stringify(variant)))).toEqual(variant)
        expect(() => catalog.get('611')).toThrow('Unknown tile definition')
        expect(() => new TileCatalog([standard, standard])).toThrow('Duplicate tile definition ID')
    })

    it('indexes aliases without making them canonical identities', () => {
        const tile = { ...StandardTileCatalog.get('18xx:7'), aliases: ['test-alias'] }
        const catalog = new TileCatalog([tile])
        expect(catalog.findByPrintedNumber('test-alias')).toEqual([catalog.get('18xx:7')])
        expect(catalog.findByPrintedNumber('missing')).toEqual([])
        expect(() => catalog.get('test-alias')).toThrow('Unknown tile definition')
    })

    it('owns frozen definitions independently of constructor input and enumeration arrays', () => {
        const labels = ['test-label']
        const definition = {
            ...StandardTileCatalog.get('18xx:7'),
            face: { ...StandardTileCatalog.get('18xx:7').face, labels }
        }
        const catalog = new TileCatalog([definition])
        labels.push('later-input-change')
        const stored = catalog.get(definition.id)
        expect(stored.face.labels).toEqual(['test-label'])
        expect(() => Object.assign(stored.face.paths[0].endpoints[0], { edge: 5 })).toThrow(
            TypeError
        )
        expect(() => Object.assign(stored.face.labels, { 0: 'changed' })).toThrow(TypeError)
        const entries = catalog.entries()
        Object.assign(entries, { 0: undefined })
        expect(catalog.get(definition.id)).toBe(stored)
    })

    it.each(StandardTileCatalog.entries())('round-trips $id through its schema', (definition) => {
        expect(parseTileDefinition(JSON.parse(JSON.stringify(definition)))).toEqual(definition)
    })
})

describe('tile topology', () => {
    it('keeps crossing paths separate and connects paths only at explicit shared endpoints', () => {
        const crossing = StandardTileCatalog.get('18xx:16').face
        expect(crossing.nodes).toEqual([])
        const first = tilePathsAtEndpoint(crossing, { kind: 'edge', edge: 0 })
        const second = tilePathsAtEndpoint(crossing, { kind: 'edge', edge: 1 })
        expect(first).toHaveLength(1)
        expect(second).toHaveLength(1)
        expect(first[0].endpoints).toEqual([
            { kind: 'edge', edge: 0 },
            { kind: 'edge', edge: 2 }
        ])
        expect(second[0].endpoints).toEqual([
            { kind: 'edge', edge: 1 },
            { kind: 'edge', edge: 3 }
        ])
        expect(first[0].id).not.toBe(second[0].id)

        const junction = StandardTileCatalog.get('18xx:81').face
        expect(tilePathsAtEndpoint(junction, { kind: 'node', nodeId: 'junction' })).toHaveLength(3)
        expect(junction.nodes).toEqual([{ kind: 'junction', id: 'junction' }])
        const city = StandardTileCatalog.get('18xx:14').face
        expect(tilePathsAtEndpoint(city, { kind: 'node', nodeId: 'city' })).toHaveLength(4)
        expect(city.nodes[0]).toMatchObject({ kind: 'city', stationSlots: 2 })
    })

    it('supports unnumbered preprinted tiles, separate cities, and title-owned revenue stages', () => {
        const printed: TileFace = {
            color: 'gray',
            nodes: [
                {
                    id: 'city',
                    kind: 'city',
                    stationSlots: 1,
                    revenue: {
                        kind: 'staged',
                        values: [
                            { stage: 'yellow', amount: 20 },
                            { stage: 'brown', amount: 60 }
                        ]
                    }
                }
            ],
            paths: ([0, 4, 5] satisfies TileEdge[]).map((edge) => ({
                id: `edge-${edge}`,
                endpoints: [
                    { kind: 'edge', edge },
                    { kind: 'node', nodeId: 'city' }
                ]
            })),
            labels: []
        }
        const restored = parseTileFace(JSON.parse(JSON.stringify(printed)))
        expect(restored).toEqual(printed)
        expect(restored).not.toHaveProperty('printedNumber')
        expect(restored).not.toHaveProperty('id')
        expect(parseTileFace({ color: 'white', nodes: [], paths: [], labels: [] }).nodes).toEqual(
            []
        )

        const separate = parseTileFace({
            ...printed,
            nodes: [...printed.nodes, { ...printed.nodes[0], id: 'second-city' }],
            paths: [
                printed.paths[0],
                {
                    id: 'second-path',
                    endpoints: [
                        { kind: 'edge', edge: 2 },
                        { kind: 'node', nodeId: 'second-city' }
                    ]
                }
            ]
        })
        expect(tilePathsAtEndpoint(separate, { kind: 'node', nodeId: 'city' })).toHaveLength(1)
        expect(tilePathsAtEndpoint(separate, { kind: 'node', nodeId: 'second-city' })).toHaveLength(
            1
        )
    })

    it.each([
        {
            paths: [
                {
                    id: 'p',
                    endpoints: [
                        { kind: 'edge', edge: 6 },
                        { kind: 'edge', edge: 1 }
                    ]
                }
            ]
        },
        {
            paths: [
                {
                    id: 'p',
                    endpoints: [
                        { kind: 'edge', edge: 0 },
                        { kind: 'node', nodeId: 'missing' }
                    ]
                }
            ]
        },
        {
            paths: [
                {
                    id: 'p',
                    endpoints: [
                        { kind: 'edge', edge: 0 },
                        { kind: 'edge', edge: 0 }
                    ]
                }
            ]
        },
        {
            nodes: [
                { id: 'j', kind: 'junction' },
                { id: 'j', kind: 'junction' }
            ]
        },
        {
            paths: [
                StandardTileCatalog.get('18xx:7').face.paths[0],
                StandardTileCatalog.get('18xx:7').face.paths[0]
            ]
        },
        {
            nodes: [
                { id: 'c', kind: 'city', stationSlots: -1, revenue: { kind: 'fixed', amount: 10 } }
            ]
        },
        {
            nodes: [
                {
                    id: 'c',
                    kind: 'city',
                    stationSlots: 1,
                    revenue: {
                        kind: 'staged',
                        values: [
                            { stage: 'yellow', amount: 10 },
                            { stage: 'yellow', amount: 20 }
                        ]
                    }
                }
            ]
        },
        { paths: [{ ...StandardTileCatalog.get('18xx:7').face.paths[0], gauge: 'dual' }] },
        { supply: 5 }
    ])('rejects invalid or unsupported topology: %j', (changes) => {
        expect(() =>
            parseTileFace({ ...StandardTileCatalog.get('18xx:7').face, ...changes })
        ).toThrow()
    })
})

describe('tile rotation and Common hex integration', () => {
    it.each(Rotations)(
        'rotates every edge by %i clockwise steps without changing node or path identity',
        (rotation) => {
            for (const edge of Edges) {
                expect(rotateTileEdge(edge, rotation)).toBe((edge + rotation) % 6)
            }
            for (const definition of StandardTileCatalog.entries()) {
                const rotated = rotateTileFace(definition.face, rotation)
                expect(rotated.nodes).toEqual(definition.face.nodes)
                expect(rotated.labels).toEqual(definition.face.labels)
                expect(rotated.paths.map((path) => path.id)).toEqual(
                    definition.face.paths.map((path) => path.id)
                )
                for (const [index, path] of definition.face.paths.entries()) {
                    expect(rotated.paths[index].endpoints).toEqual(
                        path.endpoints.map((endpoint) =>
                            endpoint.kind === 'edge'
                                ? { kind: 'edge', edge: (endpoint.edge + rotation) % 6 }
                                : endpoint
                        )
                    )
                }
                const inverse = Edges[(6 - rotation) % 6]
                expect(rotateTileFace(rotated, inverse)).toEqual(definition.face)
                expect(parseTileFace(JSON.parse(JSON.stringify(rotated)))).toEqual(rotated)
            }
        }
    )

    it('maps tile edges to Common directions for both orientations', () => {
        expect(Edges.map((edge) => tileEdgeDirection(edge, HexOrientation.Flat))).toEqual([
            FlatHexDirection.South,
            FlatHexDirection.Southwest,
            FlatHexDirection.Northwest,
            FlatHexDirection.North,
            FlatHexDirection.Northeast,
            FlatHexDirection.Southeast
        ])
        expect(Edges.map((edge) => tileEdgeDirection(edge, HexOrientation.Pointy))).toEqual([
            PointyHexDirection.Southwest,
            PointyHexDirection.West,
            PointyHexDirection.Northwest,
            PointyHexDirection.Northeast,
            PointyHexDirection.East,
            PointyHexDirection.Southeast
        ])
    })

    it.each([HexOrientation.Flat, HexOrientation.Pointy])(
        'meets neighbors across opposite edges in Common %s geometry',
        (orientation) => {
            const origin = { q: 0, r: 0 }
            const hexDefinition = { orientation, dimensions: { radius: 50 } }
            const grid = new HexGrid({ hexDefinition })
            const center = createCoordinatedNode(origin)
            grid.setNode(center)
            for (const edge of Edges) {
                const direction = tileEdgeDirection(edge, orientation)
                const coords = hexNeighborCoords(origin, orientation, direction)
                const neighbor = createCoordinatedNode(coords)
                grid.setNode(neighbor)
                expect(grid.neighborsOf(center, direction)).toEqual([neighbor])
                const opposite = tileEdgeDirection(rotateTileEdge(edge, 3), orientation)
                expect(hexNeighborCoords(coords, orientation, opposite)).toEqual(origin)

                const originalVertices = calculateHexGeometry(hexDefinition, origin).vertices
                const neighborVertices = calculateHexGeometry(hexDefinition, coords).vertices
                const shared = originalVertices.filter((a) =>
                    neighborVertices.some(
                        (b) => Math.abs(a.x - b.x) < 0.11 && Math.abs(a.y - b.y) < 0.11
                    )
                )
                expect(shared).toHaveLength(2)
            }
        }
    )
})
