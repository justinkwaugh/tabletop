import { expect, it } from 'vitest'
import { render } from 'svelte/server'
import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    StandardTileCatalog,
    TileSet,
    createSeparateCitiesTileFace,
    type TrackLayDetails
} from '@tabletop/18xx'
import TrackLayResult from '../lib/table/TrackLayResult.svelte'
import { towardTileEdge } from '../lib/tiles/standardTileLayouts.js'

const map = new RailwayMap({
    id: 'track-lay-result',
    name: 'Track lay result',
    orientation: HexOrientation.Flat,
    locations: [
        {
            id: 'oo',
            coordinates: { q: 0, r: 0 },
            preprintedTile: createSeparateCitiesTileFace('yellow', [
                { edges: [0], revenue: 30, stationSlots: 1 },
                { edges: [3], revenue: 30, stationSlots: 1 }
            ]),
            buildable: true
        }
    ]
})
const tileSet = new TileSet(
    { id: 'track-lay-result', entries: [{ id: 'oo', faceDefinitionIds: ['18xx:68'], count: 1 }] },
    [StandardTileCatalog]
)
const details: TrackLayDetails = {
    companyId: 'company',
    locationId: 'oo',
    definitionId: '18xx:68',
    rotation: 0,
    nodeMapping: { 'city-0': 'city-0', 'city-1': 'city-1' },
    placement: { pieceId: tileSet.pieces[0].id, definitionId: '18xx:68', rotation: 0 },
    cost: 0,
    terrainCost: 0,
    allowanceCost: 0,
    movedStations: []
}

it('draws a recorded upgrade of a multi-city hex with the map’s tile layouts', () => {
    const { body } = render(TrackLayResult, {
        props: {
            details,
            map,
            tileSet,
            layouts: {
                oo: {
                    nodePositions: {
                        'city-0': towardTileEdge(0, 20),
                        'city-1': towardTileEdge(3, 20)
                    }
                }
            }
        }
    })
    expect(body).toContain('aria-label="to"')
})
