import {
    EighteenXXTransferTiming,
    TrackNetwork,
    certificateWealthItem,
    companyStationCenters,
    floatedCompaniesInMarketOrder,
    getCompany,
    marketDiscardOrder,
    payOrWithholdEarningsRules,
    presidentTrainFundingRules,
    privateOwner,
    requiresStationRoute,
    treasuryPoolId,
    trainsOwnedBy,
    type EarningsRules,
    type EndingRules,
    type EndingState,
    type GameEnding,
    type OperatingRules,
    type PhaseRules,
    type PrivateRules,
    type TrainRules,
    type TransferRules,
    type CompanyDecisionState,
    type StockState,
    type TrainPurchaseState
} from '@tabletop/18xx'
import * as Type from 'typebox'
import {
    IncomeFromPhase,
    PrivateCatalogRoyalGorge,
    RailroadIdsRoyalGorge,
    SulphurSpringsId
} from './companies.js'
import { debtPenaltySteps, signTreaty } from './debt.js'
import { shippedGoldRevenue } from './gold.js'
import { MapRoyalGorge, SulphurSpringsLocationId } from './map.js'
import { BankPoolIdRoyalGorge, NamesRoyalGorge } from './names.js'
import { privateDescription } from './privateText.js'
import { settlementDue, payoutMove } from './settlement.js'
import { emptyClosedPrivates } from './privateHoldings.js'
import { requireStateRoyalGorge } from './state.js'
import { ChartersRoyalGorge, StockRulesRoyalGorge, isMetalCompany } from './stock.js'
import { MarketRoyalGorge, companyMove } from './stockMarket.js'
import { TileSetRoyalGorge, mapStateRoyalGorge } from './tiles.js'
import {
    PhasesRoyalGorge,
    SalvageRoyalGorge,
    SilverSixPhaseId,
    TrainDepotRoyalGorge,
    TreatyPhaseId,
    colorPhase,
    phaseAfterDeparture,
    trainsExportedRoyalGorge
} from './trains.js'

const ColorRank = { Yellow: 0, Green: 1, Brown: 2, Silver: 3 } as const

/** Whether the game has reached the colour phase. */
export function inColorPhase(phaseId: string, color: keyof typeof ColorRank): boolean {
    return ColorRank[colorPhase(phaseId)] >= ColorRank[color]
}

/** The railroads, in share price order; the steel and gold companies never operate (OO-1). */
function railroadOrder(state: Pick<StockState, 'companies' | 'stockMarket'>): string[] {
    return floatedCompaniesInMarketOrder(MarketRoyalGorge, state).filter(
        (id) => !isMetalCompany(state, id)
    )
}

export const OperatingRulesRoyalGorge: OperatingRules = {
    charters: ChartersRoyalGorge,
    roundCount: () => 2,
    companyOrder: railroadOrder,
    // A train leaves after every set: all the 2+ while one is next (RT-7).
    trainsToExport(state) {
        const set = state.operatingSet
        return set && set.roundNumber === set.roundCount
            ? trainsExportedRoyalGorge(state.trainInventory)
            : []
    },
    // Some privates pay only from a phase on; Sulphur Springs pays its player owner once a tile
    // is laid there, and nothing to a railroad (PV-1, B2).
    privateIncome(state, privateId) {
        const card = PrivateCatalogRoyalGorge.definition(privateId)
        const from = IncomeFromPhase[privateId]
        if (from && !inColorPhase(state.phaseId, from)) return 0
        if (privateId !== SulphurSpringsId) return card.revenue
        const owner = privateOwner(state, privateId)
        const laid = !!mapStateRoyalGorge(state).tile(SulphurSpringsLocationId).placement
        return owner?.kind === 'player' && laid ? card.revenue : 0
    }
}

const payOrWithhold = payOrWithholdEarningsRules(MarketRoyalGorge, ChartersRoyalGorge, {
    unpaidPoolIds: [BankPoolIdRoyalGorge],
    companyPoolIds: RailroadIdsRoyalGorge.map((id) => treasuryPoolId(id))
})

/**
 * Pay or withhold. A payout moves the price a space right for each multiple of the price paid,
 * at most three; withholding, or earning nothing, a space left. Shipped gold joins the revenue
 * (Pay Dividends, Shipping Gold).
 */
