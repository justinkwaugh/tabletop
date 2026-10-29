import * as Type from 'typebox'
import {
    EighteenXXTransferTiming,
    PrivateCatalog,
    RailwayMapState,
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    placeReference as place,
    privateOwner,
    privateOwningCompany,
    rotateTileFace,
    settleCashPayments,
    type FinancialState,
    type MapStateData,
    type PrivateEffect,
    type PrivateHoldings,
    type TileEdge,
    type PrivatePowerRules,
    type PrivateRules,
    type StationAccess,
    type TransferRules
} from '@tabletop/18xx'
import { Charters1833NE, Privates1833NE } from './companies.js'
import { Map1833NE, PrivateBlocks } from './map.js'
import { TileSet1833NE } from './tiles.js'
import { Phases1833NE } from './trains.js'

const Descriptions: Readonly<Record<string, string>> = {
    P1: `Blocks ${place('H23')} until a corporation buys it.`,
    P2: `Blocks ${place('G20')} until a corporation buys it. Its corporation lays a tile in ${place('G20')} for $0 in the operating round it buys it.`,
    P3: `Blocks ${place('C4')} and ${place('C6')} until a corporation buys it. Its corporation may lay two extra free tiles there at any time while it operates: the ${place('C4')} tile must connect to Montreal and the two to each other, without a connection to a token.`,
    P4: `Its corporation may lay track and run routes from ${place('A6')} as if it held a token there. Until phase IV, it doubles the bonuses of that corporation's routes from ${place('A6')} to Boston.`,
    P5: 'Doubles the value of one ferry its corporation owns, with any New or Last ferry bonus. Once assigned it stays with that ferry.',
    P6: `Its corporation pays $40 more to the bank when buying it. Its corporation may lay track and run routes from ${place('A12')} as if it held a token there, and only it may run to ${place('A12')}. Never removed.`
}

export const PrivateCatalog1833NE = new PrivateCatalog(
    {
        closurePhaseId: 'III',
        privates: Privates1833NE.map(({ blocks, ...company }) => ({
            ...company,
            description: Descriptions[company.id],
            ...(blocks ? { blocks: { locationIds: blocks, until: 'company-owned' as const } } : {}),
            sale: { minimum: 1, maximum: company.faceValue }
        }))
    },
    Phases1833NE
)

const RemovedAtIII = ['P1', 'P2']
const RemovedAtIV = ['P3', 'P4', 'P5']

/**
 * Phase III removes every private players still hold and P1–P2; phase IV removes P3–P5. The
 * D&H is never removed (§9).
 */
export function privatePhaseEffects(
    state: Parameters<PrivateRules['phaseEffects']>[0]
): PrivateEffect[] {
    const closing = (id: string) => {
        if (Phases1833NE.isAtLeast(state.phaseId, 'IV') && RemovedAtIV.includes(id)) return true
        if (!Phases1833NE.isAtLeast(state.phaseId, 'III')) return false
        return RemovedAtIII.includes(id) || privateOwner(state, id)?.kind !== 'company'
    }
    return state.companies
        .filter((company) => company.kind === 'private' && !company.closed && closing(company.id))
        .map((company) => ({ kind: 'close', privateCompanyId: company.id }))
}

export const PrivateRules1833NE: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: privatePhaseEffects,
    operationEffects: () => [],
    description: (_state, id) => PrivateCatalog1833NE.definition(id).description ?? '',
    blocking: PrivateCatalog1833NE.blocking.bind(PrivateCatalog1833NE)
}

/** The offboards the Ogdensburg and the D&H let their corporation build and run from. */
export const PrivateOffboards: Readonly<Record<string, string>> = { P4: 'A6', P6: 'A12' }

export function privateStationAccess(companyId: string, privateId: string): StationAccess {
    return {
        companyId,
        locationId: PrivateOffboards[privateId],
        nodeId: 'offboard',
        sourceId: privateId,
        placesStations: false
    }
}

/** The D&H's extra cost to its buyer, paid to the bank (§6.91). */
export const DelawareHudsonFee = 40

export const LowellPurchase = Type.Object(
    { companyId: Type.String(), operatingSet: Type.Integer(), round: Type.Integer() },
    { additionalProperties: false }
)
export type LowellPurchase = Type.Static<typeof LowellPurchase>
export const PrivateFields1833NE = { lowellPurchase: Type.Optional(LowellPurchase) }

type PrivatePurchaseState = Parameters<TransferRules['afterPurchase']>[0] &
    Type.Static<Type.TObject<typeof PrivateFields1833NE>>

