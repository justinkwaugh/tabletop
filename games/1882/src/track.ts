import { assertExists } from '@tabletop/common'
import {
    RailwayMapState,
    completedCrossingCost,
    homeStationId,
    laidTileFace,
    privateOwner,
    rotateTileEdge,
    rotateTileFace,
    type CashPayment,
    type ConstructionState,
    type TileEdge,
    type TileFace,
    type TrackLayDetails,
    type TrackRules
} from '@tabletop/18xx'
import { CrossingIncome, PrivateCatalog1882, TbId } from './companies.js'
import { Map1882, RebellionLocations } from './map.js'
import { TileSet1882, preservesStops1882, tileFace1882 } from './tiles.js'
import { Phases1882 } from './trains.js'

/** A second yellow tile costs $20 (§11.3.1). */
export const SecondLayCost = 20
/** A yellow tile laid in a rebellion hex earns $20 (§11.3.1). */
export const RebellionLayBonus = 20

const TrackData = { map: Map1882, tileSet: TileSet1882 }

/** The company's home hex while it still has no track, where it must build first (§11.3.1). */
function untrackedHome(state: ConstructionState, companyId: string): string | undefined {
    const home = state.stations.find((station) => station.id === homeStationId(companyId))
    if (home?.status !== 'placed') return undefined
    const { locationId } = home.position
    return new RailwayMapState(Map1882, TileSet1882, state.tileInventory).tile(locationId).face
        .paths.length
        ? undefined
        : locationId
}

function edgesOf(face: TileFace): Set<TileEdge> {
    return new Set(
        face.paths.flatMap((path) =>
            path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
        )
    )
}

/** The hexside's river cost, the higher printed on either side. */
function riverCost(locationId: string, edge: TileEdge): number {
    const neighbor = Map1882.neighbor(locationId, edge)
    assertExists(neighbor, 'A laid tile’s track stays on the map')
    const opposite = rotateTileEdge(edge, 3)
    return Math.max(
        0,
        ...(Map1882.location(locationId).borders ?? [])
            .filter((border) => border.edge === edge && border.kind === 'water')
            .map((border) => border.cost ?? 0),
        ...(neighbor.borders ?? [])
            .filter((border) => border.edge === opposite && border.kind === 'water')
            .map((border) => border.cost ?? 0)
    )
}

/** The river hexsides a lay newly connects across (§11.3.3), once its tile is on the board. */
export function completedRiverCrossings(
    state: ConstructionState,
    details: TrackLayDetails
): TileEdge[] {
    const previous = details.previous
    const before = previous
        ? rotateTileFace(tileFace1882(previous.definitionId), previous.rotation)
        : Map1882.preprintedTiles[details.locationId]
    assertExists(before, 'A lay replaces a known tile')
    const beforeEdges = edgesOf(before)
    const after = rotateTileFace(tileFace1882(details.definitionId), details.rotation)
    return [...edgesOf(after)].filter(
        (edge) =>
            !beforeEdges.has(edge) &&
            completedCrossingCost(
                TrackData,
                state,
                details,
                edge,
                riverCost(details.locationId, edge)
            ) > 0
    )
}

/** The Trestle Bridge's owner earns $10 a newly completed river crossing (§7.1.4). */
function trestleIncome(state: ConstructionState, details: TrackLayDetails): CashPayment[] {
    const bridge = state.companies.find((company) => company.id === TbId)
    const owner = bridge && !bridge.closed ? privateOwner(state, TbId) : undefined
    const crossings = owner ? completedRiverCrossings(state, details).length : 0
    return owner && crossings
        ? [{ from: { kind: 'bank' }, to: owner, amount: crossings * CrossingIncome }]
        : []
}

/** A yellow tile laid, not upgraded, in a rebellion hex earns its layer $20 (§11.3.1). */
function rebellionBonus(details: TrackLayDetails): CashPayment[] {
    const face = tileFace1882(details.definitionId)
    return RebellionLocations.includes(details.locationId) &&
        face.color === 'yellow' &&
        !details.previous
        ? [
              {
                  from: { kind: 'bank' },
                  to: { kind: 'company', companyId: details.companyId },
                  amount: RebellionLayBonus
              }
          ]
        : []
}

export const TrackRules1882: TrackRules = {
    ...TrackData,
    colorOrder: ['white', 'yellow', 'green', 'brown'],
    availableColors: (state) => Phases1882.phase(state.phaseId).tileColors,
    // One or two yellow tiles, the second for $20, or one upgrade (§11.3).
    allowance(state, color, upgrade) {
        const lays = state.trackStep?.lays ?? []
        if (!lays.length) return { cost: 0 }
        if (lays.length > 1) return { reason: 'A company lays at most two tiles a turn.' }
        if (
            laidTileFace(state, TrackRules1882, lays[0]).color !== 'yellow' ||
            color !== 'yellow' ||
            upgrade
        )
            return { reason: 'A company lays two yellow tiles or makes one upgrade.' }
        return { cost: SecondLayCost }
    },
    preservesStops: preservesStops1882,
    // Track is permissive: a lay needs only some track reachable from a station (§11.3.2).
    useful: ({ home, connected }) => home || connected,
    homeLocations: (companyId) => Map1882.reservedLocationIds(companyId),
    // Only completing a crossing pays its river cost (§11.3.3).
    borderCost: (state, request, edge, cost) =>
        completedCrossingCost(TrackData, state, request, edge, cost),
    restriction(state, request) {
        if (PrivateCatalog1882.blockedBy(state, request.locationId))
            return 'A player-owned private company blocks this hex.'
        const home = untrackedHome(state, request.companyId)
        if (home && home !== request.locationId)
            return 'A company builds in its home hex before anywhere else.'
        return undefined
    },
    afterLay(state, details) {
        return {
            payments: [...trestleIncome(state, details), ...rebellionBonus(details)],
            closedPrivateIds: []
        }
    }
}