export const EarningsRulesRoyalGorge: EarningsRules = {
    ...payOrWithhold,
    revenueAddition: (state, companyId) => shippedGoldRevenue(state, companyId),
    marketEffect(state, companyId, distribution) {
        const payout = distribution.revenue - distribution.retained
        if (payout > 0) {
            const move = payoutMove(state.stockMarket, companyId, payout)
            return { bonusPerShare: 0, ...(move ? { move } : {}) }
        }
        const move = companyMove(state.stockMarket, companyId, 'left', 1)
        return { bonusPerShare: 0, ...(move ? { move } : {}) }
    }
}

const PhaseChangesRoyalGorge = Type.Object(
    {
        /** The Treaty of Boston was signed (DB-1). */
        treaty: Type.Optional(Type.Literal(true)),
        /** The first 6x2 triggered the game's end, bought or exported (EG-2). */
        endTriggered: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)

export const PhaseRulesRoyalGorge: PhaseRules = {
    rustTiming: (state, train) => PhasesRoyalGorge.rustTiming(state.phaseId, train.definitionId),
    discardOrder: (state, companyId) => marketDiscardOrder(MarketRoyalGorge, state, companyId),
    discardDestination: 'market',
    changes: {
        schema: PhaseChangesRoyalGorge,
        apply(state, event) {
            const title = requireStateRoyalGorge(state)
            emptyClosedPrivates(title)
            if (event.toPhaseId === TreatyPhaseId) {
                signTreaty(state)
                return { treaty: true as const }
            }
            if (event.toPhaseId === SilverSixPhaseId) {
                const bought = title.trainInventory.trains.some(
                    (train) => train.id === event.trainId && train.status === 'owned'
                )
                title.trainEndTrigger = {
                    setNumber: title.operatingSet?.number ?? 1,
                    byExport: !bought
                }
                return { endTriggered: true as const }
            }
            return {}
        }
    }
}

export const PrivateRulesRoyalGorge: PrivateRules = {
    exchangeTerms: () => undefined,
    // The privates close with the first 5+, but those whose cards say otherwise (PV-2).
    phaseEffects: (state) => PrivateCatalogRoyalGorge.closureEffects(state),
    operationEffects: () => [],
    description: privateDescription
}

/** The trains a company owns that the train now leaving the depot would rust. */
function rustedBy(state: TrainPurchaseState, companyId: string, definitionId: string) {
    const phaseId = phaseAfterDeparture(state, definitionId)
    if (phaseId === state.phaseId) return []
    return trainsOwnedBy(state, { kind: 'company', companyId }).filter(
        (train) => PhasesRoyalGorge.rustTiming(phaseId, train.definitionId) === 'immediate'
    )
}

export const TrainRulesRoyalGorge: TrainRules = {
    depot: TrainDepotRoyalGorge,
    // A company must own a train only if it has a route to run (RT-8).
    requiresTrain: requiresStationRoute(MapRoyalGorge, TileSetRoyalGorge),
    availableDefinitions: (state) => {
        const next = TrainDepotRoyalGorge.nextDefinitionId(state.trainInventory)
        return next ? [next] : []
    },
    exchangePrice: () => undefined,
    phaseAfterPurchase: (state, definitionId) => phaseAfterDeparture(state, definitionId),
    trainLimit: () => 2,
    // A purchase that rusts one of the company's own trains may take it past the limit (RT-4).
    limitExemption: (state, companyId, definitionId) =>
        rustedBy(state, companyId, definitionId).length > 0,
    purchaseLimit: () => 'unlimited',
    // A rusted train's company receives its salvage from the bank (Rusting Events).
    afterTrainsDepart: (_state, departures) =>
        departures.flatMap((departure) => {
            const salvage = SalvageRoyalGorge[departure.definitionId]
            return departure.cause === 'rust' && salvage && departure.owner?.kind === 'company'
                ? [{ from: { kind: 'bank' as const }, to: departure.owner, amount: salvage }]
                : []
        })
}

/**
 * Trains change hands between railroads for $1 or more; from the Green phase until Silver,
 * railroads buy players' privates for half to twice their face value (Buying Private Assets).
 */
export const TransferRulesRoyalGorge: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: ChartersRoyalGorge,
    // A train comes only from a railroad whose stations the buyer's track reaches (RT-9).
    canPurchase(state, companyId, asset) {
        if (!EighteenXXTransferTiming.canPurchase(state, companyId, asset)) return false
        if (asset.kind !== 'train') return true
        const train = state.trainInventory.trains.find((entry) => entry.id === asset.trainId)
        return (
            train?.status !== 'owned' ||
            train.owner.kind !== 'company' ||
            stationsConnected(state, companyId, train.owner.companyId)
        )
    },
    priceRange(state, _companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        if (asset.kind !== 'private') return undefined
        const color = colorPhase(state.phaseId)
        return (color === 'Green' || color === 'Brown') &&
            privateOwner(state, asset.privateCompanyId)?.kind === 'player'
            ? PrivateCatalogRoyalGorge.priceRange(asset.privateCompanyId)
            : undefined
    },
    afterPurchase: () => {}
}

