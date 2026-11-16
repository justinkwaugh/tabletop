import { assertExists } from '@tabletop/common'
import {
    EighteenXXTransferTiming,
    NationalCompanyKind,
    certificateWealthItem,
    controllingOwner,
    dividendEntitlements,
    floatedCompaniesInMarketOrder,
    getCompany,
    marketDiscardOrder,
    privateOwner,
    companyShareCount,
    trainsOwnedBy,
    TrainPurchase,
    certificateShares,
    certificatesInPool,
    finiteCashOwnedBy,
    treasuryPoolId,
    type CorporateFinanceRules,
    type FinanceChoice,
    type EarningsRules,
    type EndingRules,
    type GameEnding,
    type OperatingRules,
    type PhaseRules,
    type PrivateRules,
    type StockMarketMove,
    type TrainPurchaseRequest,
    type TrainPurchaseState,
    type TrainRules,
    type TransferRules
} from '@tabletop/18xx'
import { Charters1861, RsrId, isMinor1861 } from './companies.js'
import { Borrowing1861 } from './loans.js'
import { MarketPoolId1861, Names1861 } from './names.js'
import { ReceivershipRules1861, rsrOperates } from './national.js'
import { PrivateCatalog1861 } from './privates.js'
import { requireState1861 } from './state.js'
import { LeftOrDownMove, Market1861, MinorRightMove } from './stockMarket.js'
import {
    DoubleTwoTrainId,
    ExpressTrainId,
    Phases1861,
    PrivatePurchasePhaseIds,
    RsrOperatingPhaseIds,
    TrainDepot1861,
    TrainLimits1861
} from './trains.js'

/**
 * Privates pay first, then minors and then public companies, each in descending order of price,
 * and last the RSR in phases 4 to 7 (§10).
 */
export const OperatingRules1861: OperatingRules = {
    charters: Charters1861,
    roundCount: (state) => Phases1861.phase(state.phaseId).operatingRounds,
    companyOrder(state) {
        const order = floatedCompaniesInMarketOrder(Market1861, state)
        return [
            ...order.filter(isMinor1861),
            ...order.filter((id) => !isMinor1861(id)),
            ...(rsrOperates(state) && getCompany(state, RsrId).started ? [RsrId] : [])
        ]
    },
    // With train exports the RSR takes the next train at the end of each set in phases 4 to 7,
    // just before the second merger round (GTG §14).
    trainsToExport(state) {
        const set = state.operatingSet
        if (!exportsTrains(state) || !set || set.roundNumber !== set.roundCount) return []
        if (!RsrOperatingPhaseIds.includes(state.phaseId)) return []
        const next = TrainDepot1861.nextDefinitionId(state.trainInventory)
        return next ? [next] : []
    }
}

function exportsTrains(state: object): boolean {
    return !!requireState1861(state).variants.trainExports
}

/** Half a public company's earnings, rounded up to a multiple of R10 (§10.7). */
function halfPayment(revenue: number): number {
    return Math.ceil(revenue / 20) * 10
}

/**
 * A minor pays half its earnings to its owner and keeps half, moving right, up its seventh column,
 * or left when it earns nothing. A public company pays out, pays half or keeps its earnings: it
 * moves right when ten times the dividend per share is at least its price, left when it pays
 * nothing. Treasury shares pay the company and pool shares no one. The RSR keeps everything
 * (§10.7).
 */
