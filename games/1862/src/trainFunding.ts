import {
    SystemActionFirstHandler,
    TrainPurchase,
    actsFor,
    endOperatingTurn,
    finiteCashOwnedBy,
    getCompany,
    inReceivership,
    placeStockMarker,
    settleCashPayments,
    sharesOwned,
    stepAction,
    trainsOwnedBy,
    CashPayment,
    type EighteenXXStateHandler,
    type ReceivershipRules,
    type StepAction
} from '@tabletop/18xx'
import { ActionSource, assert, assertExists, type HydratedAction } from '@tabletop/common'
import * as Type from 'typebox'
import { resetCompany1862 } from './companyReset.js'
import { receiverOf } from './receivers.js'
import { refinancingCapital } from './mergers.js'
import { MarketPoolId, charterPoolId } from './pools.js'
import { beginShareMerge } from './shareMerge.js'
import { requireState1862, type HydratedState1862, type State1862 } from './state.js'
import { BankruptcyPrice, Market1862 } from './stockMarket.js'
import { saleValue } from './stockRules.js'
import { systemAction, titleAction } from './titleAction.js'
import { TrainDepot1862, trainFace, trainDefinitionId } from './trains.js'
import { TrainRules1862 } from './operating.js'

const Id = Type.String({ minLength: 1 })
const treasury = (companyId: string) => ({ kind: 'company' as const, companyId })

/** The price of the bank's next train, of whatever kind (§7.9). */
export function nextBankTrainPrice(state: State1862): number | undefined {
    const [definitionId] = TrainRules1862.availableDefinitions(state)
    return definitionId ? TrainDepot1862.trainDefinition(definitionId).price : undefined
}

/** Whether the buying company has no train and cannot pay for the bank's next (§7.11). */
export function mustRaiseCash(state: State1862, companyId: string): boolean {
    const price = nextBankTrainPrice(state)
    return (
        state.machineState === 'BuyingTrains' &&
        state.trainPurchaseStep?.companyId === companyId &&
        !trainsOwnedBy(state, treasury(companyId)).length &&
        price !== undefined &&
        finiteCashOwnedBy(state, treasury(companyId)) < price
    )
}

function charterShares(state: State1862, companyId: string) {
    return state.certificates.filter(
        (certificate) =>
            certificate.kind === 'share' &&
            certificate.companyId === companyId &&
            certificate.poolId === charterPoolId(companyId)
    )
}

/**
 * The fewest of its own shares the company sells, at full market price, to afford the bank's
 * next train; none if even all would not (§7.11.1).
 */
export function treasurySale(state: State1862, companyId: string): number | undefined {
    const price = nextBankTrainPrice(state)
    if (price === undefined || !mustRaiseCash(state, companyId) || inReceivership(state, companyId))
        return undefined
    const share = Market1862.companySpace(state.stockMarket, companyId).price
    const short = price - finiteCashOwnedBy(state, treasury(companyId))
    const needed = Math.ceil(short / Math.max(share, 1))
    return share > 0 && needed <= charterShares(state, companyId).length ? needed : undefined
}

/** Whether refinancing would let the company afford the bank's next train (§7.11.2). */
export function canRefinance(state: State1862, companyId: string): boolean {
    const price = nextBankTrainPrice(state)
    return (
        price !== undefined &&
        mustRaiseCash(state, companyId) &&
        !inReceivership(state, companyId) &&
        finiteCashOwnedBy(state, treasury(companyId)) + refinancingCapital(state, companyId) >=
            price
    )
}

const SellAction = titleAction('SellTreasuryShares', {
    companyId: Id,
    shares: Type.Integer({ minimum: 1 }),
    metadata: Type.Optional(
        Type.Object(
            { proceeds: Type.Integer({ minimum: 0 }), toMarketSpaceId: Type.String() },
            { additionalProperties: false }
        )
    )
})
export const SellTreasuryShares = SellAction.schema
export const isSellTreasuryShares = SellAction.is

