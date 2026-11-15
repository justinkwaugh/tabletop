import {
    CashPayment,
    CompanyClosure,
    closeCorporationSchema,
    closeShareCompany,
    finiteCashOwnedBy,
    getCompany,
    marketDiscardOrder,
    marketDividendEarnings,
    marketValueEnding,
    privateOwner,
    settleCashPayments,
    EighteenXXTransferTiming,
    fullCapitalizationCompanyRules,
    type HydratedEighteenXXState,
    type PhaseRules,
    type PrivateEffect,
    type PrivatePowerRules,
    type PrivateRules,
    type PrivateTrackTerms,
    type TransferRules,
    type ZeroPriceClosureRules
} from '@tabletop/18xx'
import { assertExists, type GameAction } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Charters1850, UnionPacificId } from './companies.js'
import { Map1850, WestOfMississippi } from './map.js'
import { MesabiAccess } from './mesabiAccess.js'
import { Names1850 } from './names.js'
import {
    BridgeLocationId,
    BridgePrivateId,
    CreditMobilierPrivateId,
    GantPrivateId,
    LandGrantPrivateId,
    MesabiPrivateId,
    PrivateCatalog1850,
    privateDescription
} from './privates.js'
import { requireState1850, type HydratedState1850 } from './state.js'
import { Market1850 } from './stockMarket.js'
import { YellowTileIds1850 } from './tiles.js'
import { TrackRules1850 } from './track.js'
import { DieselVariant1850, Phases1850 } from './trains.js'

// A half dividend rounds each share's payment up, the company keeping the rest: of $130, shares get
// $7 and the company $60 (§9.1.2).
export const EarningsRules1850 = marketDividendEarnings({
    market: Market1850,
    charters: Charters1850,
    halfRetained: (revenue, count) => revenue - Math.ceil(revenue / 2 / count) * count
})

// Bankruptcy ends the game once presidents have decided on the shares it sold (§5.9, §12.1), a broken
// bank after the set of operating rounds (§12.2), and with the $400 finish a company reaching $400
// once it finishes operating (§16.1).
export const EndingRules1850 = marketValueEnding({
    market: Market1850,
    names: Names1850,
    privateFaceValue: (id) => PrivateCatalog1850.faceValue(id),
    bankruptcySettled: (state) => !requireState1850(state).priceProtection,
    finishPrice: {
        price: 400,
        active: (state) => !!requireState1850(state).variants.finish400,
        reason: '$400 share price'
    }
})

const ClosureFields = Type.Object(
    {
        ...CompanyClosure.properties,
        removedEdgeToken: Type.Optional(Type.Literal(true)),
        returnedMesabiRight: Type.Optional(Type.Literal(true)),
        forfeit: Type.Optional(CashPayment)
    },
    { additionalProperties: false }
)

const CloseCorporation1850 = closeCorporationSchema(ClosureFields.properties)
const ClosureValidator = Compile(CloseCorporation1850)
export function isClosure1850(
    action: GameAction
): action is Type.Static<typeof CloseCorporation1850> {
    return action.type === 'CloseCorporation' && ClosureValidator.Check(action)
}

/**
 * A closing company's tokens leave the map and its trains go to the market; closing while it funds
 * a train, its president's money goes to the bank too (§5.1.1, §10.7.2).
 */
export const ZeroPriceClosure1850: ZeroPriceClosureRules<typeof ClosureFields> = {
    market: Market1850,
    closure: {
        schema: ClosureFields,
        close(state: HydratedEighteenXXState, companyId) {
            const title = requireState1850(state)
            const president = getCompany(state, companyId).president
            const forfeit =
                president && title.trainFunding?.purchase.companyId === companyId
                    ? {
                          from: president,
                          to: { kind: 'bank' as const },
                          amount: finiteCashOwnedBy(state, president)
                      }
                    : undefined
            const closure = closeShareCompany(state, companyId, 'market')
            if (forfeit) settleCashPayments(state, [forfeit])
            const removedEdgeToken = title.edgeTokens.includes(companyId)
            const returnedMesabiRight = title.mesabiRights.includes(companyId)
            title.edgeTokens = title.edgeTokens.filter((id) => id !== companyId)
            title.mesabiRights = title.mesabiRights.filter((id) => id !== companyId)
            return {
                ...closure,
                ...(removedEdgeToken ? { removedEdgeToken: true as const } : {}),
                ...(returnedMesabiRight ? { returnedMesabiRight: true as const } : {}),
                ...(forfeit?.amount ? { forfeit } : {})
            }
        }
    }
}

export const PhaseRules1850: PhaseRules = {
    rustTiming: DieselVariant1850.rustTiming,
    discardOrder: (state, companyId) => marketDiscardOrder(Market1850, state, companyId),
    discardDestination: 'market'
}

export const LandGrantLays = 3

/** Whether a surviving private still has a lay, so that the first 5-train leaves it open (§15.2). */
function layUnused(state: HydratedState1850, privateCompanyId: string): boolean {
    if (privateCompanyId === CreditMobilierPrivateId)
        return !state.usedPrivatePowerIds.includes(privateCompanyId)
    if (privateCompanyId === LandGrantPrivateId) return state.landGrant.lays < LandGrantLays
    return privateCompanyId === GantPrivateId
}

/**
 * GRSC, MRBC, MMC and MMR close with the first 5-train; CM, GBCC and WLGC stay without income if
 * their lays are unused, until the first 6-train (§4.2.4, §4.2.5, §11.4).
 */