export const TransferRules1833NE: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: Charters1833NE,
    priceRange(state, companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        if (asset.kind !== 'private') return undefined
        if (
            Phases1833NE.isAtLeast(state.phaseId, 'III') ||
            privateOwner(state, asset.privateCompanyId)?.kind !== 'player'
        )
            return undefined
        const range = PrivateCatalog1833NE.priceRange(asset.privateCompanyId)
        if (!range || asset.privateCompanyId !== 'P6') return range
        const treasury = finiteCashOwnedBy(state, { kind: 'company', companyId })
        const maximum = Math.min(range.maximum, treasury - DelawareHudsonFee)
        return maximum >= range.minimum ? { minimum: range.minimum, maximum } : undefined
    },
    afterPurchase(state: PrivatePurchaseState, offer) {
        if (offer.asset.kind !== 'private') return
        const companyId = offer.buyer.companyId
        const privateId = offer.asset.privateCompanyId
        if (privateId === 'P2' && state.operatingSet)
            state.lowellPurchase = {
                companyId,
                operatingSet: state.operatingSet.number,
                round: state.operatingSet.roundNumber
            }
        if (PrivateOffboards[privateId])
            state.stationAccess = [
                ...(state.stationAccess ?? []),
                privateStationAccess(companyId, privateId)
            ]
        if (privateId !== 'P6') return
        const charges = [
            {
                from: { kind: 'company' as const, companyId },
                to: { kind: 'bank' as const },
                amount: DelawareHudsonFee
            }
        ]
        settleCashPayments(state, charges)
        return { charges }
    }
}

/** Whether a corporation owns an open private. */
export function ownsPrivate(state: FinancialState, companyId: string, privateId: string): boolean {
    return (
        !getCompany(state, privateId).closed && privateOwningCompany(state, privateId) === companyId
    )
}

const ChamplainLays: Readonly<
    Record<string, { definitionIds: readonly string[]; exits: readonly TileEdge[] }>
> = {
    // St. Jean's tile reaches Montreal to the north-west and the second tile to the south.
    C4: { definitionIds: ['18xx:3', '18xx:4', '18xx:58'], exits: [2, 0] },
    C6: { definitionIds: ['18xx:7', '18xx:8', '18xx:9'], exits: [3] }
}

/** P3's two free lays in C4 and C6 (rulebook p. 13). */
export const PrivatePowerRules1833NE: PrivatePowerRules = {
    trackTerms(state, privateCompanyId, playerId) {
        if (privateCompanyId !== 'P3') return undefined
        const companyId = EighteenXXTransferTiming.operatingCompany(state)
        if (
            !companyId ||
            !ownsPrivate(state, companyId, 'P3') ||
            controllingOwner(state, companyId)?.playerId !== playerId
        )
            return undefined
        const open = Object.keys(ChamplainLays).filter(
            (locationId) => !state.tileInventory.placements[locationId]
        )
        if (!open.length) return undefined
        return {
            companyId,
            locationIds: open,
            definitionIds: open.flatMap((locationId) => ChamplainLays[locationId].definitionIds),
            payer: { kind: 'company', companyId },
            connected: false,
            reusable: true,
            // Once used, both tiles must be laid (rulebook p. 13).
            together: true,
            free: true,
            restriction(request) {
                const lay = ChamplainLays[request.locationId]
                const definition = TileSet1833NE.definitions.find(
                    (entry) => entry.id === request.definitionId
                )
                if (!definition || !lay.definitionIds.includes(request.definitionId))
                    return 'This tile cannot be laid here with the Champlain & St. Lawrence.'
                const face = rotateTileFace(definition.face, request.rotation)
                const exits = face.paths.flatMap((path) =>
                    path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
                )
                return lay.exits.every((exit) => exits.includes(exit))
                    ? undefined
                    : 'St. Jean’s tile must reach Montreal and the tile below it.'
            }
        }
    },
    earlyTrainCompany: () => undefined,
    betweenTurnsPrivateIds: []
}

export function blockedByPrivate(state: PrivateHoldings, locationId: string): boolean {
    return Object.entries(PrivateBlocks).some(
        ([privateId, locationIds]) =>
            locationIds.includes(locationId) &&
            state.companies.some((company) => company.id === privateId) &&
            PrivateCatalog1833NE.blocking(state, privateId)
    )
}

export function mapState(state: Pick<MapStateData, 'tileInventory'>): RailwayMapState {
    return new RailwayMapState(Map1833NE, TileSet1833NE, state.tileInventory)
}
