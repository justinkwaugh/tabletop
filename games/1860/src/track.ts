import {
    companyStationCenters,
    inReceivership,
    rotateTileFace,
    sameStopCounts,
    trainsOwnedBy,
    type ConstructionState,
    type TileEndpoint,
    type TileFace,
    type TileNode,
    type TrackRequest,
    type TrackRules
} from '@tabletop/18xx'
import { company1860 } from './companies.js'
import { Map1860 } from './map.js'
import { requireState1860 } from './state.js'
import {
    FixedRotationTileIds,
    TileSet1860,
    YellowCowesTileId,
    mapState1860,
    tileFace1860
} from './tiles.js'
import { Phases1860, largeStationAllowance } from './trains.js'
import { TrainReach, boardFaces } from './trainReach.js'

function laidFaces(state: ConstructionState): TileFace[] {
    return (state.trackStep?.lays ?? []).flatMap((lay) =>
        lay.definitionId ? [tileFace1860(lay.definitionId)] : []
    )
}

const hasLargeStation = (face: TileFace) => face.nodes.some((node) => node.kind === 'city')

/** The largest train's large-station allowance; none without a train. */
function largestAllowance(state: ConstructionState, companyId: string): number {
    return Math.max(
        0,
        ...trainsOwnedBy(requireState1860(state), { kind: 'company', companyId }).map((train) =>
            largeStationAllowance(train.definitionId)
        )
    )
}

function endpointKey(endpoint: TileEndpoint, nodeMapping: Readonly<Record<string, string>>) {
    return endpoint.kind === 'node'
        ? `node:${nodeMapping[endpoint.nodeId] ?? endpoint.nodeId}`
        : `edge:${endpoint.edge}:${endpoint.lane ?? 0}`
}

function pathKey(
    path: TileFace['paths'][number],
    nodeMapping: Readonly<Record<string, string>> = {}
): string {
    return path.endpoints
        .map((endpoint) => endpointKey(endpoint, nodeMapping))
        .sort()
        .join('~')
}

const fixedRevenue = (node: TileNode | undefined) =>
    node && node.kind !== 'junction' && node.revenue.kind === 'fixed' ? node.revenue.amount : 0

/**
 * An upgrade must lie within reach of one of the company's trains, from a base and through no
 * tokened-out station, counting only large stations, and must add track that train could run
 * along, or raise the value of a stop it could call at (Upgrading Track).
 */
export function upgradeReason(state: ConstructionState, request: TrackRequest): string | undefined {
    const largeStations = largestAllowance(state, request.companyId)
    if (!largeStations) return 'A company without a train cannot upgrade track.'
    const mapState = mapState1860(state)
    const previous = mapState.tile(request.locationId)
    const before = rotateTileFace(previous.face, previous.rotation)
    const after = rotateTileFace(tileFace1860(request.definitionId), request.rotation)
    const mapped = (locationId: string, nodeId: string) =>
        locationId === request.locationId ? (request.nodeMapping[nodeId] ?? nodeId) : nodeId
    const stationsAt = (locationId: string, node: Extract<TileNode, { kind: 'city' }>) =>
        state.stations.filter(
            (station) =>
                station.status === 'placed' &&
                station.position.locationId === locationId &&
                mapped(locationId, station.position.nodeId) === node.id
        )
    const reach = new TrainReach(
        {
            mapState,
            face: boardFaces(mapState, { locationId: request.locationId, face: after }),
            passable(locationId, node) {
                if (node.kind === 'offboard') return false
                if (node.kind !== 'city') return true
                const stations = stationsAt(locationId, node)
                return (
                    stations.length < node.stationSlots ||
                    stations.some((station) => station.companyId === request.companyId)
                )
            }
        },
        companyStationCenters(state, request.companyId).map((center) => ({
            locationId: center.locationId,
            nodeId: mapped(center.locationId, center.nodeId)
        })),
        largeStations
    )
    const oldPaths = new Set(before.paths.map((path) => pathKey(path, request.nodeMapping)))
    const newTrack = after.paths.some(
        (path) => !oldPaths.has(pathKey(path)) && reach.reachesPath(request.locationId, path.id)
    )
    const raised = after.nodes.some((node) => {
        const oldId = Object.entries(request.nodeMapping).find(([, id]) => id === node.id)?.[0]
        const oldNode = before.nodes.find((entry) => entry.id === oldId)
        return (
            fixedRevenue(node) > fixedRevenue(oldNode) &&
            reach.reachesStop(request.locationId, node.id)
        )
    })
    return newTrack || raised
        ? undefined
        : 'The upgrade must add track or value that one of the company’s trains can reach.'
}

