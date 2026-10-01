import { TheOldPrinceMap, TheOldPrinceTileSet } from '@tabletop/the-old-prince'
import { Shikoku1889Map, Shikoku1889TileSet } from '@tabletop/shikoku-1889'
import { EighteenThirtyMapView } from '@tabletop/1830-ui'
import { type RailwayMap, type TileSet, type TileRotation } from '@tabletop/18xx'
import { type MapToken, type MapRoute, type TileLayout } from '@tabletop/18xx-ui'

export const MapExamples = {
    TOP: example(TheOldPrinceMap, TheOldPrinceTileSet, 'K19', 0, 'CB'),
    '1889': example(Shikoku1889Map, Shikoku1889TileSet, 'I2', 2, 'SR'),
    '1830': example(
        EighteenThirtyMapView.map,
        EighteenThirtyMapView.tileSet,
        'H10',
        1,
        'PRR',
        '18xx:57',
        EighteenThirtyMapView.layouts
    )
}

function example(
    map: RailwayMap,
    tileSet: TileSet,
    locationId: string,
    rotation: TileRotation,
    label: string,
    definitionId = '18xx:5',
    layouts: Readonly<Record<string, TileLayout>> = {}
) {
    const initial = tileSet.createInventory()
    const prepared = tileSet.createInventory([{ locationId, definitionId, rotation }])
    const tokens: readonly MapToken[] = [
        { id: 'example-station', locationId, nodeId: 'city', slot: 0, color: '#285cb4', label }
    ]
    const routes: readonly MapRoute[] = [
        { id: 'example-segment', color: '#c52b64', segments: [{ locationId, pathId: 'edge-0' }] }
    ]
    return { map, tileSet, initial, prepared, tokens, routes, layouts }
}
