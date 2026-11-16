import { assertExists } from '@tabletop/common'
import {
    EighteenXXTransferTiming,
    bankExhaustionAtSetEnd,
    certificateWealthItem,
    CompanyClosure,
    settleCashPayments,
    type CashPayment,
    closeShareCompany,
    finiteCashOwnedBy,
    getCompany,
    marketDiscardOrder,
    trainsOwnedBy,
    payOrWithholdEarningsRules,
    presidentTrainFundingRules,
    privateOwner,
    reorderPendingOperatingCompanies,
    requiresStationRoute,
    type CashCrisisRules,
    type EarningsRules,
    type EndingRules,
    type OperatingRules,
    type PhaseRules,
    type PrivateRules,
    type StockMarketMove,
    type TrainPurchaseState,
    type TrainRules,
    type TransferRules,
    type ZeroPriceClosureRules
} from '@tabletop/18xx'
import { forgetClosedCompany, meetsOperatingThreshold } from './capitalization.js'
import { UnredeemedLoans, unredeemedLoans } from './loans.js'
import { Charters1856 } from './charters.js'
import { CgrId, PrivateCatalog1856 } from './companies.js'
import { Map1856 } from './map.js'
import { IpoPoolId1856, MarketPoolId1856, Names1856 } from './names.js'
import { grantPrivateRight } from './rights.js'
import { requireState1856 } from './state.js'
import { StockRules1856, emergencySaleTerms, nationalPriceFixed } from './stock.js'
import { ClosingSpaceIds1856, Market1856 } from './stockMarket.js'
import { TileSet1856 } from './tiles.js'
import {
    NationalTrainLimit,
    Phases1856,
    PrivatePurchasePhaseIds,
    TrainDepot1856,
    FinalTrainCredit,
    finalTrainId,
    finalTrainSales,
    isPermanentTrain
} from './trains.js'

/**
 * Companies operate in share price order: those that have operated before, and those whose
 * shares sold from the initial offering reach the train on sale (Operating Round, Initial
 * Shares Needed to Operate). A company that falls short when its turn comes does not operate.
 */
export const OperatingRules1856: OperatingRules = {
    charters: Charters1856,
    roundCount: (state) => Phases1856.phase(state.phaseId).operatingRounds,
    // A company already waiting its turn keeps its place, to be passed over if it falls short.
    companyOrder(state) {
        const title = requireState1856(state)
        const set = state.operatingSet
        const waiting = set && !set.completed ? set.companyOrder : []
        return Market1856.order(state.stockMarket).filter((id) => {
            const company = getCompany(state, id)
            if (company.closed || !company.started) return false
            return company.floated || waiting.includes(id) || meetsOperatingThreshold(title, id)
        })
    }
}

/** A CGR dividend move stops short of the closing area (CGR Off Market). */
function nationalMove(move: StockMarketMove | undefined): StockMarketMove | undefined {
    return move && ClosingSpaceIds1856.includes(move.toMarketSpaceId) ? undefined : move
}

const PayOrWithhold = payOrWithholdEarningsRules(Market1856, Charters1856, {
    unpaidPoolIds: [IpoPoolId1856],
    companyPoolIds: [MarketPoolId1856]
})

/**
 * Pay or withhold: shares in the open market pay the company, those in the initial offering the
 * bank; the price moves right on a dividend, left otherwise. The CGR withholds and stays put
 * until it owns a permanent train; its 5% shares pay a pair as a 10% share, a single one rounded
 * up (Declare Dividends, CGR Dividends).
 */
export const EarningsRules1856: EarningsRules = {
    ...PayOrWithhold,
    choices: (state, companyId) =>
        companyId === CgrId && nationalPriceFixed(state) ? ['withhold'] : ['pay', 'withhold'],
    holderDividend(state, companyId, { shares, choice, revenue }) {
        if (companyId !== CgrId || choice !== 'pay') return undefined
        if (getCompany(state, companyId).shareCount !== 20) return undefined
        return Math.floor(shares / 2) * (revenue / 10) + (shares % 2) * Math.ceil(revenue / 20)
    },
    roundDividend: (_state, _companyId, amount) => Math.floor(amount),
    marketEffect(state, companyId, distribution) {
        if (companyId === CgrId && nationalPriceFixed(state)) return { bonusPerShare: 0 }
        const effect = PayOrWithhold.marketEffect(state, companyId, distribution)
        if (companyId !== CgrId) return effect
        const move = nationalMove(effect.move)
        return { ...(move ? { move } : {}), bonusPerShare: effect.bonusPerShare }
    }
}

