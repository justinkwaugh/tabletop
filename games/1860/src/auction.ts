import {
    roundEnd,
    RoundEnd,
    settleCashPayments,
    startCompanyAtPar,
    startFirstStockRound,
    finiteCashOwnedBy,
    systemAction,
    titleAction,
    type CashPayment,
    type EighteenXXStateHandler
} from '@tabletop/18xx'
import {
    ActionSource,
    assert,
    assertExists,
    turnOrderFrom,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import * as Type from 'typebox'
import {
    DirectorShares,
    LayerParRanges,
    PrivateCatalog1860,
    company1860,
    isCompany1860
} from './companies.js'
import { EndingRules1860 } from './ending.js'
import { IpoPoolId } from './names.js'
import { ChoiceAuctionState, type HydratedState1860, type State1860 } from './state.js'
import { Market1860, ParPrices1860, marketSpaceIdAt } from './stockMarket.js'
import type { ChoiceAuction } from './titleState.js'

/** A bid raises the last by at least £5, the first bid being at least £5 (Initial Auction). */
export const MinimumRaise = 5

const player = (playerId: string) => ({ kind: 'player' as const, playerId })

/** The par prices the first layer's director's shares may be bought at in the auction. */
export const AuctionParPrices: readonly number[] = ParPrices1860.filter(
    (price) => price >= LayerParRanges[1].minimum && price <= LayerParRanges[1].maximum
)

/** What a certificate on offer costs beside the bid: a private's face, or twice a par. */
export function lotCost(lotId: string, parPrice = AuctionParPrices[0]): number {
    return isCompany1860(lotId) ? DirectorShares * parPrice : PrivateCatalog1860.faceValue(lotId)
}

/** The cheapest certificate still on offer. */
export function cheapestLotCost(auction: ChoiceAuction): number {
    return Math.min(...auction.lotIds.map((lotId) => lotCost(lotId)))
}

export function requireAuction(state: State1860): ChoiceAuction {
    assertExists(state.choiceAuction, 'The initial auction is under way')
    return state.choiceAuction
}

/** Whether the player may bid this much: enough money left to pay for the cheapest certificate. */
export function canBid(state: State1860, playerId: string, amount: number): boolean {
    const auction = requireAuction(state)
    return (
        Number.isSafeInteger(amount) &&
        amount >= (auction.bid?.amount ?? 0) + MinimumRaise &&
        amount + cheapestLotCost(auction) <= finiteCashOwnedBy(state, player(playerId))
    )
}

export function minimumBid(auction: ChoiceAuction): number {
    return (auction.bid?.amount ?? 0) + MinimumRaise
}

export function maximumBid(state: State1860, playerId: string): number {
    const auction = requireAuction(state)
    return finiteCashOwnedBy(state, player(playerId)) - cheapestLotCost(auction)
}

type Decision =
    { kind: 'bid'; playerId: string } | { kind: 'choose'; playerId: string; bid: number }

/**
 * Who acts next: the next player round from the high bidder (or from the opener, before any
 * bid) who has not passed. Once every other player has passed, the high bidder chooses; when
 * nobody bid, the first to pass does (Initial Auction).
 */
export function auctionDecision(state: State1860): Decision | undefined {
    const auction = state.choiceAuction
    if (!auction) return undefined
    if (auction.winner)
        return { kind: 'choose', playerId: auction.winner.playerId, bid: auction.winner.amount }
    const order = state.turnManager.turnOrder
    const from = auction.bid?.playerId ?? auction.starterId
    const bidderId = turnOrderFrom(order, from).find(
        (playerId) => playerId !== auction.bid?.playerId && !auction.passedIds.includes(playerId)
    )
    if (bidderId) return { kind: 'bid', playerId: bidderId }
    return undefined
}

/** Settles the auction's winner once nobody is left to bid. */
function settleWinner(state: State1860): void {
    const auction = requireAuction(state)
    if (auction.winner || auctionDecision(state)) return
    auction.winner = auction.bid
        ? { ...auction.bid }
        : { playerId: auction.passedIds[0] ?? auction.starterId, amount: 0 }
}

type LotChoice = { lotId: string; parPrices: readonly number[] }

/**
 * The certificates the winner may take, with the pars a director's share may be bought at: those
 * they can pay for after their bid, or, having bid nothing and able to pay for none, the
 * cheapest, for all they have, a director's share then at the lowest par (Initial Auction).
 */
export function lotChoices(state: State1860, playerId: string): LotChoice[] {
    const auction = requireAuction(state)
    const decision = auctionDecision(state)
    if (decision?.kind !== 'choose' || decision.playerId !== playerId) return []
    const cash = finiteCashOwnedBy(state, player(playerId)) - decision.bid
    const affordable = auction.lotIds.flatMap((lotId): LotChoice[] => {
        if (!isCompany1860(lotId)) return lotCost(lotId) <= cash ? [{ lotId, parPrices: [] }] : []
        const parPrices = AuctionParPrices.filter((par) => lotCost(lotId, par) <= cash)
        return parPrices.length ? [{ lotId, parPrices }] : []
    })
    if (affordable.length) return affordable
    const cheapest = cheapestLotCost(auction)
    return auction.lotIds
        .filter((lotId) => lotCost(lotId) === cheapest)
        .map((lotId) => ({
            lotId,
            parPrices: isCompany1860(lotId) ? [AuctionParPrices[0]] : []
        }))
}

const Bid = Type.Integer({ minimum: MinimumRaise })

const BidAction = titleAction('BidForChoice', { amount: Bid })
export const BidForChoice = BidAction.schema
export const isBidForChoice = BidAction.is
/** A player raises the bid for the right to choose a certificate. */
export class HydratedBidForChoice extends BidAction.Base {
    declare playerId: string
    declare amount: Type.Static<typeof BidForChoice>['amount']
    isValid(state: HydratedState1860): boolean {
        const decision = auctionDecision(state)
        return (
            this.source === ActionSource.User &&
            decision?.kind === 'bid' &&
            decision.playerId === this.playerId &&
            canBid(state, this.playerId, this.amount)
        )
    }
    apply(state: HydratedState1860): void {
        assert(this.isValid(state), 'The next bidder raises the bid')
        requireAuction(state).bid = { playerId: this.playerId, amount: this.amount }
        settleWinner(state)
    }
}

const PassAction = titleAction('PassForChoice', {})
export const PassForChoice = PassAction.schema
export const isPassForChoice = PassAction.is
/** A player sits out the rest of this auction; one who cannot bid is passed for. */
export class HydratedPassForChoice extends PassAction.Base {
    declare playerId: string
    isValid(state: HydratedState1860): boolean {
        const decision = auctionDecision(state)
        const auction = requireAuction(state)
        return (
            decision?.kind === 'bid' &&
            decision.playerId === this.playerId &&
            (this.source === ActionSource.User ||
                !canBid(state, this.playerId, minimumBid(auction)))
        )
    }
    apply(state: HydratedState1860): void {
        assert(this.isValid(state), 'Only the next bidder passes')
        requireAuction(state).passedIds.push(this.playerId)
        settleWinner(state)
    }
}

const ChooseAction = titleAction('ChooseCertificate', {
    lotId: Type.String({ minLength: 1 }),
    parPrice: Type.Optional(Type.Integer({ minimum: 1 })),
    metadata: Type.Optional(
        Type.Object(
            {
                bid: Type.Integer({ minimum: 0 }),
                cost: Type.Integer({ minimum: 0 }),
                certificateId: Type.String()
            },
            { additionalProperties: false }
        )
    )
})
export const ChooseCertificate = ChooseAction.schema
export const isChooseCertificate = ChooseAction.is
/**
 * The winner pays their bid, then takes a certificate and pays for it: a private at its face
 * value, a director's share at twice the par they set (Initial Auction).
 */
export class HydratedChooseCertificate extends ChooseAction.Base {
    declare playerId: string
    declare lotId: Type.Static<typeof ChooseCertificate>['lotId']
    declare parPrice: Type.Static<typeof ChooseCertificate>['parPrice']
    declare metadata?: Type.Static<typeof ChooseCertificate>['metadata']
    isValid(state: HydratedState1860): boolean {
        const choice = lotChoices(state, this.playerId).find((entry) => entry.lotId === this.lotId)
        return (
            this.source === ActionSource.User &&
            !!choice &&
            (isCompany1860(this.lotId)
                ? this.parPrice !== undefined && choice.parPrices.includes(this.parPrice)
                : this.parPrice === undefined)
        )
    }
    apply(state: HydratedState1860): void {
        assert(this.isValid(state), 'The winner takes a certificate on offer')
        const auction = requireAuction(state)
        const decision = auctionDecision(state)
        assert(decision?.kind === 'choose', 'The auction has a winner')
        const buyer = player(this.playerId)
        const cash = finiteCashOwnedBy(state, buyer) - decision.bid
        const cost = Math.min(cash, lotCost(this.lotId, this.parPrice))
        const payments: CashPayment[] = [
            ...(decision.bid
                ? [{ from: buyer, to: { kind: 'bank' as const }, amount: decision.bid }]
                : []),
            ...(cost ? [{ from: buyer, to: { kind: 'bank' as const }, amount: cost }] : [])
        ]
        settleCashPayments(state, payments)
        const certificateId = isCompany1860(this.lotId)
            ? this.startCompany(state, buyer)
            : this.takePrivate(state, buyer)
        auction.lotIds = auction.lotIds.filter((lotId) => lotId !== this.lotId)
        this.metadata = { bid: decision.bid, cost, certificateId }
        const order = state.turnManager.turnOrder
        // The next auction opens with the player after this one's winner.
        state.choiceAuction = {
            starterId: order[(order.indexOf(this.playerId) + 1) % order.length],
            passedIds: [],
            lotIds: auction.lotIds
        }
    }
    private startCompany(state: HydratedState1860, buyer: ReturnType<typeof player>): string {
        assertExists(this.parPrice, 'A director’s share is bought at a par')
        company1860(this.lotId)
        startCompanyAtPar(state, Market1860, this.lotId, marketSpaceIdAt(this.parPrice))
        const director = state.certificates.find(
            (certificate) =>
                certificate.kind === 'share' &&
                certificate.companyId === this.lotId &&
                certificate.president &&
                certificate.poolId === IpoPoolId
        )
        assertExists(director, 'The director’s share is in the IPO')
        director.owner = buyer
        delete director.poolId
        return director.id
    }
    private takePrivate(state: HydratedState1860, buyer: ReturnType<typeof player>): string {
        const certificate = state.certificates.find(
            (entry) => entry.kind === 'private' && entry.companyId === this.lotId
        )
        assertExists(certificate, 'The private’s certificate is on offer')
        certificate.owner = buyer
        delete certificate.poolId
        return certificate.id
    }
}

/**
 * Priority goes to the player with the most money; between those with equal money, to the one
 * holding the least face value of privates, among the tied players holding any, else to the
 * first of them in turn order (Initial Auction; AU-6).
 */
export function priorityAfterAuction(state: State1860): string {
    const order = state.turnManager.turnOrder
    const cash = (playerId: string) => finiteCashOwnedBy(state, player(playerId))
    const most = Math.max(...order.map(cash))
    const richest = order.filter((playerId) => cash(playerId) === most)
    if (richest.length === 1) return richest[0]
    const faceValue = (playerId: string) =>
        state.certificates
            .filter(
                (certificate) =>
                    certificate.kind === 'private' &&
                    certificate.owner.kind === 'player' &&
                    certificate.owner.playerId === playerId
            )
            .reduce(
                (sum, certificate) => sum + PrivateCatalog1860.faceValue(certificate.companyId),
                0
            )
    const holders = richest.filter((playerId) => faceValue(playerId) > 0)
    const candidates = holders.length ? holders : richest
    const least = Math.min(...candidates.map(faceValue))
    const chosen = candidates.find((playerId) => faceValue(playerId) === least)
    assertExists(chosen, 'A player takes priority')
    return chosen
}

const EndAction = systemAction('EndInitialAuction', {
    metadata: Type.Optional(
        Type.Object(
            { priorityPlayerId: Type.String(), roundEnd: RoundEnd },
            { additionalProperties: false }
        )
    )
})
export const EndInitialAuction = EndAction.schema
export const isEndInitialAuction = EndAction.is
/** Once all six certificates are sold, priority is dealt and the first stock round begins. */
export class HydratedEndInitialAuction extends EndAction.Base {
    declare metadata?: Type.Static<typeof EndInitialAuction>['metadata']
    apply(state: HydratedState1860): void {
        assert(
            this.source === ActionSource.System && state.choiceAuction?.lotIds.length === 0,
            'The auction ends once every certificate is sold'
        )
        const priorityPlayerId = priorityAfterAuction(state)
        delete state.choiceAuction
        startFirstStockRound(state, turnOrderFrom(state.turnManager.turnOrder, priorityPlayerId))
        state.activePlayerIds = [priorityPlayerId]
        this.metadata = { priorityPlayerId, roundEnd: roundEnd(state, EndingRules1860, 'opening') }
    }
}

type Context = MachineContext<HydratedState1860>

/** Each bidder and chooser acts in a turn of their own. */
function startTurnOf(state: HydratedState1860, playerId: string): void {
    const turn = state.turnManager.currentTurn()
    if (turn?.playerId === playerId) return
    if (turn) state.turnManager.endTurn(state.actionCount)
    state.turnManager.startTurn(playerId, state.actionCount + 1)
}

/** The six auctions for the right to choose, until every certificate has been taken. */
export class ChoiceAuctionHandler implements EighteenXXStateHandler<HydratedState1860> {
    isValidAction(action: HydratedAction, context: Context): boolean {
        const state = context.gameState
        if (action instanceof HydratedEndInitialAuction)
            return action.source === ActionSource.System && state.choiceAuction?.lotIds.length === 0
        return (
            (action instanceof HydratedBidForChoice ||
                action instanceof HydratedPassForChoice ||
                action instanceof HydratedChooseCertificate) &&
            action.isValid(state)
        )
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        const state = context.gameState
        const decision = auctionDecision(state)
        if (decision?.playerId !== playerId) return []
        if (decision.kind === 'choose') return [ChooseAction.type]
        const auction = requireAuction(state)
        return canBid(state, playerId, minimumBid(auction)) ? [BidAction.type, PassAction.type] : []
    }
    enter(context: Context): void {
        const state = context.gameState
        const auction = requireAuction(state)
        if (!auction.lotIds.length) {
            state.activePlayerIds = []
            context.addSystemAction(EndInitialAuction, {})
            return
        }
        const decision = auctionDecision(state)
        assertExists(decision, 'An auction under way has someone to act')
        state.activePlayerIds = [decision.playerId]
        startTurnOf(state, decision.playerId)
        if (decision.kind === 'bid' && !canBid(state, decision.playerId, minimumBid(auction)))
            context.addSystemAction(PassForChoice, { playerId: decision.playerId })
    }
    onAction(action: HydratedAction): string {
        return action instanceof HydratedEndInitialAuction ? 'StockRound' : ChoiceAuctionState
    }
}

export const AuctionActions = [
    BidAction.define((action) => new HydratedBidForChoice(action)),
    PassAction.define((action) => new HydratedPassForChoice(action)),
    ChooseAction.define((action) => new HydratedChooseCertificate(action)),
    EndAction.define((action) => new HydratedEndInitialAuction(action))
]