export const EarningsRules1861: EarningsRules = {
    choices(state, companyId) {
        const kind = getCompany(state, companyId).kind
        if (kind === NationalCompanyKind) return ['withhold']
        if (kind === 'minor') return ['half-pay']
        return ['pay', 'half-pay', 'withhold']
    },
    // A minor's one certificate takes its whole distribution, so it is paid as one unit.
    shareCount(state, companyId) {
        const kind = getCompany(state, companyId).kind
        if (kind === 'minor' || kind === NationalCompanyKind) return 1
        const count = companyShareCount(state, Charters1861, companyId)
        assertExists(count, 'Dividends require a share count')
        return count
    },
    entitlements(state, companyId) {
        const minor = getCompany(state, companyId).kind === 'minor'
        return dividendEntitlements(state, companyId, (certificate) =>
            certificate.poolId === MarketPoolId1861 ? undefined : certificate.owner
        ).map((entitlement) => (minor ? { ...entitlement, shares: 1 } : entitlement))
    },
    retainedRevenue(state, companyId, choice, revenue) {
        if (choice === 'withhold') return revenue
        if (choice === 'pay') return 0
        return getCompany(state, companyId).kind === 'minor'
            ? revenue / 2
            : revenue - halfPayment(revenue)
    },
    roundDividend: (_state, _companyId, amount) => amount,
    marketEffect(state, companyId, distribution) {
        const company = getCompany(state, companyId)
        if (company.kind === NationalCompanyKind || !company.floated) return { bonusPerShare: 0 }
        const from = Market1861.companySpace(state.stockMarket, companyId)
        const paid = distribution.revenue - distribution.retained
        const move = (direction: string): StockMarketMove | undefined => {
            const to = from.moves[direction]
            return to ? { companyId, fromMarketSpaceId: from.id, toMarketSpaceId: to } : undefined
        }
        let marketMove: StockMarketMove | undefined
        if (distribution.revenue === 0 || paid === 0) marketMove = move(LeftOrDownMove)
        else if (company.kind === 'minor') marketMove = move(MinorRightMove)
        else if (distribution.baseDividendPerShare * 10 >= from.price)
            marketMove = Market1861.dividendMove(state.stockMarket, companyId, true)
        return { ...(marketMove ? { move: marketMove } : {}), bonusPerShare: 0 }
    }
}

const phaseEightTrains = [ExpressTrainId, DoubleTwoTrainId]

/** The trains the bank sells: the next of the numbered trains, and in phase 8 the 5+5E and 2+2. */
function availableDefinitions(state: TrainPurchaseState): string[] {
    const next = TrainDepot1861.nextDefinitionId(state.trainInventory)
    const numbered = next && !phaseEightTrains.includes(next) ? [next] : []
    const phaseEight = Phases1861.isAtLeast(state.phaseId, '8')
        ? phaseEightTrains.filter(
              (definitionId) => TrainDepot1861.remaining(state.trainInventory, definitionId) !== 0
          )
        : []
    return [...numbered, ...phaseEight]
}

function trainLimit(state: TrainPurchaseState, companyId: string): number {
    const kind = getCompany(state, companyId).kind
    if (kind === NationalCompanyKind) return Number.MAX_SAFE_INTEGER
    const limits = TrainLimits1861[state.phaseId]
    assertExists(limits, 'Every 1861 phase has train limits')
    return (kind === 'minor' ? limits.minor : limits.major) ?? 0
}

const trainless = (state: TrainPurchaseState, companyId: string) =>
    !trainsOwnedBy(state, { kind: 'company', companyId }).length

/**
 * A company without a train borrows to buy one from the bank, new or from its pool, but never
 * from another company (§10.2).
 */
function borrowsFor(state: TrainPurchaseState, request: TrainPurchaseRequest): boolean {
    if (!trainless(state, request.companyId)) return false
    return !state.trainInventory.trains.some(
        (train) => train.id === request.trainId && train.status === 'owned'
    )
}

/**
 * A company without a train must buy one from the bank if, borrowing all it may, it can afford
 * one; one that cannot ends its turn without and is nationalised (§10.10).
 */
function requiresTrain(state: TrainPurchaseState, companyId: string): boolean {
    if (!trainless(state, companyId) || !state.trainPurchaseStep) return false
    const purchase = new TrainPurchase(state, TrainRules1861)
    return [...purchase.offers().map((offer) => offer.evaluation), ...purchase.marketOffers()].some(
        (evaluation) => !!evaluation.details
    )
}

export const TrainRules1861: TrainRules = {
    depot: TrainDepot1861,
    requiresTrain: (state, companyId) => requiresTrain(state, companyId),
    exchangePrice: () => undefined,
    availableDefinitions,
    phaseAfterPurchase: (state, definitionId) =>
        Phases1861.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit,
    purchaseLimit: () => 'unlimited',
    privatesClosedByPurchase: () => [],
    borrowing: { loans: Borrowing1861, allowed: borrowsFor }
}

// Companies over a lowered limit discard to the bank pool without compensation, in operating
// order (§10.10).
export const PhaseRules1861: PhaseRules = {
    // The RSR's decisions are its receiver's (§7.4).
    activePlayers(state, companyId) {
        if (companyId === RsrId) return ReceivershipRules1861.operators(state, companyId)
        const director = controllingOwner(state, companyId)
        assertExists(director, 'The deciding company has a director')
        return [director.playerId]
    },
    rustTiming: (state, train) => Phases1861.rustTiming(state.phaseId, train.definitionId),
    discardOrder: (state, companyId) => marketDiscardOrder(Market1861, state, companyId),
    discardDestination: 'market'
}

