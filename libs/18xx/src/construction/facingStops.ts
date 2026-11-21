import { assertExists } from '@tabletop/common'
import { RailwayMapState } from '../map/mapState.js'
import { rotateTileEdge, rotateTileFace } from '../tiles/topology.js'
import {
    TrackConstruction,
    type ConstructionState,
    type TrackRequest,
    type TrackRules
} from './trackConstruction.js'

/**
 * Whether one of the requested tile's exits points into a neighbouring hex with a stop that
 * track there meets, or could meet once upgraded, as 1817's mines and ranches and 18USA's
 * resource tiles must (1817 private companies; 18USA §13.1–§13.3). ``stopKinds`` are the kinds
 * of stop that count; ``excluded`` hexes, such as a resource tile's, never do.
 */
export function tileFacesStop(
    state: ConstructionState,
    rules: TrackRules,
    request: TrackRequest,
    stopKinds: readonly string[] = ['city', 'town', 'offboard'],
    excluded: (locationId: string) => boolean = () => false
): boolean {
    const definition = rules.tileSet.definitions.find((tile) => tile.id === request.definitionId)
    assertExists(definition, 'A requested tile is one of the set’s')
    const map = new RailwayMapState(rules.map, rules.tileSet, state.tileInventory)
    const edges = rotateTileFace(definition.face, request.rotation).paths.flatMap((path) =>
        path.endpoints.flatMap((endpoint) => (endpoint.kind === 'edge' ? [endpoint.edge] : []))
    )
    const construction = new TrackConstruction(state, rules)
    return edges.some((edge) => {
        const neighbor = rules.map.neighbor(request.locationId, edge)
        if (!neighbor || excluded(neighbor.id)) return false
        const tile = map.tile(neighbor.id)
        const face = rotateTileFace(tile.face, tile.rotation)
        return (
            face.nodes.some((node) => stopKinds.includes(node.kind)) &&
            (face.paths.some((path) =>
                path.endpoints.some(
                    (endpoint) =>
                        endpoint.kind === 'edge' && endpoint.edge === rotateTileEdge(edge, 3)
                )
            ) ||
                construction.hasFutureUpgrade(neighbor.id))
        )
    })
}