/** A train-less company sells the fewest of its own shares that buy the bank's train (§7.11.1). */
export class HydratedSellTreasuryShares extends SellAction.Base {
    isValid(state: HydratedState1862): boolean {
        return (
            this.source === ActionSource.User &&
            actsFor(state, this.playerId, this.companyId) &&
            treasurySale(state, this.companyId) === this.shares
        )
    }
    apply(state: HydratedState1862): void {
        assert(this.isValid(state), 'The company sells the fewest shares that buy its train')
        const price = Market1862.companySpace(state.stockMarket, this.companyId).price
        for (const certificate of charterShares(state, this.companyId).slice(0, this.shares)) {
            certificate.owner = { kind: 'bank' }
            certificate.poolId = MarketPoolId
        }
        const proceeds = price * this.shares
        settleCashPayments(state, [
            { from: { kind: 'bank' }, to: treasury(this.companyId), amount: proceeds }
        ])
        // Each share moves the price down, as the director's sales do (§7.11.1).
        const to = Market1862.move(
            Market1862.companySpace(state.stockMarket, this.companyId).id,
            'down',
            this.shares
        )
        placeStockMarker(state.stockMarket, this.companyId, to.id)
        state.raisedForTrain = this.companyId
        this.metadata = { proceeds, toMarketSpaceId: to.id }
    }
}

const RefinanceAction = titleAction('Refinance', { companyId: Id })
export const Refinance = RefinanceAction.schema
export const isRefinance = RefinanceAction.is

/**
 * A train-less company refinances: its shares merge 2:1 for every holder, and it receives ten
 * times its par, at most £1,000 (§7.11.2, §5).
 */
export class HydratedRefinance extends RefinanceAction.Base {
    isValid(state: HydratedState1862): boolean {
        return (
            this.source === ActionSource.User &&
            actsFor(state, this.playerId, this.companyId) &&
            canRefinance(state, this.companyId)
        )
    }
    apply(state: HydratedState1862): void {
        assert(this.isValid(state), 'Refinancing buys the company its train')
        state.raisedForTrain = this.companyId
        beginShareMerge(state, {
            kind: 'refinance',
            initiatorId: this.playerId,
            survivorId: this.companyId,
            price: Market1862.companySpace(state.stockMarket, this.companyId).price
        })
    }
}

/**
 * A company goes bankrupt: holders are paid what their shares would sell for, its treasury goes
 * to the bank, its trains and stations leave play, and it may be started again (§7.12).
 */
export function bankruptCompany(state: HydratedState1862, companyId: string): CashPayment[] {
    const value = getCompany(state, companyId).started ? saleValue(state, companyId) : 0
    const payments: CashPayment[] = []
    if (value)
        for (const { playerId } of state.players) {
            const owner = { kind: 'player' as const, playerId }
            const shares = sharesOwned(state, companyId, owner)
            if (shares) payments.push({ from: { kind: 'bank' }, to: owner, amount: shares * value })
        }
    settleCashPayments(state, payments)
    const operating =
        state.trainPurchaseStep?.companyId ??
        state.routeStep?.companyId ??
        state.stationStep?.companyId ??
        state.trackStep?.companyId
    if (operating === companyId) {
        endOperatingTurn(state, companyId)
        delete state.trainPurchaseStep
    }
    resetCompany1862(state, companyId)
    if (state.operatingSet)
        state.operatingSet.companyOrder = state.operatingSet.companyOrder.filter(
            (id) => id !== companyId || state.operatingSet?.completedCompanyIds.includes(id)
        )
    return payments
}

const BankruptAction = titleAction('GoBankrupt', {
    companyId: Id,
    metadata: Type.Optional(
        Type.Object({ payments: Type.Array(CashPayment) }, { additionalProperties: false })
    )
})
export const GoBankrupt = BankruptAction.schema
export const isGoBankrupt = BankruptAction.is

