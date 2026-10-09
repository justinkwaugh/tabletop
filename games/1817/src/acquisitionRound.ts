import type {
    HydratedEighteenSeventeenState,
    EighteenSeventeenStateHandler,
    EighteenSeventeenState
} from './state.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    PlayerAction,
    assert,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext
} from '@tabletop/common'
import {
    CashPayment,
    DeparturePayments,
    departurePaymentsField,
    LoanRecord,
    PassableBidding,
    StockMarketMove,
    canTakeLoan,
    isTakeLoan,
    type OperatingState,
    SystemActionFirstHandler
} from '@tabletop/18xx'
import {
    acquisitionRoundCompanyIds,
    bidRejection,
    biddingOrder,
    buyersFor,
    enteredClosingZone,
    hasBidder,
    saleKind,
    withdrawUnableBidders
} from './acquisitionRules.js'
import {
    AcquisitionRecord,
    Settlement,
    acquireCompany,
    canRepayAcquiredLoan,
    holdAside,
    liquidateByBank,
    parachuteOnLiquidation,
    repayAcquiredLoan,
    moveBuyerForUnpaidLoans,
    settleHolders
} from './acquisitionSettlement.js'
import { EighteenSeventeenLoanRules } from './loanRules.js'
import { inClosingZone } from './marketZones.js'
import { presidentOf, removableStations, trainsOverLimit } from './mergerRules.js'
import {
    dropCompany,
    activeAcquisitionRound,
    acquisitionRoundOf,
    mergerRoundOf,
    setAcquisitionRound,
    type Acquisition,
    type AcquisitionRound,
    ClosingZone,
    type CompanySale,
    type SaleKind
} from './state.js'

type State = HydratedGameState & EighteenSeventeenState
type Context = MachineContext<HydratedEighteenSeventeenState>

function requireRound(state: EighteenSeventeenState): AcquisitionRound {
    const round = activeAcquisitionRound(state)
    assertExists(round, 'An acquisition round is in progress')
    return round
}

function requireSale(state: EighteenSeventeenState): CompanySale {
    const sale = requireRound(state).sale
    assertExists(sale, 'A company is being sold')
    return sale
}

function requireAcquisition(state: EighteenSeventeenState): Acquisition {
    const acquisition = requireRound(state).acquisition
    assertExists(acquisition, 'A company has been bought')
    return acquisition
}

export function acquisitionRoundCompanyId(state: EighteenSeventeenState): string | undefined {
    const round = activeAcquisitionRound(state)
    return round?.sale?.companyId ?? round?.acquisition?.sale.companyId ?? round?.companyIds[0]
}

export function stateAfterAcquisition(state: EighteenSeventeenState): string {
    const acquisition = requireRound(state).acquisition
    if (!acquisition) return 'AcquisitionRound'
    if (removableStations(state, acquisition.buyerId).length) return 'ReducingStations'
    if (trainsOverLimit(state, acquisition.buyerId)) return 'DiscardingMergedTrains'
    return 'AcquisitionLoans'
}

function stateAfterSettling(state: EighteenSeventeenState): string {
    return state.cashCrisis ? 'RaisingCash' : 'AcquisitionRound'
}

export function acquisitionRoundDue(
    state: OperatingState & Pick<EighteenSeventeenState, 'mergerRound' | 'acquisitionRound'>
): boolean {
    const set = state.operatingSet
    const merger = mergerRoundOf(state)
    const latest = acquisitionRoundOf(state)
    return (
        !!set &&
        !set.completed &&
        !!merger?.completed &&
        merger.set === set.number &&
        merger.round === set.roundNumber &&
        !(latest?.set === set.number && latest.round === set.roundNumber)
    )
}

export function acquisitionRoundPending(
    state: OperatingState & Pick<EighteenSeventeenState, 'mergerRound' | 'acquisitionRound'>
): boolean {
    const set = state.operatingSet
    const latest = acquisitionRoundOf(state)
    return (
        !!set &&
        !(latest?.set === set.number && latest.round === set.roundNumber && latest.completed)
    )
}

