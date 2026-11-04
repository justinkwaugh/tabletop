import { assertExists } from '@tabletop/common'
import {
    laidTileFace,
    privateOwner,
    rotateTileFace,
    sameStopCounts,
    type ConstructionState,
    type TileEdge,
    type TileFace,
    type TrackRules
} from '@tabletop/18xx'
import { stationWarsAfterLay } from './destinations.js'
import { Map1870, RiverHexes, type RiverHex } from './map.js'
import { BridgePrivateId } from './privates.js'
import { requireState1870 } from './state.js'
import { TileSet1870 } from './tiles.js'
import { Phases1870 } from './trains.js'

/** Until the bridge company is sold to a company or closes, no track may cross the river (p. 9). */
export function riverClosed(state: ConstructionState): boolean {
    const company = state.companies.find((entry) => entry.id === BridgePrivateId)
    return !!company && !company.closed && privateOwner(state, BridgePrivateId)?.kind !== 'company'
}

function connectedEdges(face: TileFace): TileEdge[][] {
    const groups: TileEdge[][] = []
    for (const path of face.paths) {
        const edges = path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
        const nodes = path.endpoints.flatMap((end) => (end.kind === 'node' ? [end.nodeId] : []))
        const related = face.paths
            .filter((other) =>
                other.endpoints.some(
                    (end) =>
                        (end.kind === 'node' && nodes.includes(end.nodeId)) ||
                        (end.kind === 'edge' && edges.includes(end.edge))
                )
            )
            .flatMap((other) =>
                other.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
            )
        groups.push([...new Set([...edges, ...related])])
    }
    return groups
}

export function crossesRiver(river: RiverHex, face: TileFace): boolean {
    const stopEdges = river.stopBank === undefined ? undefined : river.banks[river.stopBank]
    return connectedEdges(face).some((edges) =>
        stopEdges
            ? edges.some((edge) => !stopEdges.includes(edge))
            : river.banks.every((bank) => edges.some((edge) => bank.includes(edge)))
    )
}

const lays = (state: ConstructionState) =>
    (state.trackStep?.lays ?? []).map((lay) => laidTileFace(state, TrackRules1870, lay))

export const TrackRules1870: TrackRules = {
    map: Map1870,
    tileSet: TileSet1870,
    colorOrder: ['white', 'yellow', 'green', 'brown', 'gray'],
    availableColors: (state) => Phases1870.phase(state.phaseId).tileColors,
    // A company lays two yellow tiles or upgrades one tile (p. 18).
    allowance(state, color, upgrade) {
        const laid = lays(state).map((face) => face.color !== 'yellow')
        const all = [...laid, color !== 'yellow' || !!upgrade]
        const upgrades = all.filter((lay) => lay).length
        const yellows = all.length - upgrades
        return (upgrades === 0 && yellows <= 2) || (upgrades === 1 && yellows === 0)
            ? { cost: 0 }
            : { reason: 'A company lays two yellow tiles or upgrades one tile.' }
    },
    preservesStops: sameStopCounts,
    // New track must be reachable, or the new tile a stop the company can run to (p. 18).
    useful: ({ home, newTrack, connectedCity, connectedTown }) =>
        home || newTrack || connectedCity || connectedTown,
    homeLocations: (companyId) => Map1870.reservedLocationIds(companyId),
    afterLay(state, details) {
        stationWarsAfterLay(state, details.locationId)
        return { payments: [], closedPrivateIds: [] }
    },
    restriction(state, request) {
        if (state.trackStep?.lays.some((lay) => lay.locationId === request.locationId))
            return 'A tile laid this turn cannot be replaced'
        if (requireState1870(state).bridgeLayLocationId === request.locationId)
            return 'A tile laid with the Bridge Company cannot be upgraded this operating round'
        const river = RiverHexes[request.locationId]
        if (!river || !riverClosed(state)) return undefined
        const definition = TileSet1870.definitions.find((tile) => tile.id === request.definitionId)
        assertExists(definition, 'A track request names a tile of the set')
        return crossesRiver(river, rotateTileFace(definition.face, request.rotation))
            ? 'No track may cross the Mississippi until the Bridge Company is sold or closed'
            : undefined
    }
}