/** A train-less company that can raise no money for a train goes bankrupt (§7.11, §7.12). */
export class HydratedGoBankrupt extends BankruptAction.Base {
    isValid(state: HydratedState1862): boolean {
        return (
            this.source === ActionSource.User &&
            actsFor(state, this.playerId, this.companyId) &&
            mustRaiseCash(state, this.companyId) &&
            treasurySale(state, this.companyId) === undefined &&
            !canRefinance(state, this.companyId)
        )
    }
    apply(state: HydratedState1862): void {
        assert(this.isValid(state), 'Only a company with no way to a train goes bankrupt')
        this.metadata = { payments: bankruptCompany(state, this.companyId) }
    }
}

/**
 * A company the system bankrupts: one whose price reached the bottom of the market, or one in
 * receivership that has just ended its turn without a train, having been unable to buy one in
 * its train-buying step (§7.3, §7.12).
 */
export function dueBankruptcy(state: State1862): string | undefined {
    const atBottom = state.companies.find(
        (company) =>
            company.started &&
            !company.closed &&
            Market1862.companySpace(state.stockMarket, company.id).price <= BankruptcyPrice
    )
    if (atBottom) return atBottom.id
    const set = state.operatingSet
    const finished =
        state.machineState === 'OperatingSet' ? set?.completedCompanyIds.at(-1) : undefined
    return finished &&
        !set?.completed &&
        getCompany(state, finished).started &&
        inReceivership(state, finished) &&
        !trainsOwnedBy(state, treasury(finished)).length
        ? finished
        : undefined
}

const CloseAction = systemAction('BankruptCompany', {
    companyId: Id,
    metadata: Type.Optional(
        Type.Object({ payments: Type.Array(CashPayment) }, { additionalProperties: false })
    )
})
export const BankruptCompany = CloseAction.schema
export const isBankruptCompany = CloseAction.is

export class HydratedBankruptCompany extends CloseAction.Base {
    apply(state: HydratedState1862): void {
        assert(
            this.source === ActionSource.System && dueBankruptcy(state) === this.companyId,
            'The company is due to go bankrupt'
        )
        this.metadata = { payments: bankruptCompany(state, this.companyId) }
    }
}

/** Bankrupts a company as soon as one is due, before anything else happens. */
export function bankruptsCompanies(
    handler: EighteenXXStateHandler<HydratedState1862>,
    next?: string | ((state: HydratedState1862) => string)
): EighteenXXStateHandler<HydratedState1862> {
    return new SystemActionFirstHandler(
        handler,
        BankruptCompany,
        (state) => {
            const companyId = dueBankruptcy(state)
            return companyId ? { companyId } : undefined
        },
        next
    )
}

/** The company may redeem one of its shares from the Bank Pool this turn (§7.13). */
export function redeemableShare(state: State1862, playerId: string, companyId: string) {
    if (
        state.redeemed ||
        state.machineState !== 'BuyingTrains' ||
        state.trainPurchaseStep?.companyId !== companyId ||
        inReceivership(state, companyId) ||
        !actsFor(state, playerId, companyId)
    )
        return undefined
    const price = Market1862.companySpace(state.stockMarket, companyId).price
    if (finiteCashOwnedBy(state, treasury(companyId)) < price) return undefined
    const certificate = state.certificates.find(
        (entry) =>
            entry.kind === 'share' &&
            !entry.president &&
            entry.companyId === companyId &&
            entry.poolId === MarketPoolId
    )
    return certificate ? { certificateId: certificate.id, price } : undefined
}

const RedeemAction = titleAction('RedeemShare', { companyId: Id, certificateId: Id })
export const RedeemShare = RedeemAction.schema
export const isRedeemShare = RedeemAction.is

