import { expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { TileEdges } from '@tabletop/18xx'
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
