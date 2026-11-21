import {
    EighteenXXTransferTiming,
    TrainPurchase,
    dividendEntitlements,
    finiteCashOwnedBy,
    floatedCompaniesInMarketOrder,
    inReceivership,
    presidentOf,
    trainsOwnedBy,
    type EarningsRules,
    type OperatingRules,
    type PhaseRules,
    type PrivatePowerRules,
    type ReceivershipRules,
    type StockMarket,
    type StockState,
    type TrainPurchaseDetails,
    type TrainRules,
    type TransferRules
} from '@tabletop/18xx'
import { turnOrderFrom } from '@tabletop/common'
import { Charters1860, ShareCount } from './companies.js'
import { IpoPoolId, MarketPoolId } from './names.js'
import { requireState1860 } from './state.js'
import { Market1860 } from './stockMarket.js'
import { Phases1860, TrainDepot1860 } from './trains.js'
import { smallestBankTrain } from './routes.js'

/** Companies that operate: floated, not bankrupt, and not closed by nationalisation. */
export function operatingCompanies(state: Pick<StockState, 'companies' | 'stockMarket'>): string[] {
    const title = requireState1860(state)
    return floatedCompaniesInMarketOrder(Market1860, state).filter(
        (id) =>
            !title.bankruptIds.includes(id) && !title.nationalisation?.closedCompanyIds.includes(id)
    )
}

export const OperatingRules1860: OperatingRules = {
    charters: Charters1860,
    // Once British Rail forms, operating rounds follow one another to the end (Railway
    // Nationalisation).
    roundCount: (state) =>
        requireState1860(state).nationalisation
            ? 'endless'
            : Phases1860.phase(state.phaseId).operatingRounds,
    // In descending order of price, a space's earliest arrival first (Operating Rounds).
    companyOrder: operatingCompanies
}

/** Moves a company's market marker to the bottom of its stack (Dividends and the Share Price). */
export function restackAtBottom(market: StockMarket, companyId: string): void {
    const stack = market.stacks.find((entry) => entry.companyIds.includes(companyId))
    if (!stack) return
    stack.companyIds = [...stack.companyIds.filter((id) => id !== companyId), companyId]
}

/**
 * Withholding moves the price one space left on its tier; a dividend at least the price moves it
 * one space right, and one more for each further multiple of the price, up to four (Dividends
 * and the Share Price).
 */
export function dividendSteps(dividend: number, price: number): number {
    if (dividend <= 0) return -1
    return Math.min(4, Math.floor(dividend / Math.max(price, 1)))
}

/** Whether the company must keep its revenue: insolvent, or in receivership. */
export function mustWithhold(state: object, companyId: string): boolean {
    const title = requireState1860(state)
    return title.insolventIds.includes(companyId) || inReceivership(title, companyId)
}

export const EarningsRules1860: EarningsRules = {
    // A company in receivership or insolvent retains; once nationalised, every company pays,
    // and one in receivership pays nothing (Insolvency; Receivership; Nationalisation).
    choices(state, companyId) {
        if (mustWithhold(state, companyId)) return ['withhold']
        if (requireState1860(state).nationalisation) return ['pay']
        return ['pay', 'withhold']
    },
    automaticChoice(state, companyId) {
        if (mustWithhold(state, companyId)) return 'withhold'
        return requireState1860(state).nationalisation ? 'pay' : undefined
    },
    shareCount: () => ShareCount,
    // Shares in the IPO and the bank pool earn nothing (Dividends and the Share Price).
    entitlements: (state, companyId) =>
        dividendEntitlements(state, companyId, (certificate) =>
            certificate.poolId === IpoPoolId || certificate.poolId === MarketPoolId
                ? undefined
                : certificate.owner
        ),
    retainedRevenue: (_state, _companyId, choice, revenue) => (choice === 'withhold' ? revenue : 0),
    roundDividend: (_state, _companyId, amount) => Math.floor(amount),
    marketEffect(state, companyId, distribution) {
        const from = Market1860.companySpace(state.stockMarket, companyId)
        const paid = distribution.revenue - distribution.retained
        const steps = dividendSteps(paid, from.price)
        // Each space on the tier is two places along the zig-zag track.
        const to =
            steps < 0
                ? Market1860.move(from.id, 'left', 2)
                : Market1860.move(from.id, 'right', 2 * steps)
        return {
            move: { companyId, fromMarketSpaceId: from.id, toMarketSpaceId: to.id },
            bonusPerShare: 0
        }
    },
    // The marker goes beneath any others in its space, moved or not (Dividends and the Share
    // Price).
    afterDistribution: (state, companyId) => restackAtBottom(state.stockMarket, companyId)
}

