import {
    EighteenXXTransferTiming,
    controllingOwner,
    getCompany,
    privateOwningCompany,
    privatePowerUsed,
    type CompanyDecisionState,
    type PrivatePowerRules,
    type PrivateTrackTerms
} from '@tabletop/18xx'
import { CslId, DhId, EkId } from './ids.js'
import { AdrianLocationId } from './map.js'
import { TileSet1828 } from './tiles.js'
import { TrackRules1828, laidErieKalamazooExtra } from './track.js'

const BurlingtonLocationId = 'B24'
const ScrantonLocationId = 'F20'
/** The operating steps in which the Delaware & Hudson's power may be used (§13.2.2.4). */
const DelawareHudsonSteps = ['LayingTrack', 'PlacingStation']

/** The Delaware & Hudson's fee for its lay and station in Scranton (§13.2.2.4). */
export const DelawareHudsonFee = 120
/** The Erie & Kalamazoo's once-a-game extra yellow tile (§13.2.2.7). */
export const ErieKalamazooFee = 20

const tiles = (...numbers: string[]) => numbers.map((number) => `18xx:${number}`)
const BurlingtonTiles = tiles('3', '4', '58')
const AdrianTiles = tiles('1', '2', '55', '56', '69')
const YellowTileIds = TileSet1828.definitions
    .filter((tile) => tile.face.color === 'yellow')
    .map((tile) => tile.id)
const AllTileIds = TileSet1828.definitions.map((tile) => tile.id)

/** The company operating now, while the player directs it and it owns the private. */
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

/** The Champlain & St. Lawrence's free yellow tile in Burlington, at any time (§13.2.2.3). */
function champlainTerms(
    state: CompanyDecisionState,
    playerId: string
): PrivateTrackTerms | undefined {
    const companyId = owningOperatingCompany(state, CslId, playerId)
    if (
        !companyId ||
        privatePowerUsed(state, CslId) ||
        state.tileInventory.placements[BurlingtonLocationId]
    )
        return undefined
    return {
        companyId,
        locationIds: [BurlingtonLocationId],
        definitionIds: BurlingtonTiles,
        payer: { kind: 'company', companyId },
        connected: false,
        free: true
    }
}

/**
 * The Delaware & Hudson's lay or upgrade in Scranton for $120 as the company's lay, without a
 * connection, then a free station there as its station (§13.2.2.4).
 */
function delawareTerms(
    state: CompanyDecisionState,
    playerId: string
): PrivateTrackTerms | undefined {
    const companyId = owningOperatingCompany(state, DhId, playerId)
    if (
        !companyId ||
        !DelawareHudsonSteps.includes(state.machineState) ||
        state.trackStep?.companyId !== companyId
    )
        return undefined
    return {
        companyId,
        locationIds: [ScrantonLocationId],
        definitionIds: AllTileIds,
        payer: { kind: 'company', companyId },
        connected: false,
        countsAsOrdinaryLay: true,
        reusable: true,
        // The designer's card prices the tile and station at $120 together, Scranton's mountain
        // included.
        free: true,
        layFee: DelawareHudsonFee,
        restriction: (request) => TrackRules1828.restriction(state, request)
    }
}

/**
 * The Erie & Kalamazoo's tile in Adrian & Ann Arbor as a company buys it (§13.2.2.7), and its
 * once-a-game extra yellow tile for $20 in the track step, without an upgrade that round.
 */
function erieKalamazooTerms(
    state: CompanyDecisionState,
    playerId: string
): PrivateTrackTerms | undefined {
    const pending = state.privateTrackLay
    if (pending?.privateCompanyId === EkId) {
        const companyId = privateOwningCompany(state, EkId)
        return companyId && pending.playerId === playerId
            ? {
                  companyId,
                  locationIds: [AdrianLocationId],
                  definitionIds: AdrianTiles,
                  payer: { kind: 'company', companyId },
                  connected: false,
                  free: true,
                  reusable: true
              }
            : undefined
    }
    const companyId = owningOperatingCompany(state, EkId, playerId)
    if (
        !companyId ||
        privatePowerUsed(state, EkId) ||
        laidErieKalamazooExtra(state) ||
        state.machineState !== 'LayingTrack' ||
        state.trackStep?.companyId !== companyId
    )
        return undefined
    return {
        companyId,
        locationIds: TrackRules1828.map.definition.locations
            .filter((location) => location.buildable)
            .map((location) => location.id),
        definitionIds: YellowTileIds,
        payer: { kind: 'company', companyId },
        connected: true,
        colors: ['yellow'],
        layFee: ErieKalamazooFee,
        recordsLay: true,
        restriction(request) {
            if (
                (state.trackStep?.lays ?? []).some(
                    (lay) => lay.definitionId && !YellowTileIds.includes(lay.definitionId)
                )
            )
                return 'No extra tile in a round the company upgrades.'
            return TrackRules1828.restriction(state, request)
        }
    }
}

export const PrivatePowerRules1828: PrivatePowerRules = {
    trackTerms(state, privateCompanyId, playerId) {
        if (privateCompanyId === CslId) return champlainTerms(state, playerId)
        if (privateCompanyId === DhId) return delawareTerms(state, playerId)
        if (privateCompanyId === EkId) return erieKalamazooTerms(state, playerId)
        return undefined
    },
    earlyTrainCompany: () => undefined,
    betweenTurnsPrivateIds: [],
    stationPrivateIds: [DhId]
}
