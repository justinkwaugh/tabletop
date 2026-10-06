import { type MapToken, type MapRoute } from '@tabletop/18xx-ui'
import { PlaygroundTitles, type PlaygroundTitle } from '../titles.js'

export const MapExamples = Object.fromEntries(
    PlaygroundTitles.map((title) => [title.key, example(title)])
)

function example(title: PlaygroundTitle) {
    const { map, mapLayouts: layouts = {}, mapView } = title
    const { locationId, definitionId, rotation, label } = title.mapExample
    const tileSet = title.rules.trackRules.tileSet
    const initial = tileSet.createInventory()
    const prepared = tileSet.createInventory([{ locationId, definitionId, rotation }])
    const tokens: readonly MapToken[] = [
        { id: 'example-station', locationId, nodeId: 'city', slot: 0, color: '#285cb4', label }
    ]
    const routes: readonly MapRoute[] = [
        { id: 'example-segment', color: '#c52b64', segments: [{ locationId, pathId: 'edge-0' }] }
    ]
    return { map, tileSet, initial, prepared, tokens, routes, layouts, mapView }
}
