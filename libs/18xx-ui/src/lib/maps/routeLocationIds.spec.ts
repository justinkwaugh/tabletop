import { expect, it } from 'vitest'
import { HexOrientation, assertExists } from '@tabletop/common'
import { RailwayMap, TileEdges, rotateTileEdge, type TileFace } from '@tabletop/18xx'
import { TestHomeLocationId, TestOpenLocationId, minimalRailwayMap } from '@tabletop/18xx/testing'
import { routeLocationIds, type MapRoute } from './mapDrawing.js'

const route: MapRoute = {
    id: 'route',
    color: 'purple',
    segments: [{ locationId: TestHomeLocationId, pathId: 'path' }]
}
const between = TileEdges.find(
    (edge) => minimalRailwayMap.neighbor(TestHomeLocationId, edge)?.id === TestOpenLocationId
)
const back = TileEdges.find(
    (edge) => minimalRailwayMap.neighbor(TestOpenLocationId, edge)?.id === TestHomeLocationId
)

it('reaches every hex printed in the same area as a hex the route passes through', () => {
    assertExists(between)
    assertExists(back)
    expect(routeLocationIds([route], { map: minimalRailwayMap })).toEqual([TestHomeLocationId])
    expect(
        routeLocationIds([route], {
            map: minimalRailwayMap,
            joinedEdges: { [TestHomeLocationId]: [between], [TestOpenLocationId]: [back] }
        })
    ).toEqual([TestHomeLocationId, TestOpenLocationId])
})

it('reaches only the side of a split hex that the route or its joined area reaches', () => {
    const below = TileEdges.find(
        (edge) => minimalRailwayMap.neighbor(TestHomeLocationId, edge)?.id === TestOpenLocationId
    )
    assertExists(below)
    const above = rotateTileEdge(below, 3)
    const face: TileFace = {
        color: 'red',
        labels: [],
        nodes: ['upper', 'lower'].map((id) => ({
            id,
            kind: 'offboard' as const,
            revenue: { kind: 'fixed' as const, amount: 0 }
        })),
        paths: [
            {
                id: 'up',
                endpoints: [
                    { kind: 'edge', edge: above },
                    { kind: 'node', nodeId: 'upper' }
                ]
            },
            {
                id: 'down',
                endpoints: [
                    { kind: 'edge', edge: below },
                    { kind: 'node', nodeId: 'lower' }
                ]
            }
        ]
    }
    const map = new RailwayMap({
        id: 'split',
        name: 'Split',
        orientation: HexOrientation.Flat,
        locations: ['top', 'middle', 'bottom'].map((id, r) => ({
            id,
            coordinates: { q: 0, r },
            buildable: false,
            preprintedTile: face
        }))
    })
    const view = {
        map,
        joinedEdges: { top: [below], middle: [above, below], bottom: [above] },
        splitHexes: { middle: [rotateTileEdge(above, 5), above, rotateTileEdge(above, 1)] }
    }
    const runs = (locationId: string, pathId: string) =>
        routeLocationIds(
            [{ id: 'route', color: 'purple', segments: [{ locationId, pathId }] }],
            view
        )
    expect(runs('top', 'down').sort()).toEqual(['middle', 'top'])
    expect(runs('middle', 'down').sort()).toEqual(['bottom', 'middle'])
    expect(
        routeLocationIds([{ ...route, segments: [{ locationId: 'top', pathId: 'down' }] }], {
            ...view,
            splitHexes: {}
        }).sort()
    ).toEqual(['bottom', 'middle', 'top'])
})