/** Whether the hex is one of the company's that it lays its home tile on as it floats. */
function layingHomeTile(state: ConstructionState, companyId: string): boolean {
    return requireState1860(state).homeTileCompanyId === companyId
}

export const TrackRules1860: TrackRules = {
    map: Map1860,
    tileSet: TileSet1860,
    colorOrder: ['white', 'yellow', 'green', 'brown'],
    availableColors: (state) => Phases1860.phase(state.phaseId).tileColors,
    // Two yellow tiles, or one with a large station, or one upgrade (Laying Track); none for a
    // company in receivership or once a stock round has followed the Southern's formation.
    allowance(state, color, upgrade) {
        const title = requireState1860(state)
        const companyId = state.trackStep?.companyId
        if (!companyId) return { reason: 'It is not a track step.' }
        if (layingHomeTile(state, companyId))
            return color === 'yellow' && !upgrade
                ? { cost: 0 }
                : { reason: 'The home hex takes a yellow tile.' }
        if (title.southernStockRound)
            return { reason: 'No track is built once the Southern Railway has formed.' }
        if (inReceivership(title, companyId))
            return { reason: 'A company in receivership lays no track.' }
        const laid = laidFaces(state)
        if (upgrade) {
            if (title.insolventIds.includes(companyId))
                return { reason: 'An insolvent company may not upgrade track.' }
            return laid.length
                ? { reason: 'An upgrade is the whole of a turn’s track.' }
                : { cost: 0 }
        }
        if (color !== 'yellow') return { reason: 'Only yellow tiles are laid on empty hexes.' }
        if (laid.length === 0) return { cost: 0 }
        return laid.length === 1 && laid[0].color === 'yellow' && !hasLargeStation(laid[0])
            ? { cost: 0 }
            : { reason: 'The company has laid its track this turn.' }
    },
    // The labelled Ventnor and Newport tiles split one large station into two (Tile Manifest).
    preservesStops: (before, after) =>
        sameStopCounts(before, after) ||
        after.labels.some((label) => label === 'V' || label === 'N'),
    restriction(state, request) {
        if (FixedRotationTileIds.includes(request.definitionId) && request.rotation !== 0)
            return 'This tile is laid only as printed.'
        // The yellow Cowes tile runs south or south-west (TR-9).
        if (request.definitionId === YellowCowesTileId && request.rotation > 1)
            return 'The Cowes tile runs south or south-west.'
        const face = tileFace1860(request.definitionId)
        if (layingHomeTile(state, request.companyId))
            return request.locationId === company1860(request.companyId).home
                ? undefined
                : 'The tile goes on the company’s home hex.'
        if (state.trackStep?.lays.length && hasLargeStation(face))
            return 'A large station tile is the only tile of the turn.'
        const title = requireState1860(state)
        const tile = mapState1860(state).tile(request.locationId)
        if (
            title.insolventIds.includes(request.companyId) &&
            !tile.placement &&
            Map1860.location(request.locationId).terrain
        )
            return 'An insolvent company may not build where track costs money.'
        return tile.placement || tile.face.color !== 'white'
            ? upgradeReason(state, request)
            : undefined
    },
    // Yellow track must join the company's track; upgrades are judged by the train's reach.
    useful: ({ home, connected, newTrack, increasedCityRevenue, connectedCity, connectedTown }) =>
        home || (connected && (newTrack || increasedCityRevenue || connectedCity || connectedTown)),
    homeLocations: (companyId) => [company1860(companyId).home]
}
