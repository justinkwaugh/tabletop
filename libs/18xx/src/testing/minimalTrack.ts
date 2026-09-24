import { HexOrientation } from '@tabletop/common'
import type { TrackRules } from '../construction/trackConstruction.js'
import { RailwayMap } from '../map/map.js'
import { createCityTileFace, createTrackTileFace } from '../tiles/faces.js'
import { TileSet } from '../tiles/inventory.js'
import { StandardTileCatalog } from '../tiles/standardCatalog.js'

export const TestTrackHomeLocationId = '0,0'

export const minimalTrackTileSet = new TileSet(
    {
        id: 'test-track',
        entries: [
            { id: 'gentle', faceDefinitionIds: ['18xx:8'], count: 2 },
            { id: 'straight', faceDefinitionIds: ['18xx:9'], count: 2 }
        ]
    },
    [StandardTileCatalog]
)
export const straightOnlyTrackTileSet = new TileSet(
    {
        id: 'test-straight',
        entries: [{ id: 'straight', faceDefinitionIds: ['18xx:9'], count: 2 }]
    },
    [StandardTileCatalog]
)

const Radius = 2
const Span = Array.from({ length: Radius * 2 + 1 }, (_, index) => index - Radius)
export const minimalTrackMap = new RailwayMap({
    id: 'test-track',
    name: 'Test track',
    orientation: HexOrientation.Flat,
    locations: Span.flatMap((q) =>
        Span.filter((r) => Math.abs(q + r) <= Radius).map((r) => ({
            id: `${q},${r}`,
            coordinates: { q, r },
            buildable: true,
            preprintedTile:
                q === 0 && r === 0
                    ? createCityTileFace('green', [0, 3], 30, 1)
                    : createTrackTileFace('white', [])
        }))
    )
})

export function minimalTrackRules(tileSet: TileSet = minimalTrackTileSet): TrackRules {
    return {
        map: minimalTrackMap,
        tileSet,
        colorOrder: ['white', 'yellow', 'green'],
        availableColors: () => ['yellow'],
        allowance: () => ({ cost: 0 }),
        preservesStops: () => true,
        restriction: () => undefined,
        useful: (change) => change.newTrack,
        homeLocations: () => [TestTrackHomeLocationId]
    }
}