/** Trains over a lowered limit go to the open market without compensation (Purchase Train(s)). */
export const PhaseRules1856: PhaseRules = {
    rustTiming: (state, train) => Phases1856.rustTiming(state.phaseId, train.definitionId),
    discardOrder: (state, companyId) => marketDiscardOrder(Market1856, state, companyId),
    discardDestination: 'market'
}

/** The privates close as the first 5-train is bought; three block their hexes while players own them. */
export const PrivateRules1856: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: (state) => PrivateCatalog1856.closureEffects(state),
    operationEffects: () => [],
    description: (_state, id) => PrivateCatalog1856.definition(id).description ?? '',
    blocking: PrivateCatalog1856.blocking.bind(PrivateCatalog1856)
}

const trainOwnerId = (
    state: {
        trainInventory: { trains: readonly { id: string; status: string; owner?: unknown }[] }
    },
    trainId: string
): string | undefined => {
    const train = state.trainInventory.trains.find((entry) => entry.id === trainId)
    return train?.status === 'owned' &&
        typeof train.owner === 'object' &&
        train.owner !== null &&
        'companyId' in train.owner &&
        typeof train.owner.companyId === 'string'
        ? train.owner.companyId
        : undefined
}

/**
 * Companies trade trains at any agreed price of at least $1, the CGR only at the printed price.
 * In phases 3 and 4 a company buys a player's private for half to twice its cost (Purchase
 * Train(s), Purchasing Private Companies, CGR Trains).
 */
export const TransferRules1856: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: Charters1856,
    canPurchase: (state, companyId, asset) =>
        !(asset.kind === 'train' && presidentFundedPurchase(state, companyId)) &&
        EighteenXXTransferTiming.canPurchase(state, companyId, asset),
    priceRange(state, companyId, asset) {
        if (asset.kind === 'train') {
            const train = state.trainInventory.trains.find((entry) => entry.id === asset.trainId)
            assertExists(train, 'A traded train is known')
            if (companyId === CgrId || trainOwnerId(state, asset.trainId) === CgrId) {
                const price = TrainDepot1856.trainDefinition(train.definitionId).price
                return { minimum: price, maximum: price }
            }
            return { minimum: 1 }
        }
        if (asset.kind !== 'private') return undefined
        if (!PrivatePurchasePhaseIds.includes(state.phaseId)) return undefined
        if (privateOwner(state, asset.privateCompanyId)?.kind !== 'player') return undefined
        return PrivateCatalog1856.priceRange(asset.privateCompanyId)
    },
    // The company buying the bridge or tunnel private gains its right for good.
    afterPurchase: (state, offer) => grantPrivateRight(requireState1856(state), offer)
}

export const RequiresTrain1856 = requiresStationRoute(Map1856, TileSet1856)

/** Whether the company's president helped pay for a train this turn. */
function presidentFundedPurchase(
    state: { trainPurchaseStep?: { companyId: string; funded?: true } },
    companyId: string
): boolean {
    return state.trainPurchaseStep?.companyId === companyId && !!state.trainPurchaseStep.funded
}

/** Whether the CGR has yet to own a permanent train. */
function nationalAwaitsPermanent(state: object, companyId: string): boolean {
    const national = requireState1856(state).national
    return companyId === CgrId && !!national && !national.permanentTrain
}

/**
 * A CGR that has never owned a permanent train must acquire one once it can afford the final
 * train outright, or by trading in a 4-train; it is not obliged by a route, and its president
 * never pays (CGR Trains; ST-FAQ p24).
 */
function nationalMustBuyPermanent(state: TrainPurchaseState, companyId: string): boolean {
    const final = finalTrainId(state.trainInventory)
    const price = TrainDepot1856.trainDefinition(final).price
    const cash = finiteCashOwnedBy(state, { kind: 'company', companyId })
    const fours = trainsOwnedBy(state, { kind: 'company', companyId }).some(
        (train) => train.definitionId === '4'
    )
    return cash >= price || (fours && cash >= price - FinalTrainCredit)
}

/**
 * The bank sells trains in order, Diesels (or the variant's 8-trains) from the first 6. The CGR
 * may hold three and buys only permanent trains (Trains, CGR Trains).
 */