const SkipReason = Type.Union([Type.Literal('entered-zone'), Type.Literal('no-bidder')])
type SkipReason = Type.Static<typeof SkipReason>

function skipReason(state: EighteenSeventeenState, companyId: string): SkipReason | undefined {
    const merger = mergerRoundOf(state)
    assertExists(merger, 'An acquisition round follows a merger round')
    if (enteredClosingZone(state, merger, companyId)) return 'entered-zone'
    const kind = saleKind(state, companyId)
    if (kind === 'offered' && !hasBidder(state, { companyId, kind })) return 'no-bidder'
    return undefined
}

function nextCompanyId(state: EighteenSeventeenState): string | undefined {
    const round = requireRound(state)
    return round.sale || round.acquisition ? undefined : round.companyIds[0]
}

function openSale(state: EighteenSeventeenState, companyId: string, kind: SaleKind): CompanySale {
    const round = requireRound(state)
    dropCompany(round, companyId)
    const heldAside = kind === 'liquidation' ? holdAside(state, companyId) : undefined
    const sale: CompanySale = {
        companyId,
        kind,
        bidding: PassableBidding.openWithoutBid(
            `acquisition:${round.set}.${round.round}:${companyId}`,
            biddingOrder(state, companyId)
        ),
        ...(heldAside ? { heldAside } : {})
    }
    round.sale = withdrawUnableBidders(state, sale)
    return round.sale
}

const StartFields = Type.Object({
    type: Type.Literal('StartAcquisitionRound'),
    metadata: Type.Optional(
        Type.Object({ companyIds: Type.Array(Type.String()) }, { additionalProperties: false })
    )
})
export const StartAcquisitionRound: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof StartFields.properties
> = Type.Object(
    { ...GameAction.properties, ...StartFields.properties },
    { additionalProperties: false }
)
export type StartAcquisitionRound = Type.Static<typeof StartAcquisitionRound>
const StartValidator = Compile(StartAcquisitionRound)
export function isStartAcquisitionRound(action: GameAction): action is StartAcquisitionRound {
    return (
        action instanceof HydratedStartAcquisitionRound ||
        (action.type === 'StartAcquisitionRound' && StartValidator.Check(action))
    )
}
export class HydratedStartAcquisitionRound
    extends HydratableAction<typeof StartAcquisitionRound>
    implements StartAcquisitionRound
{
    declare type: 'StartAcquisitionRound'
    declare metadata?: StartAcquisitionRound['metadata']
    constructor(data: StartAcquisitionRound) {
        super(
            data instanceof HydratedStartAcquisitionRound ? data.dehydrate() : data,
            StartValidator
        )
    }
    apply(state: State): void {
        assert(
            this.source === ActionSource.System && acquisitionRoundDue(state),
            'An acquisition round follows each merger round'
        )
        const set = state.operatingSet
        assertExists(set, 'An acquisition round follows an operating round')
        const companyIds = acquisitionRoundCompanyIds(state)
        setAcquisitionRound(state, {
            set: set.number,
            round: set.roundNumber,
            companyIds,
            completed: false
        })
        state.activePlayerIds = []
        this.metadata = { companyIds }
    }
}

export function startsAcquisitionRounds(
    handler: EighteenSeventeenStateHandler
): EighteenSeventeenStateHandler {
    return new SystemActionFirstHandler(
        handler,
        StartAcquisitionRound,
        (state) => (acquisitionRoundDue(state) ? {} : undefined),
        'AcquisitionRound'
    )
}

