import {
    EighteenXXTransferTiming,
    controllingOwner,
    getCompany,
    privateOwningCompany,
    privatePowerUsed,
    rotateTileFace,
    type CompanyDecisionState,
    type PrivatePowerRules,
    type PrivateTrackTerms,
    type TileEdge
} from '@tabletop/18xx'
import { PairedLays } from './companies.js'
import { CocId } from './ids.js'
import { MapChesapeake } from './map.js'
import { tileFaceChesapeake } from './tiles.js'

/** The straight and gentle tiles the paired lays use. */
const PairedTiles = ['18xx:8', '18xx:9']
const CanalHex = 'D2'

/** The company operating now, while the player is its president and it owns the private. */
function owningOperatingCompany(
    state: CompanyDecisionState,
    privateCompanyId: string,
    playerId: string
): string | undefined {
    const companyId = EighteenXXTransferTiming.operatingCompany(state)
    if (
        !companyId ||
        getCompany(state, privateCompanyId).closed ||
        privateOwningCompany(state, privateCompanyId) !== companyId ||
        controllingOwner(state, companyId)?.playerId !== playerId
    )
        return undefined
    return companyId
}

/** The side of one paired hex that faces the other. */
function facingEdge(locationId: string, partnerId: string): TileEdge {
    const edge = ([0, 1, 2, 3, 4, 5] as const).find(
        (candidate) => MapChesapeake.neighbor(locationId, candidate)?.id === partnerId
    )
    if (edge === undefined) throw new Error(`${locationId} and ${partnerId} are not neighbours`)
    return edge
}

/**
 * The two-tile privates lay tile 8 or 9 in each of their hexes, joined across the hexes' shared
 * side, besides the ordinary lay and without a connection. A tile anyone else lays in either hex
 * forfeits the power; once the first is laid the second must follow.
 */
function pairedTerms(
    state: CompanyDecisionState,
    privateCompanyId: string,
    playerId: string
): PrivateTrackTerms | undefined {
    const pair = PairedLays[privateCompanyId]
    if (!pair) return undefined
    const companyId = owningOperatingCompany(state, privateCompanyId, playerId)
    if (!companyId || state.machineState !== 'LayingTrack') return undefined
    if (state.trackStep?.companyId !== companyId) return undefined
    // The first of the pair, laid this turn, leaves the second to follow.
    const midway = !!state.trackStep?.extraLays?.some(
        (lay) => lay.privateCompanyId === privateCompanyId
    )
    if (!midway && !privatePowerOpen(state, privateCompanyId)) return undefined
    const open = pair.filter((locationId) => !state.tileInventory.placements[locationId])
    if (!open.length) return undefined
    return {
        companyId,
        locationIds: open,
        definitionIds: PairedTiles,
        payer: { kind: 'company', companyId },
        connected: false,
        reusable: true,
        together: true,
        recordsLay: true,
        restriction(request) {
            const partner = pair.find((locationId) => locationId !== request.locationId)
            if (!partner) return 'This tile cannot be laid here with this private.'
            const face = rotateTileFace(tileFaceChesapeake(request.definitionId), request.rotation)
            const edge = facingEdge(request.locationId, partner)
            return face.paths.some((path) =>
                path.endpoints.some((end) => end.kind === 'edge' && end.edge === edge)
            )
                ? undefined
                : 'The two tiles must join across their shared side.'
        }
    }
}

/**
 * The Chesapeake & Ohio Canal lays tile 57 on Berlin as the company's tile lay, without a
 * connection and paying the terrain; a free station there may follow.
 */
function canalTerms(state: CompanyDecisionState, playerId: string): PrivateTrackTerms | undefined {
    const companyId = owningOperatingCompany(state, CocId, playerId)
    if (
        !companyId ||
        !privatePowerOpen(state, CocId) ||
        state.machineState !== 'LayingTrack' ||
        state.trackStep?.companyId !== companyId ||
        state.trackStep.lays.length > 0
    )
        return undefined
    return {
        companyId,
        locationIds: [CanalHex],
        definitionIds: ['18xx:57'],
        payer: { kind: 'company', companyId },
        connected: false,
        countsAsOrdinaryLay: true
    }
}

/**
 * Whether a private's tile power is still to be used: both of a pair's hexes empty, or Berlin
 * empty and the Canal's power unused. Every other private has none.
 */
export function privatePowerOpen(
    state: Pick<CompanyDecisionState, 'tileInventory' | 'usedPrivatePowerIds'>,
    privateCompanyId: string
): boolean {
    const pair = PairedLays[privateCompanyId]
    if (pair) return pair.every((locationId) => !state.tileInventory.placements[locationId])
    return (
        privateCompanyId === CocId &&
        !privatePowerUsed(state, CocId) &&
        !state.tileInventory.placements[CanalHex]
    )
}

export const PrivatePowerRulesChesapeake: PrivatePowerRules = {
    trackTerms(state, privateCompanyId, playerId) {
        if (privateCompanyId === CocId) return canalTerms(state, playerId)
        return pairedTerms(state, privateCompanyId, playerId)
    },
    earlyTrainCompany: () => undefined,
    betweenTurnsPrivateIds: [],
    stationPrivateIds: [CocId]
}
