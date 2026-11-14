import {
    EighteenXXTransferTiming,
    bankExhaustionAtSetEnd,
    certificateWealthItem,
    certificatesInPool,
    certificatesOwnedBy,
    closePrivate,
    dividendEntitlements,
    finiteCashOwnedBy,
    getCompany,
    marketDiscardOrder,
    marketShareValue,
    presidentTrainFundingRules,
    privateOwner,
    reorderPendingOperatingCompanies,
    settleCashPayments,
    treasuryPoolId,
    type CashPayment,
    type Certificate,
    type CorporateFinanceRules,
    type EarningsRules,
    type SeparateEarnings,
    type EndingRules,
    type EndingState,
    type FinanceChoice,
    type FinancialState,
    type GameEnding,
    type OperatingRules,
    type PhaseChangeState,
    type PhaseRules,
    type PrivateRules,
    type StockMarketMove,
    type StockMarketSpace,
    type StockState,
    type TrainFundingRules,
    type TrainRules,
    type TransferRules,
    type WealthItem
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import {
    Charters1822,
    ConcessionIds1822,
    MajorShareCount1822,
    MinorShareCount1822
} from './companies.js'
import { playerLoan1822, takePlayerLoan1822 } from './loans.js'
import { removeConcessions1822 } from './lots.js'
import { MarketPoolId1822, Names1822 } from './names.js'
import { operatingOrder1822 } from './order.js'
import {
    CompanyRevenuePrivateIds1822,
    DoubleCashCompanyRevenue1822,
    DoubleCashPrivateId,
    PhaseCreditClosurePhaseId,
    PhaseCreditPrivateIds,
    TaxHavenPrivateId,
    private1822
} from './privates.js'
import { ConcessionRevenue1822, FaceValues1822 } from './setup.js'
import { setupOf1822 } from './scenarios.js'
import { requireState1822, type HydratedState1822 } from './state.js'
import { StockRules1822 } from './stock.js'
import { Market1822, endsGameAt1822 } from './stockMarket.js'
import {
    ElectricTrainId,
    ExtraTrainIds1822,
    LocalTrainId,
    MinorTrainLimits1822,
    PermanentTrainIds,
    Phases1822,
    TrainDepot1822
} from './trains.js'

/** The colour of the newest tiles the phase allows, which sets phase-dependent values (§5.4.5). */
function phaseColor(phaseId: string): string {
    const color = Phases1822.phase(phaseId).tileColors.at(-1)
    assertExists(color, 'A phase allows some tiles')
    return color
}

/** A phase's number, which P15 and P20 pay by (Table 3). */
function phaseNumber(phaseId: string): number {
    return Number.parseInt(phaseId)
}

/**
 * What a private company or concession pays each operating round (§3.1.1, §3.1.8, §3.2.4). Held
 * by a player it pays its revenue, P15 and P20 theirs for each phase number. Held by a company
 * most pay nothing: P2, P11 and P12 still pay until used, and P9 pays by the phase.
 */
export function privateIncome1822(state: FinancialState & { phaseId: string }, id: string): number {
    if (ConcessionIds1822.includes(id)) return ConcessionRevenue1822
    const company = private1822(id)
    assertExists(company, 'Income is paid by a private company or a concession')
    const owner = privateOwner(state, id)
    if (owner?.kind === 'player')
        return company.revenue * (company.revenuePerPhase ? phaseNumber(state.phaseId) : 1)
    if (owner?.kind !== 'company') return 0
    if (id === DoubleCashPrivateId)
        return DoubleCashCompanyRevenue1822[phaseColor(state.phaseId)] ?? 0
    return CompanyRevenuePrivateIds1822.includes(id) ? company.revenue : 0
}

export const OperatingRules1822: OperatingRules = {
    charters: Charters1822,
    roundCount: (state) => Phases1822.phase(state.phaseId).operatingRounds,
    companyOrder: (state) => operatingOrder1822(state),
    privateIncome: (state, privateId) =>
        privateIncome1822({ ...state, phaseId: requireState1822(state).phaseId }, privateId)
}

/** What a major company pays out of a run: all, none, or half rounded up to £10 (§5.14.1). */
function paidOut(choice: string, revenue: number): number {
    if (choice === 'withhold') return 0
    return choice === 'half-pay' ? Math.ceil(revenue / 20) * 10 : revenue
}

/**
 * What is paid where a permanent train's revenue is decided apart from the other trains': the
 * two parts' dividends together, halved as one sum where both pay half (§5.14.2, §5.14.3).
 */
function paidWithSeparate(choice: string, revenue: number, separate?: SeparateEarnings): number {
    if (!separate || separate.choice === choice) return paidOut(choice, revenue)
    return paidOut(choice, revenue - separate.revenue) + paidOut(separate.choice, separate.revenue)
}

function step(space: StockMarketSpace, paying: boolean): StockMarketSpace {
    const next = paying
        ? (space.moves.right ?? space.moves.up)
        : (space.moves.left ?? space.moves.down)
    return next ? Market1822.space(next) : space
}

/**
 * A company that pays nothing moves left; a major paying at least its share value moves right,
 * twice for at least double it; a minor that pays moves right (§5.14.5–§5.14.9).
 */
function dividendSteps(
    kind: string,
    paid: number,
    price: number
): { paying: boolean; steps: number } {
    if (paid <= 0) return { paying: false, steps: 1 }
    if (kind === 'minor') return { paying: true, steps: 1 }
    return { paying: true, steps: paid >= price * 2 ? 2 : paid >= price ? 1 : 0 }
}

export const EarningsRules1822: EarningsRules = {
    // A minor company always pays half to its director, the other half staying with it (§5.14.9).
    choices: (state, companyId) =>
        getCompany(state, companyId).kind === 'minor' ? ['pay'] : ['pay', 'half-pay', 'withhold'],
    shareCount: (state, companyId) =>
        getCompany(state, companyId).kind === 'minor' ? MinorShareCount1822 : MajorShareCount1822,
    // Shares with the company pay its treasury; shares in the bank pool pay no one (§5.14.1).
    entitlements: (state, companyId) =>
        dividendEntitlements(state, companyId, (certificate) =>
            certificate.poolId === MarketPoolId1822 ? undefined : certificate.owner
        ),
    retainedRevenue: (_state, _companyId, choice, revenue, separate) =>
        revenue - paidWithSeparate(choice, revenue, separate),
    // The revenue of a permanent 2-train or L-train may be paid, split or kept apart from the
    // other trains' (§5.14.2).
    separateRevenue: (state, companyId) =>
        state.routeStep?.result?.companyId === companyId
            ? state.routeStep.result.routes.find((route) =>
                  PermanentTrainIds.includes(route.definitionId)
              )?.revenue
            : undefined,
    roundDividend: (_state, _companyId, amount) => Math.floor(amount),
    // A minor's two halves split its earnings exactly, whatever a share of four would round to.
    holderDividend: (state, companyId, { shares, choice, revenue }) =>
        getCompany(state, companyId).kind === 'minor'
            ? (paidOut(choice, revenue) * shares) / MinorShareCount1822
            : undefined,
    marketEffect(state, companyId, distribution) {
        const company = getCompany(state, companyId)
        const from = Market1822.companySpace(state.stockMarket, companyId)
        const paid = distribution.revenue - distribution.retained
        const { paying, steps } = dividendSteps(company.kind, paid, from.price)
        let to = from
        for (let count = 0; count < steps; count++) to = step(to, paying)
        const move: StockMarketMove | undefined =
            to.id === from.id
                ? undefined
                : { companyId, fromMarketSpaceId: from.id, toMarketSpaceId: to.id }
        return { ...(move ? { move } : {}), bonusPerShare: 0 }
    }
}

/** Whether the train is one of those that come with a private company and stand apart (§5.5.13, §5.5.14). */
function isExtraTrain(definitionId: string): boolean {
    return ExtraTrainIds1822.includes(definitionId)
}

export const TrainRules1822: TrainRules = {
    depot: TrainDepot1822,
    // In phases 1 and 2 an L train is flipped to a 2-train for £80, as a train purchase
    // (§5.15.4); some scenarios lower that, at once or from phase 2 (§6.2.1).
    exchangePrice(state, _companyId, definitionId, train) {
        if (definitionId !== '2' || train.definitionId !== LocalTrainId) return undefined
        return setupOf1822(requireState1822(state)).localUpgradePrices[state.phaseId]
    },
    exchangedTrainDestination: 'depot',
    // Every operating company must own a train at the end of its turn (§5.5.2).
    requiresTrain: () => true,
    satisfiesRequirement: (_state, train) => !isExtraTrain(train.definitionId),
    // The bank sells the next new train: either side of a double-sided card, though no train
    // that has already been made obsolete (§5.15.3, §5.5.7, §5.5.8).
    availableDefinitions(state) {
        const next = TrainDepot1822.nextDefinitionId(state.trainInventory)
        if (!next) return []
        return TrainDepot1822.certificateDefinitions(next).filter(
            (definitionId) => !Phases1822.rustTiming(state.phaseId, definitionId)
        )
    },
    phaseAfterPurchase: (state, definitionId) =>
        Phases1822.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit(state, companyId) {
        if (getCompany(state, companyId).kind !== 'minor')
            return Phases1822.phase(state.phaseId).trainLimit
        const limit = MinorTrainLimits1822[state.phaseId]
        assertExists(limit, 'Every phase gives minor companies a train limit')
        return limit
    },
    countsForLimit: (_state, train) => !isExtraTrain(train.definitionId),
    // A company owns one E train at most (§5.5.10).
    limitReason: (state, companyId, definitionId) =>
        definitionId === ElectricTrainId &&
        state.trainInventory.trains.some(
            (train) =>
                train.status === 'owned' &&
                train.definitionId === ElectricTrainId &&
                train.owner.kind === 'company' &&
                train.owner.companyId === companyId
        )
            ? 'A company owns only one E train (§5.5.10).'
            : undefined,
    purchaseLimit: () => 'unlimited'
}

export const PhaseChanges1822 = Type.Object(
    {
        /** Concessions removed as phase 5 begins (§3.2.5). */
        removedConcessionIds: Type.Array(Type.String()),
        /** P15 and P20 closed as phase 7 begins, their credits back with the bank (Table 3). */
        closedPrivates: Type.Array(
            Type.Object(
                { privateCompanyId: Type.String(), returned: Type.Integer({ minimum: 0 }) },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type PhaseChanges1822 = Type.Static<typeof PhaseChanges1822>

/** Closes a phase-credit private no company acquired, its credits going back to the bank (Table 3). */
function closePhaseCredits(state: PhaseChangeState): PhaseChanges1822['closedPrivates'] {
    return PhaseCreditPrivateIds.flatMap((privateCompanyId) => {
        const company = state.companies.find((entry) => entry.id === privateCompanyId)
        if (!company || company.closed) return []
        const charter = { kind: 'company' as const, companyId: privateCompanyId }
        const returned = finiteCashOwnedBy(state, charter)
        if (returned)
            settleCashPayments(state, [{ from: charter, to: { kind: 'bank' }, amount: returned }])
        closePrivate(state, privateCompanyId)
        return [{ privateCompanyId, returned }]
    })
}

export const PhaseRules1822: PhaseRules = {
    rustTiming: (state, train) => Phases1822.rustTiming(state.phaseId, train.definitionId),
    // Companies over a new limit discard in descending share value (§5.15.7).
    discardOrder: (state, companyId) => marketDiscardOrder(Market1822, state, companyId),
    discardDestination: 'market',
    changes: {
        schema: PhaseChanges1822,
        apply(stateObject, event) {
            const state = requireState1822(stateObject)
            return {
                removedConcessionIds:
                    event.toPhaseId === '5' ||
                    (Phases1822.isAtLeast(event.toPhaseId, '5') &&
                        !Phases1822.isAtLeast(event.fromPhaseId, '5'))
                        ? removeConcessions1822(state)
                        : [],
                closedPrivates: Phases1822.isAtLeast(event.toPhaseId, PhaseCreditClosurePhaseId)
                    ? closePhaseCredits(state)
                    : []
            }
        }
    }
}

export const PrivateRules1822: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: () => [],
    operationEffects: () => [],
    description: (_state, id) =>
        private1822(id)?.description ??
        'Converted by its holder into the major company’s director’s certificate from phase 2, for £100 off its cost. Pays £10 each operating round and is removed when phase 5 begins.'
}

// From phase 3 a company may buy a train from another for any price of £1 or more; the trains
// that come with private companies are never sold (§5.15.1, §5.15.2, §5.5.13, §5.5.14).
export const TransferRules1822: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: Charters1822,
    canPurchase(state, companyId, asset) {
        if (asset.kind !== 'train') return false
        const train = state.trainInventory.trains.find((entry) => entry.id === asset.trainId)
        return (
            !!train &&
            !isExtraTrain(train.definitionId) &&
            Phases1822.isAtLeast(state.phaseId, '3') &&
            EighteenXXTransferTiming.canPurchase(state, companyId, asset)
        )
    },
    priceRange: (_state, _companyId, asset) =>
        asset.kind === 'train' ? { minimum: 1 } : undefined,
    afterPurchase: () => undefined
}

// A director funds a forced purchase from their cash and then their shares, keeping the
// directorship of the buying company, and takes a loan for what is still short (§5.16, §5.17).
export const TrainFundingRules1822: TrainFundingRules = {
    ...presidentTrainFundingRules({
        companyOrder: OperatingRules1822.companyOrder,
        saleTerms: StockRules1822.saleTerms,
        repeatSales: 'separate',
        stockRules: StockRules1822,
        protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId
    }),
    // A holding above 60% gained through acquisitions need not be sold (§4.7.6).
    requiredSaleShares: () => 0,
    recordLoan(state, owner, amount) {
        if (owner.kind === 'player') takePlayerLoan1822(state, owner.playerId, amount)
    },
    afterShareSale(stateObject) {
        const state = requireState1822(stateObject)
        reorderPendingOperatingCompanies(state, operatingOrder1822(state))
    }
}

/**
 * Whether a company's marker stands on a value that ends the game: the chart's last space, or in
 * a scenario any space of its lower game end value (§1.3.1, §6.2.1).
 */
function reachedEndValue(state: HydratedState1822): boolean {
    const { endPrice } = setupOf1822(state)
    return state.stockMarket.stacks.some(
        (stack) =>
            stack.companyIds.length > 0 && endsGameAt1822(Market1822.space(stack.spaceId), endPrice)
    )
}

/**
 * The game ends at once if the first stock round sold nothing; at the end of the operating round
 * in which a share value reaches the game end value or, reached in a stock round, of the first
 * operating round after it; and when the bank breaks, at the end of the first operating round
 * after a stock round or of the pair of operating rounds it broke in (§1.3.1).
 */
function ending(stateObject: EndingState): GameEnding | undefined {
    const state = requireState1822(stateObject)
    if (state.nothingSold) return { reason: 'Nothing sold in the first stock round' }
    const set = state.operatingSet
    const betweenSets = !set || set.completed
    const nextRound = { finalOperatingSet: (set?.number ?? 0) + 1, finalOperatingRound: 1 }
    if (reachedEndValue(state))
        return {
            reason: 'Share value at the game end value',
            ...(betweenSets
                ? nextRound
                : { finalOperatingSet: set.number, finalOperatingRound: set.roundNumber })
        }
    if (!state.bank.broken) return undefined
    return betweenSets ? { reason: 'Bank broken', ...nextRound } : bankExhaustionAtSetEnd(state)
}

function taxHavenItems(state: StockState): WealthItem[] {
    const charter = { kind: 'company' as const, companyId: TaxHavenPrivateId }
    const cash = finiteCashOwnedBy(state, charter)
    return [
        ...certificatesOwnedBy(state, charter).flatMap((certificate: Certificate) =>
            certificate.kind === 'share'
                ? [
                      certificateWealthItem(
                          Names1822,
                          certificate,
                          marketShareValue(Market1822, state, certificate)
                      )
                  ]
                : []
        ),
        ...(cash ? [{ assetId: 'tax-haven-cash', label: 'Tax haven dividends', value: cash }] : [])
    ]
}

// A player's wealth is their cash and the value of their stock; concessions still held count
// £100 and private companies nothing (§1.3.2). The tax haven's share and dividends are its
// owner's (Table 3), and an unpaid loan is owed.
export const EndingRules1822: EndingRules = {
    trigger: ending,
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        const value =
            certificate.kind === 'share'
                ? company.closed
                    ? 0
                    : marketShareValue(Market1822, state, certificate)
                : ConcessionIds1822.includes(company.id) && !company.closed
                  ? FaceValues1822.concession
                  : 0
        return [certificateWealthItem(Names1822, certificate, value)]
    },
    playerItems(state, playerId) {
        const owner = privateOwner(state, TaxHavenPrivateId)
        const loan = playerLoan1822(state, playerId)
        return [
            ...(owner?.kind === 'player' && owner.playerId === playerId
                ? taxHavenItems(state)
                : []),
            ...(loan ? [{ assetId: `loan:${playerId}`, label: 'Loan', value: -loan }] : [])
        ]
    }
}

function sharesIn(state: FinancialState, companyId: string, poolId: string): Certificate[] {
    return certificatesInPool(state, poolId).filter(
        (certificate) => certificate.companyId === companyId && certificate.kind === 'share'
    )
}

/**
 * After buying trains a major company may issue shares from its treasury to the bank pool, each
 * dropping its value a space and all paid at the value it comes to rest at, or redeem shares from
 * the pool at the current value; not both in a turn, and no issue in its first turn (§5.20).
 */
export const CorporateFinanceRules1822: CorporateFinanceRules = {
    timing: 'after-trains',
    certificates: (state, companyId, operation) =>
        sharesIn(
            state,
            companyId,
            operation === 'issue' ? treasuryPoolId(companyId) : MarketPoolId1822
        ),
    destinationPool: (companyId, operation) =>
        operation === 'issue' ? MarketPoolId1822 : treasuryPoolId(companyId),
    choices(stateObject, companyId, committed): FinanceChoice[] {
        const state = requireState1822(stateObject)
        const space = Market1822.companySpace(state.stockMarket, companyId)
        const pool = sharesIn(state, companyId, MarketPoolId1822).length
        const treasury = sharesIn(state, companyId, treasuryPoolId(companyId)).length
        const issuable =
            committed === 'redeem' || state.debutCompanyIds.includes(companyId)
                ? 0
                : Math.min(treasury, MajorShareCount1822 / 2 - pool)
        const cash = finiteCashOwnedBy(state, { kind: 'company', companyId })
        const redeemable =
            committed === 'issue' ? 0 : Math.min(pool, Math.floor(cash / space.price))
        return [
            ...Array.from({ length: Math.max(0, issuable) }, (_, index): FinanceChoice => {
                const shares = index + 1
                return {
                    companyId,
                    operation: 'issue',
                    shares,
                    amount: shares * Market1822.move(space.id, 'down', shares).price
                }
            }),
            ...Array.from({ length: redeemable }, (_, index): FinanceChoice => ({
                companyId,
                operation: 'redeem',
                shares: index + 1,
                amount: (index + 1) * space.price
            }))
        ]
    },
    afterSettling(state, choice) {
        if (choice.operation === 'issue')
            Market1822.moveCompanyMarker(state.stockMarket, choice.companyId, 'down', choice.shares)
    }
}

/** The income a phase-credit private sets aside on its charter as it pays its player (Table 3). */
export function phaseCreditPayments1822(
    state: FinancialState & { phaseId: string }
): CashPayment[] {
    return PhaseCreditPrivateIds.flatMap((privateCompanyId) => {
        const company = state.companies.find((entry) => entry.id === privateCompanyId)
        if (!company || company.closed) return []
        if (privateOwner(state, privateCompanyId)?.kind !== 'player') return []
        return [
            {
                from: { kind: 'bank' as const },
                to: { kind: 'company' as const, companyId: privateCompanyId },
                amount: privateIncome1822(state, privateCompanyId)
            }
        ]
    })
}
