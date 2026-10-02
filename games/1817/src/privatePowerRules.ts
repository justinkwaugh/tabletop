import {
    EighteenXXTransferTiming,
    RailwayMapState,
    closePrivate,
    controllingOwner,
    locationMarkers,
    placeLocationMarker,
    privateOwner,
    rotateTileFace,
    type CompanyDecisionState,
    type PrivatePowerRules,
    type PrivateTrackTerms,
    type TrackRequest
} from '@tabletop/18xx'
import { EighteenSeventeenMap } from './map.js'
import { EighteenSeventeenTileSet } from './tiles.js'

export const MineMarker = 'mine'
export const BridgeMarker = 'bridge'

const MineLays: Readonly<Record<string, number>> = { MINC: 1, CM: 2, MAJC: 3 }
// The mountain hexes without a city.
const MineLocations = [
    'B25',
    'C20',
    'C24',
    'E18',
    'F15',
    'G12',
    'G14',
    'H11',
    'H13',
    'H15',
    'I8',
    'I10'
]
const MineTiles = ['18xx:7', '18xx:8', '18xx:9']
export const SteelMillId = 'PSM'
export const SteelMillLocation = 'F13'
export const SteelMillTile = '1817:X00'
const MountainCost = 15
const Bridges: Readonly<Record<string, number>> = { OBC: 1, UBC: 2 }
const BridgeLocations = ['H3', 'G6', 'H9']

/** The company owning the private, when its president is the player. */
function ownerCompanyFor(
    state: CompanyDecisionState,
    privateId: string,
    playerId: string
): string | undefined {
    const owner = privateOwner(state, privateId)
    return owner?.kind === 'company' &&
        controllingOwner(state, owner.companyId)?.playerId === playerId
        ? owner.companyId
        : undefined
}

function usesLeft(state: CompanyDecisionState, privateId: string, uses: number): number {
    return uses - locationMarkers(state, { privateCompanyId: privateId }).length
}

// A mine faces a neighbouring city, town or offboard.
function facesStop(state: CompanyDecisionState, request: TrackRequest): string | undefined {
    const definition = EighteenSeventeenTileSet.definitions.find(
        (tile) => tile.id === request.definitionId
    )
    if (!definition) return 'Unknown tile.'
    const mapState = new RailwayMapState(
        EighteenSeventeenMap,
        EighteenSeventeenTileSet,
        state.tileInventory
    )
    const edges = rotateTileFace(definition.face, request.rotation).paths.flatMap((path) =>
        path.endpoints.flatMap((endpoint) => (endpoint.kind === 'edge' ? [endpoint.edge] : []))
    )
    const faces = edges.some((edge) => {
        const neighbor = EighteenSeventeenMap.neighbor(request.locationId, edge)
        return (
            !!neighbor &&
            mapState.tile(neighbor.id).face.nodes.some((node) => node.kind !== 'junction')
        )
    })
    return faces ? undefined : 'A mine must face a neighbouring city, town or offboard.'
}

export function markersOf(state: CompanyDecisionState, kind: string): string[] {
    return locationMarkers(state, { kind }).map((marker) => marker.locationId)
}

function steelMillTerms(
    state: CompanyDecisionState,
    playerId: string
): PrivateTrackTerms | undefined {
    const companyId = ownerCompanyFor(state, SteelMillId, playerId)
    if (
        !companyId ||
        state.machineState !== 'LayingTrack' ||
        state.trackStep?.companyId !== companyId
    )
        return undefined
    return {
        companyId,
        locationIds: [SteelMillLocation],
        definitionIds: [SteelMillTile],
        payer: { kind: 'company', companyId },
        connected: false,
        countsAsOrdinaryLay: true,
        relabels: true
    }
}

export const EighteenSeventeenPrivatePowerRules: PrivatePowerRules = {
    trackTerms(state, privateId, playerId) {
        if (privateId === SteelMillId) return steelMillTerms(state, playerId)
        const uses = MineLays[privateId]
        const companyId = ownerCompanyFor(state, privateId, playerId)
        if (
            !uses ||
            !companyId ||
            state.machineState !== 'LayingTrack' ||
            state.trackStep?.companyId !== companyId ||
            usesLeft(state, privateId, uses) <= 0
        )
            return undefined
        return {
            companyId,
            locationIds: MineLocations,
            definitionIds: MineTiles,
            payer: { kind: 'company', companyId },
            connected: true,
            countsAsOrdinaryLay: true,
            reusable: true,
            terrainDiscount: MountainCost,
            restriction: (request) => facesStop(state, request)
        }
    },
    afterTrackLay(state, privateId, details) {
        if (privateId === SteelMillId) {
            closePrivate(state, privateId)
            return
        }
        placeLocationMarker(state, {
            locationId: details.locationId,
            kind: MineMarker,
            privateCompanyId: privateId
        })
        const uses = MineLays[privateId]
        if (uses && usesLeft(state, privateId, uses) <= 0) closePrivate(state, privateId)
    },
    markerTerms(state, privateId, playerId) {
        const uses = Bridges[privateId]
        const companyId = ownerCompanyFor(state, privateId, playerId)
        if (
            !uses ||
            !companyId ||
            EighteenXXTransferTiming.operatingCompany(state) !== companyId ||
            usesLeft(state, privateId, uses) <= 0
        )
            return undefined
        const bridged = markersOf(state, BridgeMarker)
        return {
            companyId,
            kind: BridgeMarker,
            locationIds: BridgeLocations.filter((locationId) => !bridged.includes(locationId))
        }
    },
    earlyTrainCompany: () => undefined,
    betweenTurnsPrivateIds: []
}