/** The company buys back one of its shares from the Bank Pool at market price (§7.13). */
export class HydratedRedeemShare extends RedeemAction.Base {
    isValid(state: HydratedState1862): boolean {
        return (
            this.source === ActionSource.User &&
            redeemableShare(state, this.playerId, this.companyId)?.certificateId ===
                this.certificateId
        )
    }
    apply(state: HydratedState1862): void {
        const redeemable = redeemableShare(state, this.playerId, this.companyId)
        assert(this.isValid(state) && redeemable, 'The company redeems a pool share it can pay for')
        const certificate = state.certificates.find((entry) => entry.id === this.certificateId)
        assertExists(certificate, 'The share exists')
        settleCashPayments(state, [
            { from: treasury(this.companyId), to: { kind: 'bank' }, amount: redeemable.price }
        ])
        certificate.owner = treasury(this.companyId)
        certificate.poolId = charterPoolId(this.companyId)
        state.redeemed = true
    }
}

const isAction =
    <Action>(type: new (...args: never[]) => Action) =>
    (
        action: HydratedAction
    ): action is HydratedAction & Action & { isValid(state: HydratedState1862): boolean } =>
        action instanceof type

export const FundingSteps: readonly StepAction<HydratedState1862>[] = [
    stepAction(SellAction.type, isAction(HydratedSellTreasuryShares), (state, playerId) => {
        const companyId = state.trainPurchaseStep?.companyId
        return (
            !!companyId &&
            actsFor(state, playerId, companyId) &&
            treasurySale(state, companyId) !== undefined
        )
    }),
    stepAction(RefinanceAction.type, isAction(HydratedRefinance), (state, playerId) => {
        const companyId = state.trainPurchaseStep?.companyId
        return !!companyId && actsFor(state, playerId, companyId) && canRefinance(state, companyId)
    }),
    stepAction(BankruptAction.type, isAction(HydratedGoBankrupt), (state, playerId) => {
        const companyId = state.trainPurchaseStep?.companyId
        return (
            !!companyId &&
            actsFor(state, playerId, companyId) &&
            mustRaiseCash(state, companyId) &&
            treasurySale(state, companyId) === undefined &&
            !canRefinance(state, companyId)
        )
    }),
    stepAction(RedeemAction.type, isAction(HydratedRedeemShare), (state, playerId) => {
        const companyId = state.trainPurchaseStep?.companyId
        return !!companyId && !!redeemableShare(state, playerId, companyId)
    })
]

/** The kind a director-less company buys: the first of Express, Freight, Local it may run (§8). */
function receiverKind(state: State1862, companyId: string) {
    const permits = state.permits[companyId] ?? []
    return (['express', 'freight', 'local'] as const).find((kind) => permits.includes(kind))
}

export const ReceivershipRules1862: ReceivershipRules = {
    // The majority holder runs it, ties going clockwise from priority (§8).
    operators(state, companyId) {
        const playerId = receiverOf(state, companyId)
        return playerId ? [playerId] : []
    },
    earningsChoice: () => 'withhold',
    // The next bank train of a kind it may run, if it can pay, one an operating round (§7.3, §8).
    trainPurchase(state, companyId, rules) {
        const title = requireState1862(state)
        if (title.trainPurchaseStep?.purchasedTrainIds.length) return undefined
        const kind = receiverKind(title, companyId)
        const [first] = rules.availableDefinitions(state)
        if (!kind || !first) return undefined
        const definitionId = trainDefinitionId(trainFace(first).band, kind)
        const offer = new TrainPurchase(state, rules)
            .offers()
            .find((entry) => entry.definitionId === definitionId)?.evaluation.details
        if (!offer) return undefined
        const { price, ...request } = offer
        return { ...request, expectedPrice: price }
    }
}

export const FundingActions = [
    SellAction.define((action) => new HydratedSellTreasuryShares(action)),
    RefinanceAction.define((action) => new HydratedRefinance(action)),
    BankruptAction.define((action) => new HydratedGoBankrupt(action)),
    CloseAction.define((action) => new HydratedBankruptCompany(action)),
    RedeemAction.define((action) => new HydratedRedeemShare(action))
]
