import { assertExists } from '@tabletop/common'
import {
    EighteenXXTransferTiming,
    RailwayMapState,
    controllingOwner,
    locationMarkers,
    placeLocationMarker,
    privateOwningCompany,
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
export const SteelMillId = 'PSM'
export const SteelMillLocation = 'F13'
export const SteelMillTile = '1817:X00'

type LayPower = {
    uses: number
    locationIds: readonly string[]
    definitionIds: readonly string[]
    marker?: string
} & Pick<PrivateTrackTerms, 'connected' | 'terrainDiscount' | 'relabels'>

// The coal mines' hexes are the mountains without a city, except E16; their tiles cost no
// mountain.
const Mine = {
    locationIds: [
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
    ],
    definitionIds: ['18xx:7', '18xx:8', '18xx:9'],
    marker: MineMarker,
    connected: true,
    terrainDiscount: 15
}
const LayPowers: Readonly<Record<string, LayPower>> = {
    MINC: { ...Mine, uses: 1 },
    CM: { ...Mine, uses: 2 },
    MAJC: { ...Mine, uses: 3 },
    [SteelMillId]: {
        uses: 1,
        locationIds: [SteelMillLocation],
        definitionIds: [SteelMillTile],
        connected: false,
        relabels: true
    }
}
const Bridges: Readonly<Record<string, number>> = { OBC: 1, UBC: 2 }
const BridgeLocations = ['H3', 'G6', 'H9']

function presidedCompany(
    state: CompanyDecisionState,
    privateId: string,
    playerId: string
): string | undefined {
    const companyId = privateOwningCompany(state, privateId)
    return companyId && controllingOwner(state, companyId)?.playerId === playerId
        ? companyId
        : undefined
}

function layingCompany(
    state: CompanyDecisionState,
    privateId: string,
    playerId: string
): string | undefined {
    const companyId = presidedCompany(state, privateId, playerId)
    return companyId &&
        state.machineState === 'LayingTrack' &&
        state.trackStep?.companyId === companyId
        ? companyId
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
    assertExists(definition, 'A mine is one of its private’s tiles')
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

export const EighteenSeventeenPrivatePowerRules: PrivatePowerRules = {
    trackTerms(state, privateId, playerId) {
        const power = LayPowers[privateId]
        const companyId = layingCompany(state, privateId, playerId)
        if (!power || !companyId) return undefined
        if (power.marker && usesLeft(state, privateId, power.uses) <= 0) return undefined
        return {
            companyId,
            locationIds: power.locationIds,
            definitionIds: power.definitionIds,
            payer: { kind: 'company', companyId },
            connected: power.connected,
            countsAsOrdinaryLay: true,
            ...(power.marker
                ? {
                      reusable: true,
                      restriction: (request: TrackRequest) => facesStop(state, request)
                  }
                : {}),
            ...(power.terrainDiscount ? { terrainDiscount: power.terrainDiscount } : {}),
            ...(power.relabels ? { relabels: true } : {})
        }
    },
    // A private closes once its lays are used up; a mine lay also marks its hex.
    afterTrackLay(state, privateId, details) {
        const power = LayPowers[privateId]
        assertExists(power, 'Only a private with a lay power lays track')
        if (power.marker)
            placeLocationMarker(state, {
                locationId: details.locationId,
                kind: power.marker,
                privateCompanyId: privateId
            })
        const usedUp = !power.marker || usesLeft(state, privateId, power.uses) <= 0
        return { payments: [], closedPrivateIds: usedUp ? [privateId] : [] }
    },
    markerTerms(state, privateId, playerId) {
        const uses = Bridges[privateId]
        const companyId = presidedCompany(state, privateId, playerId)
        if (
            !uses ||
            !companyId ||
            EighteenXXTransferTiming.operatingCompany(state) !== companyId ||
            usesLeft(state, privateId, uses) <= 0
        )
            return undefined
        const bridged = markersOf(state, BridgeMarker)
        return {
            kind: BridgeMarker,
            locationIds: BridgeLocations.filter((locationId) => !bridged.includes(locationId))
        }
    },
    earlyTrainCompany: () => undefined,
    betweenTurnsPrivateIds: []
}
