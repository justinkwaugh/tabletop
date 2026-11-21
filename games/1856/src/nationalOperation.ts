import {
    ActionSource,
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import {
    CashPayment,
    SharePurchaseDetails,
    SystemActionFirstHandler,
    applySharePurchase,
    chargePlayers,
    evaluateSharePurchase,
    finiteCashOwnedBy,
    getCompany,
    nextOperatingCompany,
    presidentCertificate,
    presidentOf,
    recordStockAction,
    recordTurnPurchase,
    releaseTrains,
    removeCertificates,
    sharesOwned,
    systemAction,
    titleAction,
    trainsOwnedBy,
    type StockRules
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { CgrId } from './companies.js'
import { IpoPoolId1856, MarketPoolId1856 } from './names.js'
import { requireState1856, type HydratedState1856, type StateHandler1856 } from './state.js'
import { Market1856 } from './stockMarket.js'
import { StockRoundRules1856, StockRules1856 } from './stock.js'
import { TrainDepot1856, finalTrainId, finalTrainSales, isPermanentTrain } from './trains.js'

const Id = Type.String({ minLength: 1 })

/** The train the CGR borrows, the final train if on sale, otherwise the 6 (CGR Trains). */
function borrowable(state: HydratedState1856): string | undefined {
    const onSale = finalTrainSales(state).availableDefinitions?.(state) ?? []
    const permanent = onSale.filter(
        (definitionId) =>
            isPermanentTrain(definitionId) &&
            TrainDepot1856.remaining(state.trainInventory, definitionId) !== 0
    )
    const final = finalTrainId(state.trainInventory)
    return permanent.includes(final) ? final : permanent[0]
}

/**
 * Before it owns a permanent train, a CGR without trains borrows one from the bank for its run,
 * which neither starts a phase nor stays with it (CGR Trains).
 */
function borrowDue(state: HydratedState1856): string | undefined {
    if (nextOperatingCompany(state) !== CgrId) return undefined
    const national = state.national
    if (!national || national.permanentTrain || national.borrowedTrainId) return undefined
    if (state.routeStep?.result) return undefined
    if (trainsOwnedBy(state, { kind: 'company', companyId: CgrId }).length) return undefined
    return borrowable(state)
}

const BorrowTrainAction = systemAction('BorrowTrain', {
    definitionId: Id,
    metadata: Type.Optional(Type.Object({ trainId: Id }, { additionalProperties: false }))
})
export const BorrowTrain = BorrowTrainAction.schema
export type BorrowTrain = Type.Static<typeof BorrowTrain>
export const isBorrowTrain = BorrowTrainAction.is

class HydratedBorrowTrain extends BorrowTrainAction.Base implements BorrowTrain {
    declare type: 'BorrowTrain'
    declare definitionId: string
    declare metadata?: BorrowTrain['metadata']
    apply(state: HydratedState1856): void {
        assert(
            this.source === ActionSource.System && borrowDue(state) === this.definitionId,
            'The CGR borrows a train only while it has none and no permanent train'
        )
        const train = TrainDepot1856.nextTrain(state.trainInventory, this.definitionId)
        assertExists(train, 'The bank has the train to lend')
        TrainDepot1856.purchase(state.trainInventory, train.id, this.definitionId, {
            kind: 'company',
            companyId: CgrId
        })
        const national = state.national
        assertExists(national, 'The CGR has formed')
        national.borrowedTrainId = train.id
        this.metadata = { trainId: train.id }
    }
}

const ReturnBorrowedTrainAction = systemAction('ReturnBorrowedTrain', {
    trainId: Id
})
export const ReturnBorrowedTrain = ReturnBorrowedTrainAction.schema
export type ReturnBorrowedTrain = Type.Static<typeof ReturnBorrowedTrain>

function returnDue(state: HydratedState1856): string | undefined {
    return state.national?.borrowedTrainId
}

/** The borrowed train goes back to the bank once the CGR has run it (CGR Trains). */
class HydratedReturnBorrowedTrain
    extends ReturnBorrowedTrainAction.Base
    implements ReturnBorrowedTrain
{
    declare type: 'ReturnBorrowedTrain'
    declare trainId: string
    apply(state: HydratedState1856): void {
        assert(
            this.source === ActionSource.System && returnDue(state) === this.trainId,
            'The borrowed train is returned after its run'
        )
        const train = state.trainInventory.trains.find((entry) => entry.id === this.trainId)
        assertExists(train, 'The borrowed train is known')
        if (TrainDepot1856.remaining(state.trainInventory, train.definitionId) === 'unlimited')
            releaseTrains(state.trainInventory, [this.trainId], 'removed')
        else TrainDepot1856.restock(state.trainInventory, this.trainId)
        delete state.national?.borrowedTrainId
    }
}

/** Whether the CGR has a permanent train of its own, never yet noted. */
function permanentDue(state: HydratedState1856): boolean {
    const national = state.national
    return (
        !!national &&
        !national.permanentTrain &&
        trainsOwnedBy(state, { kind: 'company', companyId: CgrId }).some(
            (train) => train.id !== national.borrowedTrainId && isPermanentTrain(train.definitionId)
        )
    )
}

const NoteNationalPermanentTrainAction = systemAction('NoteNationalPermanentTrain', {})
export const NoteNationalPermanentTrain = NoteNationalPermanentTrainAction.schema
export type NoteNationalPermanentTrain = Type.Static<typeof NoteNationalPermanentTrain>

/**
 * Once the CGR owns a permanent train its price moves and it may pay dividends; it borrows no
 * more (CGR Trains).
 */
class HydratedNoteNationalPermanentTrain
    extends NoteNationalPermanentTrainAction.Base
    implements NoteNationalPermanentTrain
{
    declare type: 'NoteNationalPermanentTrain'
    apply(state: HydratedState1856): void {
        assert(
            this.source === ActionSource.System && permanentDue(state),
            'The CGR’s first permanent train is noted once'
        )
        const national = state.national
        assertExists(national, 'The CGR has formed')
        national.permanentTrain = true
    }
}

/** The price of the share that completes the one-share president's certificate. */
export function presidencyShareOffers(
    state: HydratedState1856
): { poolId: string; price: number }[] {
    const cgr = getCompany(state, CgrId)
    return [IpoPoolId1856, MarketPoolId1856].flatMap((poolId) => {
        if (
            !state.certificates.some(
                (certificate) =>
                    certificate.companyId === CgrId &&
                    certificate.kind === 'share' &&
                    !certificate.president &&
                    certificate.poolId === poolId
            )
        )
            return []
        const price =
            poolId === IpoPoolId1856
                ? cgr.parPrice
                : Market1856.companySpace(state.stockMarket, CgrId).price
        return price === undefined ? [] : [{ poolId, price }]
    })
}

/** Whether the player owes the second share of the CGR's presidency in this stock turn. */
export function owesPresidencyShare(state: HydratedState1856, playerId: string): boolean {
    return (
        state.machineState === 'StockRound' &&
        state.national?.presidencyOwedBy === playerId &&
        state.activePlayerIds.includes(playerId)
    )
}

const CompleteNationalPresidencyAction = titleAction('CompleteNationalPresidency', {
    poolId: Id,
    expectedPrice: Type.Integer({ minimum: 0 }),
    metadata: Type.Optional(
        Type.Object(
            {
                payments: Type.Array(CashPayment),
                certificateId: Id,
                unpaid: Type.Integer({ minimum: 0 })
            },
            { additionalProperties: false }
        )
    )
})
export const CompleteNationalPresidency = CompleteNationalPresidencyAction.schema
export type CompleteNationalPresidency = Type.Static<typeof CompleteNationalPresidency>
export const isCompleteNationalPresidency = CompleteNationalPresidencyAction.is

/** Takes a share of the pool out of play and makes the president's certificate whole. */
function completePresidency(state: HydratedState1856, certificateId: string): void {
    removeCertificates(state, [certificateId])
    const certificate = presidentCertificate(state, CgrId)
    assertExists(certificate, 'The CGR has a president’s certificate')
    state.certificates = state.certificates.map((entry) =>
        entry.id === certificate.id ? { ...certificate, shares: 2 } : entry
    )
    delete state.national?.presidencyOwedBy
}

/**
 * The president given the certificate for one share buys a second in their first turn of the
 * next stock round, selling shares if they must; they receive nothing more (Determining the CGR
 * President).
 */
class HydratedCompleteNationalPresidency
    extends CompleteNationalPresidencyAction.Base
    implements CompleteNationalPresidency
{
    declare type: 'CompleteNationalPresidency'
    declare playerId: string
    declare poolId: string
    declare expectedPrice: number
    declare metadata?: CompleteNationalPresidency['metadata']
    isValidFor(state: HydratedState1856): boolean {
        return (
            this.source === ActionSource.User &&
            owesPresidencyShare(state, this.playerId) &&
            !state.stockRound.turn.bought &&
            presidencyShareOffers(state).some(
                (offer) => offer.poolId === this.poolId && offer.price === this.expectedPrice
            )
        )
    }
    apply(state: HydratedState1856): void {
        assert(this.isValidFor(state), 'The president completes their certificate in their turn')
        const certificate = state.certificates.find(
            (entry) =>
                entry.companyId === CgrId &&
                entry.kind === 'share' &&
                !entry.president &&
                entry.poolId === this.poolId
        )
        assertExists(certificate, 'The pool has a CGR share')
        const before = state.cashCrisis
        const payments = chargePlayers(
            state,
            [{ playerId: this.playerId, amount: this.expectedPrice }],
            'StockRound'
        )
        completePresidency(state, certificate.id)
        state.stockRound.turn.bought = true
        recordStockAction(state, this.playerId, StockRoundRules1856)
        this.metadata = {
            payments,
            certificateId: certificate.id,
            unpaid: before ? 0 : (state.cashCrisis?.debts[0]?.amount ?? 0)
        }
    }
}

/**
 * Another player becoming the CGR's president before that turn relieves the one-share president:
 * the share they bought completes the certificate they take (Determining the CGR President).
 */
export function relieveNationalPresidency(state: object, details: SharePurchaseDetails): void {
    const title = requireState1856(state)
    const owed = title.national?.presidencyOwedBy
    if (!owed || details.companyId !== CgrId) return
    const president = presidentOf(title, CgrId)
    if (president?.kind !== 'player' || president.playerId === owed) return
    // The exchange has given the old president a single share; one the new president still
    // holds completes the certificate.
    const single = title.certificates.find(
        (certificate) =>
            certificate.companyId === CgrId &&
            certificate.kind === 'share' &&
            !certificate.president &&
            certificate.owner.kind === 'player' &&
            certificate.owner.playerId === president.playerId
    )
    assertExists(single, 'The new president holds a single CGR share')
    completePresidency(title, single.id)
}

export function borrowsTrain(handler: StateHandler1856): StateHandler1856 {
    return new SystemActionFirstHandler(handler, BorrowTrain, (state) => {
        const definitionId = borrowDue(requireState1856(state))
        return definitionId ? { definitionId } : undefined
    })
}

export function returnsBorrowedTrain(handler: StateHandler1856): StateHandler1856 {
    return new SystemActionFirstHandler(handler, ReturnBorrowedTrain, (state) => {
        const trainId = returnDue(requireState1856(state))
        return trainId ? { trainId } : undefined
    })
}

export function notesNationalPermanentTrain(handler: StateHandler1856): StateHandler1856 {
    return new SystemActionFirstHandler(handler, NoteNationalPermanentTrain, (state) =>
        permanentDue(requireState1856(state)) ? {} : undefined
    )
}

/** CGR shares in the open market beyond half the company (CGR Share Limits). */
export function nationalMarketExcess(state: HydratedState1856): number {
    const cgr = getCompany(state, CgrId)
    if (!cgr.started || cgr.closed) return 0
    const market = state.certificates.reduce(
        (sum, certificate) =>
            sum +
            (certificate.kind === 'share' &&
            certificate.companyId === CgrId &&
            certificate.poolId === MarketPoolId1856
                ? certificate.shares
                : 0),
        0
    )
    return Math.max(0, market - (cgr.shareCount ?? 10) / 2)
}

// The obligation stands whatever the buyer's cash: what they cannot pay is raised afterwards.
// Built on use, as the stock rules and this module import each other.
function unpricedStockRules(): StockRules {
    return {
        ...StockRules1856,
        purchaseTerms(state, certificate, buyer) {
            const terms = StockRules1856.purchaseTerms(state, certificate, buyer)
            return typeof terms === 'string' ? terms : { ...terms, price: 0, payers: [] }
        }
    }
}

/**
 * The open-market CGR share the player owes, with its price: one the rules let them buy, cash
 * aside.
 */
export function owedMarketShare(
    state: HydratedState1856,
    playerId: string
): { details: SharePurchaseDetails; price: number } | undefined {
    if (state.machineState !== 'StockRound' || state.stockRound.turn.bought) return undefined
    if (!state.activePlayerIds.includes(playerId) || !nationalMarketExcess(state)) return undefined
    const buyer = { kind: 'player' as const, playerId }
    if (!sharesOwned(state, CgrId, buyer)) return undefined
    for (const certificate of state.certificates) {
        if (
            certificate.kind !== 'share' ||
            certificate.companyId !== CgrId ||
            certificate.poolId !== MarketPoolId1856
        )
            continue
        const result = evaluateSharePurchase(
            state,
            { playerId, buyer, certificateId: certificate.id },
            unpricedStockRules()
        )
        const terms = StockRules1856.purchaseTerms(state, certificate, buyer)
        if (!result.details || typeof terms === 'string') continue
        assert(terms.recipient.kind === 'bank', 'Open-market shares are bought from the bank')
        return { details: result.details, price: terms.price }
    }
    return undefined
}

/**
 * While the CGR has more than half its shares in the open market, a player holding CGR shares
 * buys one from the market in their turn, selling other shares if they must, bankrupt if they
 * cannot raise its price (designer, 18xx list 49658).
 */
export function owesMarketShare(state: HydratedState1856, playerId: string): boolean {
    return !!owedMarketShare(state, playerId)
}

const BuyNationalMarketShareAction = titleAction('BuyNationalMarketShare', {
    expectedPrice: Type.Integer({ minimum: 0 }),
    metadata: Type.Optional(
        Type.Object(
            {
                purchase: SharePurchaseDetails,
                payments: Type.Array(CashPayment),
                unpaid: Type.Integer({ minimum: 0 })
            },
            { additionalProperties: false }
        )
    )
})
export const BuyNationalMarketShare = BuyNationalMarketShareAction.schema
export type BuyNationalMarketShare = Type.Static<typeof BuyNationalMarketShare>
export const isBuyNationalMarketShare = BuyNationalMarketShareAction.is

/**
 * The owed open-market CGR share, bought whatever the buyer's cash: what they cannot pay they
 * raise by selling shares at once, or go bankrupt (designer, 18xx list 49658).
 */
class HydratedBuyNationalMarketShare
    extends BuyNationalMarketShareAction.Base
    implements BuyNationalMarketShare
{
    declare type: 'BuyNationalMarketShare'
    declare playerId: string
    declare expectedPrice: number
    declare metadata?: BuyNationalMarketShare['metadata']
    isValidFor(state: HydratedState1856): boolean {
        return (
            this.source === ActionSource.User &&
            owedMarketShare(state, this.playerId)?.price === this.expectedPrice
        )
    }
    apply(state: HydratedState1856): void {
        assert(this.isValidFor(state), 'The owed CGR share is bought in the holder’s turn')
        const owed = owedMarketShare(state, this.playerId)
        assertExists(owed, 'The holder owes an open-market CGR share')
        const purchase = owed.details
        recordStockAction(state, this.playerId, StockRoundRules1856)
        recordTurnPurchase(state, StockRules1856, {
            kind: 'share',
            companyId: purchase.companyId,
            ...(purchase.poolId ? { poolId: purchase.poolId } : {})
        })
        applySharePurchase(state, purchase)
        StockRules1856.afterSharePurchase?.(state, purchase)
        const payments = chargePlayers(
            state,
            [{ playerId: this.playerId, amount: owed.price }],
            'StockRound'
        )
        this.metadata = {
            purchase: { ...purchase, price: owed.price, payments },
            payments,
            unpaid: state.cashCrisis?.debts[0]?.amount ?? 0
        }
    }
}

/**
 * In the stock round the one-share president's turn begins with the share they owe, and a CGR
 * holder's with an open-market CGR share while the market holds too many: until it is bought they
 * may only sell to raise its price.
 */
export function completesNationalPresidency(handler: StateHandler1856): StateHandler1856 {
    const owing = (state: HydratedState1856, playerId: string) =>
        owesPresidencyShare(state, playerId) && !state.stockRound.turn.bought
    return {
        enter: (context) => handler.enter(context),
        isValidAction(action: HydratedAction, context: MachineContext<HydratedState1856>) {
            const state = context.gameState
            if (isCompleteNationalPresidency(action))
                return (
                    action instanceof HydratedCompleteNationalPresidency && action.isValidFor(state)
                )
            const playerId =
                'playerId' in action && typeof action.playerId === 'string'
                    ? action.playerId
                    : undefined
            if (playerId && owing(state, playerId))
                return action.type === 'SellShares' && handler.isValidAction(action, context)
            if (isBuyNationalMarketShare(action))
                return action instanceof HydratedBuyNationalMarketShare && action.isValidFor(state)
            if (playerId && owesMarketShare(state, playerId))
                return (
                    (action.type === 'SellShares' ||
                        (action.type === 'BuyShares' &&
                            'certificateId' in action &&
                            state.certificates.some(
                                (certificate) =>
                                    certificate.id === action.certificateId &&
                                    certificate.companyId === CgrId &&
                                    certificate.poolId === MarketPoolId1856
                            ))) &&
                    handler.isValidAction(action, context)
                )
            return handler.isValidAction(action, context)
        },
        validActionsForPlayer(playerId, context) {
            const state = context.gameState
            const actions = handler.validActionsForPlayer(playerId, context)
            if (owing(state, playerId))
                return [
                    'CompleteNationalPresidency',
                    ...actions.filter((type) => type === 'SellShares')
                ]
            if (owesMarketShare(state, playerId))
                return [
                    'BuyNationalMarketShare',
                    ...actions.filter((type) => type === 'SellShares' || type === 'BuyShares')
                ]
            return actions
        },
        onAction(action, context) {
            if (!isCompleteNationalPresidency(action) && !isBuyNationalMarketShare(action))
                return handler.onAction(action, context)
            return context.gameState.cashCrisis ? 'RaisingCash' : 'StockRound'
        }
    }
}

/** What the player has to pay the owed share with. */
export function presidencyCash(state: HydratedState1856, playerId: string): number {
    return finiteCashOwnedBy(state, { kind: 'player', playerId })
}

export const NationalOperationActions1856 = [
    BorrowTrainAction.define((action) => new HydratedBorrowTrain(action)),
    ReturnBorrowedTrainAction.define((action) => new HydratedReturnBorrowedTrain(action)),
    NoteNationalPermanentTrainAction.define(
        (action) => new HydratedNoteNationalPermanentTrain(action)
    ),
    CompleteNationalPresidencyAction.define(
        (action) => new HydratedCompleteNationalPresidency(action)
    ),
    BuyNationalMarketShareAction.define((action) => new HydratedBuyNationalMarketShare(action))
]