export const TrainRules1856: TrainRules = {
    depot: TrainDepot1856,
    requiresTrain: (state, companyId) =>
        nationalAwaitsPermanent(state, companyId)
            ? nationalMustBuyPermanent(state, companyId)
            : RequiresTrain1856(state, companyId),
    // Until then only a permanent train meets the CGR's obligation.
    satisfiesRequirement: (state, train) =>
        !(
            train.status === 'owned' &&
            train.owner.kind === 'company' &&
            nationalAwaitsPermanent(state, train.owner.companyId)
        ) || isPermanentTrain(train.definitionId),
    availableDefinitions: (state) => finalTrainSales(state).availableDefinitions?.(state) ?? [],
    exchangePrice: (state, companyId, definitionId, train) =>
        finalTrainSales(state).exchangePrice?.(state, companyId, definitionId, train),
    phaseAfterPurchase: (state, definitionId) =>
        Phases1856.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state, companyId) =>
        companyId === CgrId ? NationalTrainLimit : Phases1856.phase(state.phaseId).trainLimit,
    limitReason: (_state, companyId, definitionId) =>
        companyId === CgrId && !isPermanentTrain(definitionId)
            ? 'The CGR buys only permanent trains.'
            : undefined,
    // A train its president helped pay for is the turn's last, even with a later loan (designer,
    // 2017; Purchase Train(s)).
    purchaseLimit: (state, companyId) =>
        presidentFundedPurchase(state, companyId)
            ? (state.trainPurchaseStep?.purchasedTrainIds.length ?? 0)
            : 'unlimited',
    privatesClosedByPurchase: () => []
}

/**
 * A president who must help buy a train buys the cheapest from the bank or the open market,
 * selling shares if they must, but never so as to pass the presidency of the company buying it
 * (Purchase Train(s), Bankruptcy).
 */
export const TrainFundingRules1856 = presidentTrainFundingRules({
    repeatSales: 'separate',
    companyOrder: OperatingRules1856.companyOrder,
    saleTerms: emergencySaleTerms,
    stockRules: StockRules1856,
    protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId
})

/**
 * Interest and loan redemptions its president must make up are raised by selling shares, never
 * passing that company's presidency; a president who still cannot pay is bankrupt (Bankruptcy).
 */
export const CashCrisisRules1856: CashCrisisRules = {
    market: Market1856,
    charters: Charters1856,
    presidencyCandidates: StockRules1856.presidencyCandidates,
    saleTerms: emergencySaleTerms,
    protectsPresidency: (companyId, debt) => companyId === debt.companyId,
    // Companies yet to operate this round go in their new price order (Operating Rounds).
    afterSale: (state) =>
        reorderPendingOperatingCompanies(state, OperatingRules1856.companyOrder(state)),
    // The game ends at once; the bankrupt player's cash goes to the bank (Bankruptcy).
    elimination: { schema: UnredeemedLoans, eliminate: unredeemedLoans }
}

/**
 * A company whose price enters the closing area is removed from play: its trains to the open
 * market, its treasury to the bank, its loans forgiven (Closed Section).
 */
export const ZeroPriceClosure1856: ZeroPriceClosureRules = {
    market: Market1856,
    closure: {
        schema: CompanyClosure,
        close(state, companyId): CompanyClosure {
            delete getCompany(state, companyId).loans
            const forfeit = fundingForfeit(state, companyId)
            if (forfeit) settleCashPayments(state, [forfeit])
            const closure = closeShareCompany(state, companyId, 'market')
            forgetClosedCompany(state, companyId)
            return forfeit ? { ...closure, payments: [forfeit, ...closure.payments] } : closure
        }
    }
}

/**
 * A president selling their train-buying company into Closed loses what they hold toward the
 * train, keeping only cash beyond its price (designer, 18xx list 4198, 14251).
 */
function fundingForfeit(
    state: Parameters<ZeroPriceClosureRules['closure']['close']>[0],
    companyId: string
): CashPayment | undefined {
    const funding = state.trainFunding
    if (funding?.purchase.companyId !== companyId) return undefined
    const president: CashPayment['from'] = { kind: 'player', playerId: funding.playerId }
    const owed = funding.purchase.price - finiteCashOwnedBy(state, { kind: 'company', companyId })
    const amount = Math.min(finiteCashOwnedBy(state, president), Math.max(0, owed))
    return amount > 0 ? { from: president, to: { kind: 'bank' }, amount } : undefined
}

/**
 * A share counts its market price, less $10 for each loan its company still owes; a private its
 * cost (Winning).
 */
export const EndingRules1856: EndingRules = {
    // Bankruptcy ends the game at once; the bank breaking at the end of the set, or of the next
    // set after a stock round (Ending the Game).
    trigger: (state) =>
        state.bankruptcy || state.bankruptPlayerIds?.length
            ? { reason: 'Bankruptcy' }
            : bankExhaustionAtSetEnd(state),
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        let value = 0
        if (certificate.kind === 'private')
            value = company.closed ? 0 : PrivateCatalog1856.faceValue(company.id)
        else if (company.started && !company.closed) {
            const price = Market1856.companySpace(state.stockMarket, company.id).price
            value = certificate.shares * Math.max(0, price - 10 * (company.loans ?? 0))
        }
        return [certificateWealthItem(Names1856, certificate, value)]
    }
}