/**
 * A public company may buy back any of its shares from the bank pool at the current price, from
 * its treasury alone, before it runs its trains (§10.3).
 */
export const CorporateFinanceRules1861: CorporateFinanceRules = {
    timing: 'before-running',
    certificates: (state, companyId) =>
        certificatesInPool(state, MarketPoolId1861).filter(
            (certificate) => certificate.companyId === companyId
        ),
    destinationPool: (companyId) => treasuryPoolId(companyId),
    choices(state, companyId) {
        if (getCompany(state, companyId).kind !== 'major') return []
        const pool = CorporateFinanceRules1861.certificates(state, companyId, 'redeem')
        const price = Market1861.companySpace(state.stockMarket, companyId).price
        const cash = finiteCashOwnedBy(state, { kind: 'company', companyId })
        const choices: FinanceChoice[] = []
        let shares = 0
        for (const certificate of pool) {
            shares += certificateShares(certificate)
            if (shares * price > cash) break
            choices.push({ companyId, operation: 'redeem', shares, amount: shares * price })
        }
        return choices
    }
}

/** Private company hexes take no track before phase 3 (§8, §10.4). */
export const PrivateRules1861: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: () => [],
    operationEffects: () => [],
    description: (_state, id) => PrivateCatalog1861.definition(id).description ?? '',
    blocking: (state) => !Phases1861.isAtLeast(state.phaseId, '3')
}

/**
 * Companies trade trains at any price of at least R1, never with the RSR; in phases 3 to 5 a
 * company buys a player's private for R1 up to its face value (§7.1, §10, §10.10).
 */
export const TransferRules1861: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: Charters1861,
    canPurchase(state, companyId, asset) {
        if (companyId === RsrId) return false
        if (asset.kind === 'train') {
            const train = state.trainInventory.trains.find((entry) => entry.id === asset.trainId)
            if (
                train?.status === 'owned' &&
                train.owner.kind === 'company' &&
                train.owner.companyId === RsrId
            )
                return false
        }
        return EighteenXXTransferTiming.canPurchase(state, companyId, asset)
    },
    priceRange(state, _companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        if (asset.kind !== 'private') return undefined
        if (!PrivatePurchasePhaseIds.includes(state.phaseId)) return undefined
        if (privateOwner(state, asset.privateCompanyId)?.kind !== 'player') return undefined
        return {
            minimum: 1,
            maximum: PrivateCatalog1861.definition(asset.privateCompanyId).faceValue
        }
    },
    afterPurchase: () => undefined
}

/** The first 8-train: the set's last round with two more after it, or a stock round then three (§13). */
function eightTrainEnding(state: object): GameEnding | undefined {
    const title = requireState1861(state)
    const at = title.phaseEightAt
    if (!at || title.variants.longGame) return undefined
    return {
        reason: 'First 8-train',
        finalOperatingSet: at.round === 1 ? at.set : at.set + 1,
        finalOperatingRounds: 3
    }
}

/**
 * The bank broken in a stock round: that round and one operating round more; in an operating
 * round: the rest of it (§13).
 */
function bankEnding(state: object): GameEnding | undefined {
    const title = requireState1861(state)
    if (!title.bank.broken) return undefined
    const set = title.operatingSet
    if (!set || set.completed)
        return {
            reason: 'Bank broken',
            finalOperatingSet: (set?.number ?? 0) + 1,
            finalOperatingRound: 1
        }
    return {
        reason: 'Bank broken',
        finalOperatingSet: set.number,
        finalOperatingRound: set.roundNumber
    }
}

/**
 * A share is worth its price less a space a loan its company owes; a minor's certificate counts
 * two shares; a private is worth its face value (§13).
 */
export const EndingRules1861: EndingRules = {
    trigger: (state) => eightTrainEnding(state) ?? bankEnding(state),
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        let value = 0
        if (certificate.kind === 'private')
            value = company.closed ? 0 : PrivateCatalog1861.definition(company.id).faceValue
        else if (company.started && !company.closed) {
            const from = Market1861.companySpace(state.stockMarket, company.id)
            const price = Market1861.space(
                Market1861.move(from.id, LeftOrDownMove, company.loans ?? 0).id
            ).price
            value = price * certificate.shares
        }
        return [certificateWealthItem(Names1861, certificate, value)]
    }
}