/** Whether the buyer's track reaches one of the seller's stations, unblocked (RT-9). */
function stationsConnected(
    state: CompanyDecisionState,
    buyerId: string,
    sellerId: string
): boolean {
    const network = new TrackNetwork(mapStateRoyalGorge(state), state, buyerId)
    return companyStationCenters(state, sellerId).some((center) =>
        network.reaches(center.locationId, { kind: 'node', nodeId: center.nodeId })
    )
}

/**
 * The president makes up a train the railroad cannot afford, selling shares as they must, but
 * never so a presidency changes hands (Emergency Fundraising).
 */
export const TrainFundingRulesRoyalGorge = presidentTrainFundingRules({
    repeatSales: 'separate',
    companyOrder: railroadOrder,
    saleTerms: StockRulesRoyalGorge.saleTerms,
    stockRules: StockRulesRoyalGorge,
    protectsPresidency: () => true
})

export const BankruptcyReason = 'A player is bankrupt'
export const MarketCapReason = 'A railroad reached the red spaces'
export const LastTrainReason = 'The first 6x2 train left the depot'

/** The set a game ends after, once an ending set is known: the earlier ending wins. */
function earliest(endings: readonly (GameEnding | undefined)[]): GameEnding | undefined {
    return endings
        .filter((ending): ending is GameEnding => !!ending)
        .reduce<GameEnding | undefined>(
            (best, ending) =>
                !best ||
                (ending.finalOperatingSet ?? Infinity) < (best.finalOperatingSet ?? Infinity)
                    ? ending
                    : best,
            undefined
        )
}

/**
 * Bankruptcy ends the game at once. A railroad in the red spaces ends it after the current set,
 * or the coming set when reached in a stock round. The first 6x2 ends it after one more stock
 * round and set; with the Shorter Game, after the current set unless an export triggered it
 * (EG-2, EG-4, OQ-11).
 */
function triggerRoyalGorge(state: EndingState): GameEnding | undefined {
    if (state.bankruptcy) return { reason: BankruptcyReason }
    const title = requireStateRoyalGorge(state)
    const set = state.operatingSet
    const currentSet = set ? (set.completed ? set.number + 1 : set.number) : 1
    const capped = state.stockMarket.stacks.some(
        (stack) =>
            MarketRoyalGorge.space(stack.spaceId).color === 'red' &&
            stack.companyIds.some((id) => !isMetalCompany(state, id))
    )
    const trigger = title.trainEndTrigger
    return earliest([
        capped ? { reason: MarketCapReason, finalOperatingSet: currentSet } : undefined,
        trigger
            ? {
                  reason: LastTrainReason,
                  finalOperatingSet:
                      trigger.setNumber + (title.shorterGame && !trigger.byExport ? 0 : 1)
              }
            : undefined
    ])
}

export const EndingRulesRoyalGorge: EndingRules = {
    trigger: triggerRoyalGorge,
    roundPending: (state) => settlementDue(state),
    // Shares count at their final price, after unpaid debt moves Rio Grande's or Santa Fe's
    // price left; privates count for nothing (EG-5, DB-6).
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        if (certificate.kind !== 'share' || !company.started || company.closed)
            return [certificateWealthItem(NamesRoyalGorge, certificate, 0)]
        const from = MarketRoyalGorge.companySpace(state.stockMarket, company.id)
        const price = MarketRoyalGorge.move(
            from.id,
            'left',
            debtPenaltySteps(state, company.id)
        ).price
        return [certificateWealthItem(NamesRoyalGorge, certificate, price * certificate.shares)]
    }
}
