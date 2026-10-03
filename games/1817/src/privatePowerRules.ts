import { assertExists } from '@tabletop/common'
import {
    EighteenXXTransferTiming,
    RailwayMapState,
    controllingOwner,
    locationMarkers,
    placeLocationMarker,
    removeLocationMarkers,
    privateOwningCompany,
    rotateTileFace,
    TileEdges,
    type CompanyDecisionState,
    type PrivatePowerRules,
    type PrivateTrackTerms,
    type TrackRequest
} from '@tabletop/18xx'
import { EighteenSeventeenMap } from './map.js'
import { CityTilePrivates } from './privates.js'
import { privateLaysMade, recordPrivateLay } from './state.js'
import { EighteenSeventeenTileSet } from './tiles.js'

export const MineMarker = 'mine'
export const BridgeMarker = 'bridge'
export const RanchMarker = 'ranch'
export const CityTile = '1817:X00'

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
// A ranch lays on one of these hexes, which it may not do beside a city tile.
const Ranch = {
    locationIds: [
        'B3',
        'B11',
        'B15',
        'B19',
        'B21',
        'B23',
        'C4',
        'C16',
        'C18',
        'D5',
        'D13',
        'D15',
        'D17',
        'E4',
        'E6',
        'E8',
        'E10',
        'E12',
        'E14',
        'F5',
        'F7',
        'F11',
        'G2',
        'G4',
        'G8',
        'G10',
        'H5',
        'H7',
        'I2',
        'I4'
    ],
    definitionIds: ['18xx:7', '18xx:8', '18xx:9'],
    marker: RanchMarker,
    connected: true
}
const LayPowers: Readonly<Record<string, LayPower>> = {
    MINC: { ...Mine, uses: 1 },
    CM: { ...Mine, uses: 2 },
    MAJC: { ...Mine, uses: 3 },
    P22: { ...Ranch, uses: 1 },
    P23: { ...Ranch, uses: 2 },
    ...Object.fromEntries(
        Object.entries(CityTilePrivates).map(([privateId, locationId]) => [
            privateId,
            {
                uses: 1,
                locationIds: [locationId],
                definitionIds: [CityTile],
                connected: false,
                relabels: true
            }
        ])
    )
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

function laysLeft(state: CompanyDecisionState, privateId: string, power: LayPower): number {
    return power.uses - privateLaysMade(state, privateId)
}

function bridgesLeft(state: CompanyDecisionState, privateId: string, uses: number): number {
    return uses - locationMarkers(state, { privateCompanyId: privateId }).length
}

function mapState(state: CompanyDecisionState): RailwayMapState {
    return new RailwayMapState(EighteenSeventeenMap, EighteenSeventeenTileSet, state.tileInventory)
}

const neighbourIds = (locationId: string) =>
    TileEdges.flatMap((edge) => EighteenSeventeenMap.neighbor(locationId, edge)?.id ?? [])

// A ranch may not be laid beside a city tile.
function besideCityTile(state: CompanyDecisionState, request: TrackRequest): string | undefined {
    const map = mapState(state)
    return neighbourIds(request.locationId).some((id) => map.tile(id).face.labels.includes('B'))
        ? 'A ranch may not be laid beside a city tile.'
        : undefined
}

// A mine or ranch faces a neighbouring city, town or offboard.
function facesStop(state: CompanyDecisionState, request: TrackRequest): string | undefined {
    const definition = EighteenSeventeenTileSet.definitions.find(
        (tile) => tile.id === request.definitionId
    )
    assertExists(definition, 'A mine is one of its private’s tiles')
    const map = mapState(state)
    const edges = rotateTileFace(definition.face, request.rotation).paths.flatMap((path) =>
        path.endpoints.flatMap((endpoint) => (endpoint.kind === 'edge' ? [endpoint.edge] : []))
    )
    const faces = edges.some((edge) => {
        const neighbor = EighteenSeventeenMap.neighbor(request.locationId, edge)
        return (
            !!neighbor && map.tile(neighbor.id).face.nodes.some((node) => node.kind !== 'junction')
        )
    })
    return faces ? undefined : 'The tile must face a neighbouring city, town or offboard.'
}

export function markersOf(state: CompanyDecisionState, kind: string): string[] {
    return locationMarkers(state, { kind }).map((marker) => marker.locationId)
}

export const EighteenSeventeenPrivatePowerRules: PrivatePowerRules = {
    trackTerms(state, privateId, playerId) {
        const power = LayPowers[privateId]
        const companyId = layingCompany(state, privateId, playerId)
        if (!power || !companyId || laysLeft(state, privateId, power) <= 0) return undefined
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
                      restriction: (request: TrackRequest) =>
                          facesStop(state, request) ??
                          (power.marker === RanchMarker
                              ? besideCityTile(state, request)
                              : undefined)
                  }
                : {}),
            ...(power.terrainDiscount ? { terrainDiscount: power.terrainDiscount } : {}),
            ...(power.relabels ? { relabels: true } : {})
        }
    },
    // A private closes once its lays are used up. A mine or ranch lay marks its hex; a city
    // tile clears the ranches beside it.
    afterTrackLay(state, privateId, details) {
        const power = LayPowers[privateId]
        assertExists(power, 'Only a private with a lay power lays track')
        recordPrivateLay(state, privateId)
        if (power.marker)
            placeLocationMarker(state, {
                locationId: details.locationId,
                kind: power.marker,
                privateCompanyId: privateId
            })
        if (details.definitionId === CityTile)
            for (const locationId of neighbourIds(details.locationId))
                removeLocationMarkers(state, { locationId, kind: RanchMarker })
        const usedUp = laysLeft(state, privateId, power) <= 0
        return { payments: [], closedPrivateIds: usedUp ? [privateId] : [] }
    },
    markerTerms(state, privateId, playerId) {
        const uses = Bridges[privateId]
        const companyId = presidedCompany(state, privateId, playerId)
        if (
            !uses ||
            !companyId ||
            EighteenXXTransferTiming.operatingCompany(state) !== companyId ||
            bridgesLeft(state, privateId, uses) <= 0
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