const EndFields = Type.Object({ type: Type.Literal('EndAcquisitionRound') })
export const EndAcquisitionRound: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof EndFields.properties
> = Type.Object(
    { ...GameAction.properties, ...EndFields.properties },
    { additionalProperties: false }
)
export type EndAcquisitionRound = Type.Static<typeof EndAcquisitionRound>
const EndValidator = Compile(EndAcquisitionRound)
export function isEndAcquisitionRound(action: GameAction): action is EndAcquisitionRound {
    return (
        action instanceof HydratedEndAcquisitionRound ||
        (action.type === 'EndAcquisitionRound' && EndValidator.Check(action))
    )
}
export class HydratedEndAcquisitionRound
    extends HydratableAction<typeof EndAcquisitionRound>
    implements EndAcquisitionRound
{
    declare type: 'EndAcquisitionRound'
    constructor(data: EndAcquisitionRound) {
        super(data instanceof HydratedEndAcquisitionRound ? data.dehydrate() : data, EndValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        const round = requireRound(state)
        return (
            this.source === ActionSource.System &&
            !round.companyIds.length &&
            !round.sale &&
            !round.acquisition
        )
    }
    apply(state: State): void {
        assert(this.isValidFor(state), 'The acquisition round ends once its companies are done')
        requireRound(state).completed = true
        state.activePlayerIds = []
    }
}

const CompanyFields = { ...PlayerAction.properties, companyId: Type.String() }

const SkipFields = Type.Object({
    type: Type.Literal('SkipCompanySale'),
    companyId: Type.String(),
    reason: SkipReason
})
export const SkipCompanySale: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof SkipFields.properties
> = Type.Object(
    { ...GameAction.properties, ...SkipFields.properties },
    { additionalProperties: false }
)
export type SkipCompanySale = Type.Static<typeof SkipCompanySale>
const SkipValidator = Compile(SkipCompanySale)
export function isSkipCompanySale(action: GameAction): action is SkipCompanySale {
    return (
        action instanceof HydratedSkipCompanySale ||
        (action.type === 'SkipCompanySale' && SkipValidator.Check(action))
    )
}
export class HydratedSkipCompanySale
    extends HydratableAction<typeof SkipCompanySale>
    implements SkipCompanySale
{
    declare type: 'SkipCompanySale'
    declare companyId: string
    declare reason: SkipReason
    constructor(data: SkipCompanySale) {
        super(data instanceof HydratedSkipCompanySale ? data.dehydrate() : data, SkipValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        return (
            this.source === ActionSource.System &&
            nextCompanyId(state) === this.companyId &&
            skipReason(state, this.companyId) === this.reason
        )
    }
    apply(state: State): void {
        assert(this.isValidFor(state), 'Only a company that cannot be sold now is skipped')
        const round = requireRound(state)
        dropCompany(round, this.companyId)
    }
}

const SaleOpening = Type.Object({ kind: ClosingZone }, { additionalProperties: false })
const OpenFields = Type.Object({
    type: Type.Literal('OpenCompanySale'),
    companyId: Type.String(),
    metadata: Type.Optional(SaleOpening)
})
export const OpenCompanySale: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof OpenFields.properties
> = Type.Object(
    { ...GameAction.properties, ...OpenFields.properties },
    { additionalProperties: false }
)
export type OpenCompanySale = Type.Static<typeof OpenCompanySale>
const OpenValidator = Compile(OpenCompanySale)
export function isOpenCompanySale(action: GameAction): action is OpenCompanySale {
    return (
        action instanceof HydratedOpenCompanySale ||
        (action.type === 'OpenCompanySale' && OpenValidator.Check(action))
    )
}
export class HydratedOpenCompanySale
    extends HydratableAction<typeof OpenCompanySale>
    implements OpenCompanySale
{
    declare type: 'OpenCompanySale'
    declare companyId: string
    declare metadata?: OpenCompanySale['metadata']
    constructor(data: OpenCompanySale) {
        super(data instanceof HydratedOpenCompanySale ? data.dehydrate() : data, OpenValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        return (
            this.source === ActionSource.System &&
            nextCompanyId(state) === this.companyId &&
            !skipReason(state, this.companyId) &&
            saleKind(state, this.companyId) !== 'offered'
        )
    }
    apply(state: State): void {
        assert(this.isValidFor(state), 'A company in a closing zone is auctioned in its turn')
        const kind = saleKind(state, this.companyId)
        assert(kind !== 'offered', 'Only a company in a closing zone is auctioned without offer')
        openSale(state, this.companyId, kind)
        this.metadata = { kind }
    }
}

export const OfferCompany = Type.Object(
    { ...CompanyFields, type: Type.Literal('OfferCompany') },
    { additionalProperties: false }
)
export type OfferCompany = Type.Static<typeof OfferCompany>
const OfferValidator = Compile(OfferCompany)
export function isOfferCompany(action: GameAction): action is OfferCompany {
    return (
        action instanceof HydratedOfferCompany ||
        (action.type === 'OfferCompany' && OfferValidator.Check(action))
    )
}

function offersFor(state: EighteenSeventeenState, playerId: string, companyId: string): boolean {
    return (
        nextCompanyId(state) === companyId &&
        saleKind(state, companyId) === 'offered' &&
        !skipReason(state, companyId) &&
        presidentOf(state, companyId) === playerId
    )
}

export class HydratedOfferCompany
    extends HydratableAction<typeof OfferCompany>
    implements OfferCompany
{
    declare type: 'OfferCompany'
    declare playerId: string
    declare companyId: string
    constructor(data: OfferCompany) {
        super(data instanceof HydratedOfferCompany ? data.dehydrate() : data, OfferValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        return offersFor(state, this.playerId, this.companyId)
    }
    apply(state: State): void {
        assert(
            this.source === ActionSource.User && this.isValidFor(state),
            'Only a company’s president may put it up for sale'
        )
        openSale(state, this.companyId, 'offered')
    }
}

export const DeclineOffer = Type.Object(
    { ...CompanyFields, type: Type.Literal('DeclineOffer') },
    { additionalProperties: false }
)
export type DeclineOffer = Type.Static<typeof DeclineOffer>
const DeclineValidator = Compile(DeclineOffer)
export function isDeclineOffer(action: GameAction): action is DeclineOffer {
    return (
        action instanceof HydratedDeclineOffer ||
        (action.type === 'DeclineOffer' && DeclineValidator.Check(action))
    )
}
export class HydratedDeclineOffer
    extends HydratableAction<typeof DeclineOffer>
    implements DeclineOffer
{
    declare type: 'DeclineOffer'
    declare playerId: string
    declare companyId: string
    constructor(data: DeclineOffer) {
        super(data instanceof HydratedDeclineOffer ? data.dehydrate() : data, DeclineValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        return offersFor(state, this.playerId, this.companyId)
    }
    apply(state: State): void {
        assert(
            this.source === ActionSource.User && this.isValidFor(state),
            'Only a company’s president may keep it off the market'
        )
        const round = requireRound(state)
        dropCompany(round, this.companyId)
    }
}

/** Each company in turn is auctioned or offered by its president, until all are done. */
export class AcquisitionRoundHandler implements EighteenSeventeenStateHandler {
    isValidAction(action: HydratedAction, context: Context): boolean {
        if (
            action instanceof HydratedEndAcquisitionRound ||
            action instanceof HydratedSkipCompanySale ||
            action instanceof HydratedOpenCompanySale ||
            action instanceof HydratedOfferCompany ||
            action instanceof HydratedDeclineOffer
        )
            return action.isValidFor(context.gameState)
        return false
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        const state = context.gameState
        const companyId = nextCompanyId(state)
        return companyId && offersFor(state, playerId, companyId)
            ? ['OfferCompany', 'DeclineOffer']
            : []
    }
    enter(context: Context): void {
        const state = context.gameState
        const companyId = nextCompanyId(state)
        if (!companyId) {
            context.addSystemAction(EndAcquisitionRound, {})
            return
        }
        const reason = skipReason(state, companyId)
        if (reason) context.addSystemAction(SkipCompanySale, { companyId, reason })
        else if (saleKind(state, companyId) !== 'offered')
            context.addSystemAction(OpenCompanySale, { companyId })
        else state.activePlayerIds = [presidentOf(state, companyId)]
    }
    onAction(action: HydratedAction, _context: Context): string {
        if (isEndAcquisitionRound(action)) return 'OperatingSet'
        return isOfferCompany(action) || isOpenCompanySale(action)
            ? 'AcquisitionBidding'
            : 'AcquisitionRound'
    }
}

export const BidToAcquire = Type.Object(
    {
        ...CompanyFields,
        type: Type.Literal('BidToAcquire'),
        amount: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type BidToAcquire = Type.Static<typeof BidToAcquire>
const BidValidator = Compile(BidToAcquire)
export function isBidToAcquire(action: GameAction): action is BidToAcquire {
    return (
        action instanceof HydratedBidToAcquire ||
        (action.type === 'BidToAcquire' && BidValidator.Check(action))
    )
}
export class HydratedBidToAcquire
    extends HydratableAction<typeof BidToAcquire>
    implements BidToAcquire
{
    declare type: 'BidToAcquire'
    declare playerId: string
    declare companyId: string
    declare amount: number
    constructor(data: BidToAcquire) {
        super(data instanceof HydratedBidToAcquire ? data.dehydrate() : data, BidValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        const sale = requireRound(state).sale
        return (
            sale?.companyId === this.companyId &&
            !bidRejection(state, sale, this.playerId, this.amount)
        )
    }
    apply(state: State): void {
        const sale = requireSale(state)
        const reason = bidRejection(state, sale, this.playerId, this.amount)
        assert(this.source === ActionSource.User && this.isValidFor(state), reason ?? 'Invalid bid')
        requireRound(state).sale = withdrawUnableBidders(state, {
            ...sale,
            bidding: new PassableBidding(sale.bidding).bid(this.playerId, this.amount)
        })
    }
}

export const PassOnCompany = Type.Object(
    { ...CompanyFields, type: Type.Literal('PassOnCompany') },
    { additionalProperties: false }
)
export type PassOnCompany = Type.Static<typeof PassOnCompany>
const PassValidator = Compile(PassOnCompany)
export function isPassOnCompany(action: GameAction): action is PassOnCompany {
    return (
        action instanceof HydratedPassOnCompany ||
        (action.type === 'PassOnCompany' && PassValidator.Check(action))
    )
}
export class HydratedPassOnCompany
    extends HydratableAction<typeof PassOnCompany>
    implements PassOnCompany
{
    declare type: 'PassOnCompany'
    declare playerId: string
    declare companyId: string
    constructor(data: PassOnCompany) {
        super(data instanceof HydratedPassOnCompany ? data.dehydrate() : data, PassValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        const sale = requireRound(state).sale
        return (
            sale?.companyId === this.companyId &&
            new PassableBidding(sale.bidding).currentBidderId === this.playerId
        )
    }
    apply(state: State): void {
        assert(
            this.source === ActionSource.User && this.isValidFor(state),
            'Only the player whose bid it is may pass'
        )
        const sale = requireSale(state)
        requireRound(state).sale = withdrawUnableBidders(state, {
            ...sale,
            bidding: new PassableBidding(sale.bidding).pass(this.playerId)
        })
    }
}

const CloseFields = Type.Object({
    type: Type.Literal('CloseCompanySale'),
    companyId: Type.String(),
    metadata: Type.Optional(
        Type.Object(
            {
                trainIds: Type.Array(Type.String()),
                settlement: Settlement,
                parachute: Type.Optional(CashPayment),
                departurePayments: DeparturePayments
            },
            { additionalProperties: false }
        )
    )
})
export const CloseCompanySale: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof CloseFields.properties
> = Type.Object(
    { ...GameAction.properties, ...CloseFields.properties },
    { additionalProperties: false }
)
export type CloseCompanySale = Type.Static<typeof CloseCompanySale>
const CloseValidator = Compile(CloseCompanySale)
export function isCloseCompanySale(action: GameAction): action is CloseCompanySale {
    return (
        action instanceof HydratedCloseCompanySale ||
        (action.type === 'CloseCompanySale' && CloseValidator.Check(action))
    )
}
export class HydratedCloseCompanySale
    extends HydratableAction<typeof CloseCompanySale>
    implements CloseCompanySale
{
    declare type: 'CloseCompanySale'
    declare companyId: string
    declare metadata?: CloseCompanySale['metadata']
    constructor(data: CloseCompanySale) {
        super(data instanceof HydratedCloseCompanySale ? data.dehydrate() : data, CloseValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        const sale = requireRound(state).sale
        return (
            this.source === ActionSource.System &&
            sale?.companyId === this.companyId &&
            new PassableBidding(sale.bidding).unsold
        )
    }
    apply(state: State): void {
        assert(this.isValidFor(state), 'A sale closes once every bidder has passed')
        const sale = requireSale(state)
        delete requireRound(state).sale
        if (sale.kind !== 'liquidation') return
        const parachute = parachuteOnLiquidation(state, sale.companyId)
        const { trainIds, payments } = liquidateByBank(state, sale.companyId)
        this.metadata = {
            trainIds,
            ...departurePaymentsField(payments),
            settlement: settleHolders(state, sale.companyId, 0, sale.heldAside),
            ...(parachute ? { parachute } : {})
        }
    }
}

/** Players bid in turn or pass for good; a sale nobody bids on closes. */
export class AcquisitionBiddingHandler implements EighteenSeventeenStateHandler {
    isValidAction(action: HydratedAction, context: Context): boolean {
        if (
            action instanceof HydratedBidToAcquire ||
            action instanceof HydratedPassOnCompany ||
            action instanceof HydratedCloseCompanySale
        )
            return action.isValidFor(context.gameState)
        return false
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        const sale = requireRound(context.gameState).sale
        return sale && new PassableBidding(sale.bidding).currentBidderId === playerId
            ? ['BidToAcquire', 'PassOnCompany']
            : []
    }
    enter(context: Context): void {
        const state = context.gameState
        const sale = requireSale(state)
        const bidding = new PassableBidding(sale.bidding)
        if (bidding.unsold) {
            context.addSystemAction(CloseCompanySale, { companyId: sale.companyId })
            return
        }
        const playerId = bidding.currentBidderId
        assertExists(playerId, 'A player is bidding')
        state.activePlayerIds = [playerId]
    }
    onAction(action: HydratedAction, context: Context): string {
        if (isCloseCompanySale(action)) return stateAfterSettling(context.gameState)
        const sale = requireSale(context.gameState)
        return new PassableBidding(sale.bidding).winner ? 'ChoosingAcquirer' : 'AcquisitionBidding'
    }
}

export const AcquireCompany = Type.Object(
    {
        ...CompanyFields,
        type: Type.Literal('AcquireCompany'),
        buyerId: Type.String(),
        metadata: Type.Optional(AcquisitionRecord)
    },
    { additionalProperties: false }
)
export type AcquireCompany = Type.Static<typeof AcquireCompany>
const AcquireValidator = Compile(AcquireCompany)
export function isAcquireCompany(action: GameAction): action is AcquireCompany {
    return (
        action instanceof HydratedAcquireCompany ||
        (action.type === 'AcquireCompany' && AcquireValidator.Check(action))
    )
}

export function acquirerChoice(
    state: EighteenSeventeenState
): { playerId: string; amount: number; buyerIds: string[] } | undefined {
    const sale = activeAcquisitionRound(state)?.sale
    const winner = sale && new PassableBidding(sale.bidding).winner
    if (!sale || !winner) return undefined
    return { ...winner, buyerIds: buyersFor(state, winner.playerId, sale, winner.amount) }
}

export class HydratedAcquireCompany
    extends HydratableAction<typeof AcquireCompany>
    implements AcquireCompany
{
    declare type: 'AcquireCompany'
    declare playerId: string
    declare companyId: string
    declare buyerId: string
    declare metadata?: AcquisitionRecord
    constructor(data: AcquireCompany) {
        super(data instanceof HydratedAcquireCompany ? data.dehydrate() : data, AcquireValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        const choice = acquirerChoice(state)
        return (
            requireRound(state).sale?.companyId === this.companyId &&
            choice?.playerId === this.playerId &&
            choice.buyerIds.includes(this.buyerId) &&
            (this.source === ActionSource.User || choice.buyerIds.length === 1)
        )
    }
    apply(state: State): void {
        assert(this.isValidFor(state), 'The winning bidder names one of their companies to pay')
        const sale = requireSale(state)
        const choice = acquirerChoice(state)
        assertExists(choice, 'A company was bid for')
        const record = acquireCompany(state, sale, this.buyerId, choice.amount)
        const round = requireRound(state)
        delete round.sale
        const { bidding: _bidding, ...terms } = sale
        round.acquisition = {
            sale: terms,
            buyerId: this.buyerId,
            price: choice.amount,
            inheritedLoans: record.assets.loans,
            repaidLoans: record.repayments.length
        }
        this.metadata = record
    }
}

/** The winning bidder names the company that pays, by itself when only one can. */
export class ChoosingAcquirerHandler implements EighteenSeventeenStateHandler {
    isValidAction(action: HydratedAction, context: Context): boolean {
        return action instanceof HydratedAcquireCompany
            ? action.isValidFor(context.gameState)
            : false
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        return acquirerChoice(context.gameState)?.playerId === playerId ? ['AcquireCompany'] : []
    }
    enter(context: Context): void {
        const state = context.gameState
        const choice = acquirerChoice(state)
        assertExists(choice, 'A company was bid for')
        state.activePlayerIds = [choice.playerId]
        const [buyerId] = choice.buyerIds
        if (choice.buyerIds.length === 1)
            context.addSystemAction(AcquireCompany, {
                playerId: choice.playerId,
                companyId: requireSale(state).companyId,
                buyerId
            })
    }
    onAction(_action: HydratedAction, context: Context): string {
        return stateAfterAcquisition(context.gameState)
    }
}

function buyerPresidentFor(
    state: EighteenSeventeenState,
    playerId: string
): Acquisition | undefined {
    const acquisition = requireRound(state).acquisition
    return acquisition && presidentOf(state, acquisition.buyerId) === playerId
        ? acquisition
        : undefined
}

function canBorrowAfterAcquisition(state: EighteenSeventeenState, playerId: string): boolean {
    const acquisition = buyerPresidentFor(state, playerId)
    return (
        !!acquisition &&
        !acquisition.repaidLoans &&
        canTakeLoan(state, EighteenSeventeenLoanRules, playerId, acquisition.buyerId)
    )
}

function canRepayAfterAcquisition(state: EighteenSeventeenState, playerId: string): boolean {
    const acquisition = buyerPresidentFor(state, playerId)
    return !!acquisition && canRepayAcquiredLoan(state, acquisition)
}

export const RepayAcquiredLoan = Type.Object(
    {
        ...CompanyFields,
        type: Type.Literal('RepayAcquiredLoan'),
        metadata: Type.Optional(LoanRecord)
    },
    { additionalProperties: false }
)
export type RepayAcquiredLoan = Type.Static<typeof RepayAcquiredLoan>
const RepayValidator = Compile(RepayAcquiredLoan)
export function isRepayAcquiredLoan(action: GameAction): action is RepayAcquiredLoan {
    return (
        action instanceof HydratedRepayAcquiredLoan ||
        (action.type === 'RepayAcquiredLoan' && RepayValidator.Check(action))
    )
}
export class HydratedRepayAcquiredLoan
    extends HydratableAction<typeof RepayAcquiredLoan>
    implements RepayAcquiredLoan
{
    declare type: 'RepayAcquiredLoan'
    declare playerId: string
    declare companyId: string
    declare metadata?: RepayAcquiredLoan['metadata']
    constructor(data: RepayAcquiredLoan) {
        super(data instanceof HydratedRepayAcquiredLoan ? data.dehydrate() : data, RepayValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        return (
            buyerPresidentFor(state, this.playerId)?.buyerId === this.companyId &&
            canRepayAfterAcquisition(state, this.playerId)
        )
    }
    apply(state: State): void {
        assert(
            this.source === ActionSource.User && this.isValidFor(state),
            'Only the buyer’s president repays the loans it took on'
        )
        this.metadata = repayAcquiredLoan(state, this.companyId)
        requireAcquisition(state).repaidLoans++
    }
}

export const FinishAcquisitionLoans = Type.Object(
    {
        ...CompanyFields,
        type: Type.Literal('FinishAcquisitionLoans'),
        metadata: Type.Optional(
            Type.Object(
                {
                    targetId: Type.String(),
                    marketMoves: Type.Array(StockMarketMove),
                    settlement: Settlement,
                    leftRound: Type.Boolean()
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type FinishAcquisitionLoans = Type.Static<typeof FinishAcquisitionLoans>
const FinishValidator = Compile(FinishAcquisitionLoans)
export function isFinishAcquisitionLoans(action: GameAction): action is FinishAcquisitionLoans {
    return (
        action instanceof HydratedFinishAcquisitionLoans ||
        (action.type === 'FinishAcquisitionLoans' && FinishValidator.Check(action))
    )
}
export class HydratedFinishAcquisitionLoans
    extends HydratableAction<typeof FinishAcquisitionLoans>
    implements FinishAcquisitionLoans
{
    declare type: 'FinishAcquisitionLoans'
    declare playerId: string
    declare companyId: string
    declare metadata?: FinishAcquisitionLoans['metadata']
    constructor(data: FinishAcquisitionLoans) {
        super(
            data instanceof HydratedFinishAcquisitionLoans ? data.dehydrate() : data,
            FinishValidator
        )
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        return (
            buyerPresidentFor(state, this.playerId)?.buyerId === this.companyId &&
            (this.source === ActionSource.User ||
                (!canBorrowAfterAcquisition(state, this.playerId) &&
                    !canRepayAfterAcquisition(state, this.playerId)))
        )
    }
    apply(state: State): void {
        assert(this.isValidFor(state), 'Only the buyer’s president finishes its loans')
        const acquisition = requireAcquisition(state)
        const round = requireRound(state)
        const marketMoves = moveBuyerForUnpaidLoans(state, acquisition)
        delete round.acquisition
        const settlement = settleHolders(
            state,
            acquisition.sale.companyId,
            acquisition.price,
            acquisition.sale.heldAside
        )
        const leftRound =
            round.companyIds.includes(acquisition.buyerId) &&
            inClosingZone(state.stockMarket, acquisition.buyerId)
        if (leftRound) dropCompany(round, acquisition.buyerId)
        this.metadata = {
            targetId: acquisition.sale.companyId,
            marketMoves,
            settlement,
            leftRound
        }
    }
}

/** The buyer may borrow or repay the loans it took on, then its holders are settled. */
export class AcquisitionLoansHandler implements EighteenSeventeenStateHandler {
    isValidAction(action: HydratedAction, context: Context): boolean {
        const state = context.gameState
        if (isTakeLoan(action))
            return (
                action.source === ActionSource.User &&
                buyerPresidentFor(state, action.playerId)?.buyerId === action.companyId &&
                canBorrowAfterAcquisition(state, action.playerId)
            )
        return action instanceof HydratedRepayAcquiredLoan ||
            action instanceof HydratedFinishAcquisitionLoans
            ? action.isValidFor(state)
            : false
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        const state = context.gameState
        if (!buyerPresidentFor(state, playerId)) return []
        return [
            ...(canBorrowAfterAcquisition(state, playerId) ? ['TakeLoan'] : []),
            ...(canRepayAfterAcquisition(state, playerId) ? ['RepayAcquiredLoan'] : []),
            'FinishAcquisitionLoans'
        ]
    }
    enter(context: Context): void {
        const state = context.gameState
        const { buyerId } = requireAcquisition(state)
        const playerId = presidentOf(state, buyerId)
        state.activePlayerIds = [playerId]
        if (
            !canBorrowAfterAcquisition(state, playerId) &&
            !canRepayAfterAcquisition(state, playerId)
        )
            context.addSystemAction(FinishAcquisitionLoans, { playerId, companyId: buyerId })
    }
    onAction(action: HydratedAction, context: Context): string {
        return isFinishAcquisitionLoans(action)
            ? stateAfterSettling(context.gameState)
            : 'AcquisitionLoans'
    }
}