function closurePhaseEffects(stateObject: object): PrivateEffect[] {
    const state = requireState1850(stateObject)
    if (!Phases1850.isAtLeast(state.phaseId, '5')) return []
    const lateClose = Phases1850.isAtLeast(state.phaseId, '6')
    return state.companies.flatMap((company): PrivateEffect[] => {
        if (company.kind !== 'private' || company.closed) return []
        if (lateClose || !layUnused(state, company.id))
            return [{ kind: 'close', privateCompanyId: company.id }]
        return company.privateRevenue === 0
            ? []
            : [{ kind: 'income', privateCompanyId: company.id, revenue: 0 }]
    })
}

export const PrivateRules1850: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: closurePhaseEffects,
    operationEffects: () => [],
    description: (_state, id) => privateDescription(id),
    blocking: PrivateCatalog1850.blocking.bind(PrivateCatalog1850)
}

/** The privates companies may buy before the first 3-train, for up to face value (§11.1). */
const EarlySalePrivateIds: readonly string[] = [BridgePrivateId, MesabiPrivateId]

// A company buys a player's private for half to double its price from the first 3-train until the
// first 5-train; the bridge and the Mesabi from the start, for half to face value; and the Union
// Pacific may pay up to triple for the Crédit Mobilier (§4.1.2, §11.1).
export const TransferRules1850: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: Charters1850,
    afterPurchase(state, offer) {
        if (offer.asset.kind === 'private' && offer.asset.privateCompanyId === MesabiPrivateId)
            MesabiAccess.grant(state, offer.buyer.companyId)
    },
    priceRange(state, companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        if (asset.kind !== 'private') return undefined
        const { privateCompanyId } = asset
        if (
            privateOwner(state, privateCompanyId)?.kind !== 'player' ||
            Phases1850.isAtLeast(state.phaseId, '5')
        )
            return undefined
        const range = PrivateCatalog1850.priceRange(privateCompanyId)
        assertExists(range, 'Every 1850 private may be sold to a company')
        const faceValue = PrivateCatalog1850.faceValue(privateCompanyId)
        if (!Phases1850.isAtLeast(state.phaseId, '3'))
            return EarlySalePrivateIds.includes(privateCompanyId)
                ? { ...range, maximum: faceValue }
                : undefined
        return privateCompanyId === CreditMobilierPrivateId && companyId === UnionPacificId
            ? { ...range, maximum: faceValue * 3 }
            : range
    }
}

export const GantLayFee = 30

const ordinaryLayDone = (state: HydratedState1850) =>
    !!state.trackStep?.lays.length || !!state.mesabiBought

const laidThisTurn = (state: HydratedState1850, privateCompanyId: string) =>
    !!state.privateLaysThisTurn?.includes(privateCompanyId)

function buildableLocationIds(): readonly string[] {
    return Map1850.definition.locations.flatMap((location) =>
        location.buildable ? [location.id] : []
    )
}

function landGrantLocationIds(state: HydratedState1850): readonly string[] {
    return state.landGrant.usedAnywhere ? WestOfMississippi : buildableLocationIds()
}

/**
 * The extra yellow lays of CM, MRBC, GBCC and WLGC, each besides the company's ordinary lay and
 * after it, save the bridge's (§6.1.2, §15.1, §15.2).
 */
export const PrivatePowerRules1850: PrivatePowerRules = {
    earlyTrainCompany: () => undefined,
    trackTerms(stateObject, privateCompanyId, playerId) {
        const state = requireState1850(stateObject)
        const companyId = state.trackStep?.companyId
        if (
            !companyId ||
            state.machineState !== 'LayingTrack' ||
            !state.activePlayerIds.includes(playerId)
        )
            return undefined
        const owner = privateOwner(state, privateCompanyId)
        if (owner?.kind !== 'company' || owner.companyId !== companyId) return undefined
        const terms = {
            companyId,
            definitionIds: YellowTileIds1850,
            payer: owner,
            connected: true,
            restriction: (request) => TrackRules1850.restriction(state, request)
        } satisfies Partial<PrivateTrackTerms>
        if (privateCompanyId === BridgePrivateId)
            return { ...terms, locationIds: [BridgeLocationId], free: true }
        if (!ordinaryLayDone(state) || laidThisTurn(state, privateCompanyId)) return undefined
        if (privateCompanyId === CreditMobilierPrivateId)
            return { ...terms, locationIds: WestOfMississippi }
        if (privateCompanyId === GantPrivateId)
            return {
                ...terms,
                locationIds: buildableLocationIds(),
                layFee: GantLayFee,
                reusable: true
            }
        if (privateCompanyId === LandGrantPrivateId && state.landGrant.lays < LandGrantLays)
            return { ...terms, locationIds: landGrantLocationIds(state), reusable: true }
        return undefined
    },
    afterTrackLay(stateObject, privateCompanyId, details) {
        const state = requireState1850(stateObject)
        state.privateLaysThisTurn = [...(state.privateLaysThisTurn ?? []), privateCompanyId]
        if (privateCompanyId === BridgePrivateId) state.bridgeLaid = true
        if (privateCompanyId === LandGrantPrivateId)
            state.landGrant = {
                lays: state.landGrant.lays + 1,
                usedAnywhere:
                    state.landGrant.usedAnywhere || !WestOfMississippi.includes(details.locationId)
            }
        // A surviving private with no lay left has no more reason to stay open (§15.2).
        const spent =
            Phases1850.isAtLeast(state.phaseId, '5') && !layUnused(state, privateCompanyId)
        return { payments: [], closedPrivateIds: spent ? [privateCompanyId] : [] }
    }
}

// A company floats with six shares sold, and receives ten times par at the end of the stock round
// (§5.6.2, §5.6.4).
export const CompanyRules1850 = fullCapitalizationCompanyRules({
    market: Market1850,
    charters: Charters1850,
    ipoPoolId: 'initial-offering',
    parSpaceColor: 'pink',
    floatPercent: 60
})