/** The players acting for a company: its director, or its largest holder in receivership. */
export function receiverOf(state: StockState, companyId: string): string | undefined {
    const order = turnOrderFrom(state.turnManager.turnOrder, state.turnManager.turnOrder[0])
    const shares = (playerId: string) =>
        state.certificates
            .filter(
                (certificate) =>
                    certificate.kind === 'share' &&
                    certificate.companyId === companyId &&
                    certificate.owner.kind === 'player' &&
                    certificate.owner.playerId === playerId
            )
            .reduce(
                (sum, certificate) => sum + (certificate.kind === 'share' ? certificate.shares : 0),
                0
            )
    const most = Math.max(...order.map(shares))
    return order.find((playerId) => shares(playerId) === most)
}

export const PhaseRules1860: PhaseRules = {
    activePlayers(state, companyId) {
        const president = presidentOf(state, companyId)
        if (president?.kind === 'player') return [president.playerId]
        const receiver = receiverOf(state, companyId)
        return receiver ? [receiver] : []
    },
    rustTiming: (state, train) => Phases1860.rustTiming(state.phaseId, train.definitionId),
    // Trains over the limit return to the bank as their company's next turn begins, not as the
    // phase changes (Buying Trains; TN-8).
    discardOrder: () => [],
    discardDestination: 'market'
}

/** The price of the bank's cheapest train for sale. */
export function cheapestBankTrainPrice(
    state: Parameters<typeof smallestBankTrain>[0]
): number | undefined {
    const train = smallestBankTrain(state)
    return train && TrainDepot1860.trainDefinition(train.definitionId).price
}

export const TrainRules1860: TrainRules = {
    depot: TrainDepot1860,
    // A company without a train must buy one if it can pay for the bank's cheapest; the
    // president never pays toward it (Buying Trains; Insolvency).
    requiresTrain(state, companyId) {
        if (trainsOwnedBy(state, { kind: 'company', companyId }).length) return false
        const price = cheapestBankTrainPrice(state)
        return (
            price !== undefined && finiteCashOwnedBy(state, { kind: 'company', companyId }) >= price
        )
    },
    exchangePrice: () => undefined,
    availableDefinitions(state) {
        const next = TrainDepot1860.nextDefinitionId(state.trainInventory)
        return next ? [next] : []
    },
    phaseAfterPurchase: (state, definitionId) =>
        Phases1860.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state) => Phases1860.phase(state.phaseId).trainLimit,
    purchaseLimit: () => 'unlimited',
    privatesClosedByPurchase: () => []
}

function trainSeller(state: Parameters<TransferRules['priceRange']>[0], trainId: string) {
    const train = state.trainInventory.trains.find((entry) => entry.id === trainId)
    return train?.status === 'owned' && train.owner.kind === 'company'
        ? train.owner.companyId
        : undefined
}

export const TransferRules1860: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: Charters1860,
    // Trains change hands between companies, never after nationalisation, and a company already
    // owning a train may not take another's only train (Buying Trains; Nationalisation).
    canPurchase(state, companyId, asset) {
        if (asset.kind !== 'train') return false
        if (!EighteenXXTransferTiming.canPurchase(state, companyId, asset)) return false
        const title = requireState1860(state)
        if (title.nationalisation) return false
        const sellerId = trainSeller(state, asset.trainId)
        if (!sellerId || title.bankruptIds.includes(sellerId)) return false
        if (inReceivership(title, companyId) || inReceivership(title, sellerId)) return false
        const owns = (id: string) => trainsOwnedBy(title, { kind: 'company', companyId: id }).length
        return owns(companyId) === 0 || owns(sellerId) > 1
    },
    // At a price the directors agree, a multiple of £10 and at least £10 (Buying Trains).
    priceRange: (_state, _companyId, asset) =>
        asset.kind === 'train' ? { minimum: 10, multipleOf: 10 } : undefined,
    afterPurchase: () => {}
}

export const PrivatePowerRules1860: PrivatePowerRules = {
    trackTerms: () => undefined,
    earlyTrainCompany: () => undefined
}

/** The trains the buying company may take from the bank, the cheapest first: pool, then depot. */
export function bankTrainOffers(
    state: ConstructorParameters<typeof TrainPurchase>[0],
    rules: TrainRules
): TrainPurchaseDetails[] {
    const purchase = new TrainPurchase(state, rules)
    return [
        ...purchase.marketOffers().map((evaluation) => evaluation.details),
        ...purchase.offers().map((offer) => offer.evaluation.details)
    ]
        .filter((details) => details !== undefined)
        .sort((a, b) => a.price - b.price)
}

/**
 * A company in receivership is run by its largest holder for the most it can earn, keeps its
 * revenue, lays no track and places no bases, and buys the bank's next train only when it has
 * none (Companies In Receivership).
 */
export const ReceivershipRules1860: ReceivershipRules = {
    operators(state, companyId) {
        const playerId = receiverOf(state, companyId)
        return playerId ? [playerId] : []
    },
    earningsChoice: () => 'withhold',
    trainPurchase(state, companyId, rules) {
        if (trainsOwnedBy(state, { kind: 'company', companyId }).length) return undefined
        const offer = bankTrainOffers(state, rules)[0]
        if (!offer) return undefined
        const { price, ...request } = offer
        return { ...request, expectedPrice: price }
    }
}
