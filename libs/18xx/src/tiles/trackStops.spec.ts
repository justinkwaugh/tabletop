import { describe, expect, it } from 'vitest'
import { createTownTileFace, createTrackTileFace } from './faces.js'
import { rotateTileFace } from './topology.js'
import {
    carriedTrackStops,
    openTrackStopLines,
    trackStopNodeId,
    withTrackStops
} from './trackStops.js'

const crossing = createTrackTileFace('green', [
    [0, 3],
    [1, 4]
])

describe('track stops', () => {
    it('stand a town on the plain line between their edges', () => {
        const face = withTrackStops(crossing, [{ edges: [4, 1], revenue: 20 }])
        const town = face.nodes.find((node) => node.id === trackStopNodeId([1, 4]))
        expect(town).toMatchObject({ kind: 'town', revenue: { kind: 'fixed', amount: 20 } })
        expect(face.paths).toHaveLength(3)
        expect(
            face.paths.filter((path) =>
                path.endpoints.some((end) => end.kind === 'node' && end.nodeId === town?.id)
            )
        ).toHaveLength(2)
    })

    it('keep their place on the map when the tile is turned', () => {
        // The stop lies on map edges 2 and 5, which a tile turned by one shows as its 1 and 4.
        const face = withTrackStops(crossing, [{ edges: [2, 5], revenue: 20 }], 1)
        const turned = rotateTileFace(face, 1)
        const stop = trackStopNodeId([2, 5])
        const edges = turned.paths.flatMap((path) =>
            path.endpoints.some((end) => end.kind === 'node' && end.nodeId === stop)
                ? path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
                : []
        )
        expect(edges.sort()).toEqual([2, 5])
    })

    it('need plain track on their line', () => {
        expect(() => withTrackStops(crossing, [{ edges: [0, 1], revenue: 20 }])).toThrow()
    })

    it('carry a lone town on a line onto the same plain line of the replacing tile', () => {
        const yellow = createTownTileFace('yellow', [[0, 3]], 20)
        expect(carriedTrackStops(yellow, crossing)).toEqual([{ edges: [0, 3], revenue: 20 }])
        const elsewhere = createTrackTileFace('green', [
            [1, 3],
            [0, 4]
        ])
        expect(carriedTrackStops(yellow, elsewhere)).toEqual([])
    })

    it('leave only plain lines open, and none on a city tile', () => {
        const face = withTrackStops(crossing, [{ edges: [0, 3], revenue: 20 }])
        expect(openTrackStopLines(face)).toEqual([[1, 4]])
    })
})
