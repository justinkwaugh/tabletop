import {
    FloatCompany,
    isFloatCompany,
    SystemActionFirstHandler,
    canStartStockRound,
    finiteCashOwnedBy,
    nextCompanyToFloat,
    settleCashPayments,
    startCompanyAtPar,
    startFirstStockRound,
    stockCertificateCount,
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
import { CompanyRules1862, canStart } from './companyRules.js'
import { IpoPoolId } from './pools.js'
import { ParliamentState, type HydratedState1862, type State1862 } from './state.js'
import { DirectorShares } from './charters.js'
import { CharteredParPrices, Market1862, marketSpaceIdAt } from './stockMarket.js'
import { StockRules1862, certificateLimit1862 } from './stockRules.js'
import { systemAction, titleAction } from './titleAction.js'
import type { CharterAuction, ParliamentRound } from './titleState.js'

/** Bids are made in multiples of £5 (§4.1). */
export const BidStep = 5
/** Three times the lowest par: what a bidder must keep for the director's certificate (§4.1). */
export const DirectorReserve = DirectorShares * Math.min(...CharteredParPrices)
/** At most two shares beyond the director's certificate as a charter is obtained (§4.2). */
export const ExtraCharterShares = 2

function requireRound(state: State1862): ParliamentRound {
    const round = state.parliament
    assertExists(round, 'A Parliament Round is in progress')
    return round
}

const player = (playerId: string) => ({ kind: 'player' as const, playerId })

function belowCertificateLimit(state: HydratedState1862, playerId: string): boolean {
    return (
        stockCertificateCount(state, player(playerId), StockRules1862) < certificateLimit1862(state)
    )
}

/** Companies Parliament may charter: available, unstarted, with room for a home (§3.2, §4.1). */
export function charterableCompanies(state: HydratedState1862): string[] {
    return state.companies.filter((company) => canStart(state, company.id)).map((c) => c.id)
}

/** Whether a player may bid this much: cash for it and three lowest-par shares, under the limit. */
export function canBid(state: HydratedState1862, playerId: string, bid: number): boolean {
    return (
        bid >= 0 &&
        bid % BidStep === 0 &&
        finiteCashOwnedBy(state, player(playerId)) >= DirectorReserve + bid &&
        belowCertificateLimit(state, playerId)
    )
}

/** Whether the player may open an auction this round (§4.1). */
export function canOpen(state: HydratedState1862, playerId: string): boolean {
    return (
        !requireRound(state).winnerIds.includes(playerId) &&
        charterableCompanies(state).length > 0 &&
        canBid(state, playerId, 0)
    )
}

/** The smallest raise of the current auction. */
export function minimumRaise(round: ParliamentRound): number | undefined {
    return round.auction ? round.auction.bid + BidStep : undefined
}

type Decision =
    | { kind: 'charter'; playerId: string; companyId: string; bid: number }
    | { kind: 'bid'; playerId: string; companyId: string; bid: number }
    | { kind: 'open'; playerId: string }

/** Who acts next in the Parliament Round, and on what; none once every player declined. */
export function parliamentDecision(state: State1862): Decision | undefined {
    const round = state.parliament
    if (!round) return undefined
    if (round.charter) return { kind: 'charter', ...round.charter }
    if (round.auction) {
        const playerId = nextBidder(state, round.auction)
        assertExists(playerId, 'An open auction has a bidder to act')
        return { kind: 'bid', playerId, companyId: round.auction.companyId, bid: round.auction.bid }
    }
    if (round.declinedIds.length >= state.turnManager.turnOrder.length) return undefined
    return { kind: 'open', playerId: opener(state, round) }
}

function decisionFor<Kind extends Decision['kind']>(
    state: State1862,
    kind: Kind,
    playerId: string
): Extract<Decision, { kind: Kind }> | undefined {
    const decision = parliamentDecision(state)
    return decision && isDecision(decision, kind) && decision.playerId === playerId
        ? decision
        : undefined
}

function isDecision<Kind extends Decision['kind']>(
    decision: Decision,
    kind: Kind
): decision is Extract<Decision, { kind: Kind }> {
    return decision.kind === kind
}

function nextPlayer(state: State1862, playerId: string): string {
    const order = state.turnManager.turnOrder
    return order[(order.indexOf(playerId) + 1) % order.length]
}

/**
 * Who opens next: the priority holder first, then the player after the last to decline, or after
 * the last winner (§4.1).
 */
function opener(state: State1862, round: ParliamentRound): string {
    const lastId = round.declinedIds.at(-1) ?? round.winnerIds.at(-1)
    if (lastId) return nextPlayer(state, lastId)
    const [priorityId] = state.turnManager.turnOrder
    assertExists(priorityId, 'A player holds priority')
    return priorityId
}

/** The next player after the high bidder in seat order who has not passed, if any (§4.1). */
function nextBidder(state: State1862, auction: CharterAuction): string | undefined {
    return turnOrderFrom(state.turnManager.turnOrder, auction.playerId).find(
        (playerId) => playerId !== auction.playerId && !auction.passedIds.includes(playerId)
    )
}

/** Closes the auction once every other player has passed (§4.1). */
function settleAuction(state: State1862, round: ParliamentRound): void {
    const auction = round.auction
    if (!auction || nextBidder(state, auction)) return
    round.charter = { companyId: auction.companyId, playerId: auction.playerId, bid: auction.bid }
    delete round.auction
}

const Id = Type.String({ minLength: 1 })
const Bid = Type.Integer({ minimum: 0, multipleOf: BidStep })

const OpenAction = titleAction('OpenCharterAuction', { companyId: Id, bid: Bid })
export const OpenCharterAuction = OpenAction.schema
export const isOpenCharterAuction = OpenAction.is
/** A player opens an auction for a company's charter with a first bid (§4.1). */
export class HydratedOpenCharterAuction extends OpenAction.Base {
    declare playerId: string
    declare companyId: Type.Static<typeof OpenCharterAuction>['companyId']
    declare bid: Type.Static<typeof OpenCharterAuction>['bid']
    isValid(state: HydratedState1862): boolean {
        return (
            this.source === ActionSource.User &&
            !!decisionFor(state, 'open', this.playerId) &&
            canOpen(state, this.playerId) &&
            canBid(state, this.playerId, this.bid) &&
            charterableCompanies(state).includes(this.companyId)
        )
    }
    apply(state: HydratedState1862): void {
        assert(this.isValid(state), 'The opener may open an auction for an available charter')
        const round = requireRound(state)
        round.declinedIds = []
        round.auction = {
            companyId: this.companyId,
            playerId: this.playerId,
            bid: this.bid,
            passedIds: []
        }
        settleAuction(state, round)
    }
}

const DeclineAction = titleAction('DeclineCharter', {})
export const DeclineCharter = DeclineAction.schema
export const isDeclineCharter = DeclineAction.is
/** The opener declines to open an auction; a player who cannot is declined for (§4.1). */
export class HydratedDeclineCharter extends DeclineAction.Base {
    declare playerId: string
    isValid(state: HydratedState1862): boolean {
        return (
            !!decisionFor(state, 'open', this.playerId) &&
            (this.source === ActionSource.User || !canOpen(state, this.playerId))
        )
    }
    apply(state: HydratedState1862): void {
        assert(this.isValid(state), 'Only the opener declines')
        const round = requireRound(state)
        round.declinedIds.push(this.playerId)
    }
}

const RaiseAction = titleAction('RaiseCharterBid', { bid: Bid })
export const RaiseCharterBid = RaiseAction.schema
export const isRaiseCharterBid = RaiseAction.is
/** The next bidder raises the bid by a multiple of £5 (§4.1). */
export class HydratedRaiseCharterBid extends RaiseAction.Base {
    declare playerId: string
    declare bid: Type.Static<typeof RaiseCharterBid>['bid']
    isValid(state: HydratedState1862): boolean {
        const round = state.parliament
        return (
            this.source === ActionSource.User &&
            !!round &&
            !!decisionFor(state, 'bid', this.playerId) &&
            this.bid >= (minimumRaise(round) ?? 0) &&
            canBid(state, this.playerId, this.bid)
        )
    }
    apply(state: HydratedState1862): void {
        assert(this.isValid(state), 'The next bidder raises the bid')
        const auction = requireRound(state).auction
        assertExists(auction, 'A raise needs an auction')
        auction.bid = this.bid
        auction.playerId = this.playerId
    }
}

const PassAction = titleAction('PassCharterBid', {})
export const PassCharterBid = PassAction.schema
export const isPassCharterBid = PassAction.is
/** The next bidder leaves the auction; one who cannot raise is passed for (§4.1). */
export class HydratedPassCharterBid extends PassAction.Base {
    declare playerId: string
    isValid(state: HydratedState1862): boolean {
        const round = state.parliament
        return (
            !!round &&
            !!decisionFor(state, 'bid', this.playerId) &&
            (this.source === ActionSource.User ||
                !canBid(state, this.playerId, minimumRaise(round) ?? 0))
        )
    }
    apply(state: HydratedState1862): void {
        assert(this.isValid(state), 'Only the next bidder passes')
        const round = requireRound(state)
        const auction = round.auction
        assertExists(auction, 'A pass needs an auction')
        auction.passedIds.push(this.playerId)
        settleAuction(state, round)
    }
}

/** The par prices the winner can afford with the director's certificate after the bid. */
export function charterPars(state: HydratedState1862, playerId: string, bid: number): number[] {
    const cash = finiteCashOwnedBy(state, player(playerId)) - bid
    return CharteredParPrices.filter((par) => par * DirectorShares <= cash)
}

/** The extra shares, up to two, the winner can afford and hold at this par. */
export function charterShareChoices(
    state: HydratedState1862,
    playerId: string,
    bid: number,
    par: number
): number[] {
    const cash = finiteCashOwnedBy(state, player(playerId)) - bid - par * DirectorShares
    const room =
        certificateLimit1862(state) -
        1 -
        stockCertificateCount(state, player(playerId), StockRules1862)
    return Array.from({ length: ExtraCharterShares + 1 }, (_, extra) => extra).filter(
        (extra) => extra * par <= cash && extra <= Math.max(0, room)
    )
}

const ObtainAction = titleAction('ObtainCharter', {
    companyId: Id,
    parPrice: Type.Integer({ minimum: 1 }),
    extraShares: Type.Integer({ minimum: 0, maximum: ExtraCharterShares }),
    metadata: Type.Optional(
        Type.Object(
            { bid: Type.Integer({ minimum: 0 }), certificateIds: Type.Array(Type.String()) },
            { additionalProperties: false }
        )
    )
})
export const ObtainCharter = ObtainAction.schema
export const isObtainCharter = ObtainAction.is
/**
 * The winner pays the bid, sets par on the chartered spaces, and buys the director's certificate
 * and up to two shares at par, all paid to the bank (§4.2). A charter not yet floated is an
 * obligation (§4.3).
 */
export class HydratedObtainCharter extends ObtainAction.Base {
    declare playerId: string
    declare companyId: Type.Static<typeof ObtainCharter>['companyId']
    declare parPrice: Type.Static<typeof ObtainCharter>['parPrice']
    declare extraShares: Type.Static<typeof ObtainCharter>['extraShares']
    declare metadata?: Type.Static<typeof ObtainCharter>['metadata']
    isValid(state: HydratedState1862): boolean {
        const decision = decisionFor(state, 'charter', this.playerId)
        return (
            this.source === ActionSource.User &&
            decision?.companyId === this.companyId &&
            charterPars(state, this.playerId, decision.bid).includes(this.parPrice) &&
            charterShareChoices(state, this.playerId, decision.bid, this.parPrice).includes(
                this.extraShares
            )
        )
    }
    apply(state: HydratedState1862): void {
        assert(this.isValid(state), 'The winner charters the company at an affordable par')
        const round = requireRound(state)
        const charter = round.charter
        assertExists(charter, 'A charter has been won')
        const buyer = player(this.playerId)
        const ipo = state.certificates.filter(
            (certificate) =>
                certificate.kind === 'share' &&
                certificate.companyId === this.companyId &&
                certificate.poolId === IpoPoolId
        )
        const director = ipo.find(
            (certificate) => certificate.kind === 'share' && certificate.president
        )
        assertExists(director, 'The director’s certificate is in the IPO')
        const bought = [
            director,
            ...ipo.filter((certificate) => certificate !== director).slice(0, this.extraShares)
        ]
        const shares = DirectorShares + this.extraShares
        const payments: CashPayment[] = [
            ...(charter.bid
                ? [{ from: buyer, to: { kind: 'bank' as const }, amount: charter.bid }]
                : []),
            { from: buyer, to: { kind: 'bank' }, amount: this.parPrice * shares }
        ]
        settleCashPayments(state, payments)
        state.chartered = [...state.chartered.filter((id) => id !== this.companyId), this.companyId]
        startCompanyAtPar(state, Market1862, this.companyId, marketSpaceIdAt(this.parPrice), buyer)
        for (const certificate of bought) {
            certificate.owner = buyer
            delete certificate.poolId
        }
        state.obligations.push({
            companyId: this.companyId,
            playerId: this.playerId,
            stockRound: round.stockRound
        })
        // A winner may win again by bidding in another's auction (§4.1).
        round.winnerIds = [...round.winnerIds.filter((id) => id !== this.playerId), this.playerId]
        round.declinedIds = []
        delete round.charter
        this.metadata = { bid: charter.bid, certificateIds: bought.map((c) => c.id) }
    }
}

const StartAction = systemAction('StartParliamentRound', {})
export const StartParliamentRound = StartAction.schema
export const isStartParliamentRound = StartAction.is
/** After each set of operating rounds, before the stock round, Parliament sits (§3). */
export class HydratedStartParliamentRound extends StartAction.Base {
    apply(state: HydratedState1862): void {
        assert(
            this.source === ActionSource.System && parliamentDue(state),
            'Parliament sits once a set'
        )
        const set = state.operatingSet
        assertExists(set, 'Parliament follows a set of operating rounds')
        state.parliamentSet = set.number
        state.parliament = {
            number: set.number + 2,
            stockRound: state.stockRound.number + 1,
            declinedIds: [],
            winnerIds: []
        }
        state.activePlayerIds = []
    }
}

const EndAction = systemAction('EndParliamentRound', {})
export const EndParliamentRound = EndAction.schema
export const isEndParliamentRound = EndAction.is
/**
 * Ends the round once every player declined in succession. The game's first round is followed by
 * a second; the second by the first stock round (§3). Priority does not move (§4.1).
 */
export class HydratedEndParliamentRound extends EndAction.Base {
    apply(state: HydratedState1862): void {
        const round = requireRound(state)
        assert(
            this.source === ActionSource.System && !parliamentDecision(state),
            'The round ends once every player has declined'
        )
        if (!state.operatingSet && round.number === 1) {
            state.parliament = {
                number: 2,
                stockRound: round.stockRound,
                declinedIds: [],
                winnerIds: []
            }
            return
        }
        delete state.parliament
        // Companies reset at the last stock round's end may start again in the next (§4.3).
        delete state.resetCompanyIds
        if (state.operatingSet) {
            state.turnManager.endTurn(state.actionCount)
            state.activePlayerIds = []
        } else {
            const [priorityId] = state.turnManager.turnOrder
            startFirstStockRound(state, [...state.turnManager.turnOrder])
            state.activePlayerIds = [priorityId]
        }
    }
}

/** Parliament sits before each stock round, until the LNER forms (§3, §10.3). */
export function parliamentDue(state: HydratedState1862): boolean {
    return (
        !state.lner &&
        !state.lnerDue &&
        !state.parliament &&
        canStartStockRound(state) &&
        state.parliamentSet !== state.operatingSet?.number
    )
}

type Context = MachineContext<HydratedState1862>

const DecisionActions: Readonly<Record<Decision['kind'], readonly string[]>> = {
    open: [OpenAction.type, DeclineAction.type],
    bid: [RaiseAction.type, PassAction.type],
    charter: [ObtainAction.type]
}

/** The auctions of a Parliament Round, until every player in turn declines to open one. */
export class ParliamentHandler implements EighteenXXStateHandler<HydratedState1862> {
    isValidAction(action: HydratedAction, context: Context): boolean {
        const state = context.gameState
        if (isFloatCompany(action))
            return (
                action.source === ActionSource.System &&
                nextCompanyToFloat(state, CompanyRules1862)?.companyId === action.companyId
            )
        if (nextCompanyToFloat(state, CompanyRules1862)) return false
        if (action instanceof HydratedEndParliamentRound)
            return action.source === ActionSource.System && !parliamentDecision(state)
        return (
            (action instanceof HydratedOpenCharterAuction ||
                action instanceof HydratedDeclineCharter ||
                action instanceof HydratedRaiseCharterBid ||
                action instanceof HydratedPassCharterBid ||
                action instanceof HydratedObtainCharter) &&
            action.isValid(state)
        )
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        const state = context.gameState
        if (nextCompanyToFloat(state, CompanyRules1862)) return []
        const decision = parliamentDecision(state)
        if (decision?.playerId !== playerId) return []
        if (decision.kind === 'open' && !canOpen(state, playerId)) return []
        if (decision.kind === 'bid' && !canBid(state, playerId, decision.bid + BidStep)) return []
        return [...DecisionActions[decision.kind]]
    }
    enter(context: Context): void {
        const state = context.gameState
        const floating = nextCompanyToFloat(state, CompanyRules1862)
        if (floating) {
            context.addSystemAction(FloatCompany, { companyId: floating.companyId })
            return
        }
        const decision = parliamentDecision(state)
        if (!decision) {
            state.activePlayerIds = []
            context.addSystemAction(EndParliamentRound, {})
            return
        }
        state.activePlayerIds = [decision.playerId]
        startTurnOf(state, decision.playerId)
        if (decision.kind === 'open' && !canOpen(state, decision.playerId))
            context.addSystemAction(DeclineCharter, { playerId: decision.playerId })
        else if (
            decision.kind === 'bid' &&
            !canBid(state, decision.playerId, decision.bid + BidStep)
        )
            context.addSystemAction(PassCharterBid, { playerId: decision.playerId })
    }
    onAction(action: HydratedAction, context: Context): string {
        const state = context.gameState
        if (!(action instanceof HydratedEndParliamentRound)) return ParliamentState
        if (state.parliament) return ParliamentState
        return state.operatingSet ? 'OperatingSet' : 'StockRound'
    }
}

/** Each opener, bidder and winner acts in a turn of their own. */
function startTurnOf(state: HydratedState1862, playerId: string): void {
    const turn = state.turnManager.currentTurn()
    if (turn?.playerId === playerId) return
    if (turn) state.turnManager.endTurn(state.actionCount)
    state.turnManager.startTurn(playerId, state.actionCount + 1)
}

/** Holds a Parliament Round, when one is due, before the stock round follows the set. */
export function holdsParliament(
    handler: EighteenXXStateHandler<HydratedState1862>
): EighteenXXStateHandler<HydratedState1862> {
    return new SystemActionFirstHandler(
        handler,
        StartParliamentRound,
        (state) => (parliamentDue(state) ? {} : undefined),
        ParliamentState
    )
}

export const ParliamentActions = [
    OpenAction.define((action) => new HydratedOpenCharterAuction(action)),
    DeclineAction.define((action) => new HydratedDeclineCharter(action)),
    RaiseAction.define((action) => new HydratedRaiseCharterBid(action)),
    PassAction.define((action) => new HydratedPassCharterBid(action)),
    ObtainAction.define((action) => new HydratedObtainCharter(action)),
    StartAction.define((action) => new HydratedStartParliamentRound(action)),
    EndAction.define((action) => new HydratedEndParliamentRound(action))
]
