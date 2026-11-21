import {
    ActionSource,
    PassableBidding,
    assert,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext
} from '@tabletop/common'
import * as Type from 'typebox'
import type { ActionDefinition } from '../actions/actionDefinition.js'
import { systemEvent, titleAction, type SystemEventSchema } from '../actions/titleAction.js'
import { RoundEnd, roundEnd } from '../ending/roundEnd.js'
import type { ValuationRules } from '../ending/finalWealth.js'
import { CashPayment } from '../finance/cashPayments.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import { SystemActionFirstHandler } from '../game/systemActionFirstHandler.js'
import { LoanRecord } from '../loans/loans.js'
import { canTakeLoan, isTakeLoan } from '../loans/takeLoan.js'
import type { OperatingState } from '../operating/operatingSet.js'
import { StockMarketMove } from '../stock/stockMarket.js'
import { DeparturePayments, departurePaymentsField } from '../trains/trainDepartures.js'
import {
    actingCompanyAction,
    actingCompanyChoices,
    type ActingCompanyAction
} from './actingCompanyActions.js'
import { AcquisitionRecord, Settlement, type CompanySales } from './companySales.js'
import {
    ClosingZone,
    acquisitionRoundOf,
    activeAcquisitionRound,
    conversionRoundOf,
    dropCompany,
    type Acquisition,
    type AcquisitionRound,
    type CompanySale,
    type HydratedSizedCompanyState,
    type SaleKind,
    type SizedCompanyRecords,
    type SizedCompanyState
} from './sizedCompanyState.js'

type State = SizedCompanyState

/** A title's acquisition round, which follows each merger round. */
export interface AcquisitionRoundRules<S extends HydratedSizedCompanyState> {
    sales: CompanySales
    valuationRules: ValuationRules
    /** The title's own actions a buying company may take while it settles its loans. */
    companyActions?: readonly ActingCompanyAction<S>[]
}

const CompanyFields = { companyId: Type.String() }

const SkipReason = Type.Union([Type.Literal('entered-zone'), Type.Literal('no-bidder')])
type SkipReason = Type.Static<typeof SkipReason>

const StartAcquisitionRoundFields = {
    metadata: Type.Optional(
        Type.Object({ companyIds: Type.Array(Type.String()) }, { additionalProperties: false })
    )
}
const StartAcquisitionRoundAction = systemEvent(
    'StartAcquisitionRound',
    StartAcquisitionRoundFields
)
export const StartAcquisitionRound: SystemEventSchema<
    'StartAcquisitionRound',
    typeof StartAcquisitionRoundFields
> = StartAcquisitionRoundAction.schema
export type StartAcquisitionRound = Type.Static<typeof StartAcquisitionRound>
export const isStartAcquisitionRound = StartAcquisitionRoundAction.is

const EndAcquisitionRoundFields = {
    metadata: Type.Optional(Type.Object({ roundEnd: RoundEnd }, { additionalProperties: false }))
}
const EndAcquisitionRoundAction = systemEvent('EndAcquisitionRound', EndAcquisitionRoundFields)
export const EndAcquisitionRound: SystemEventSchema<
    'EndAcquisitionRound',
    typeof EndAcquisitionRoundFields
> = EndAcquisitionRoundAction.schema
export type EndAcquisitionRound = Type.Static<typeof EndAcquisitionRound>
export const isEndAcquisitionRound = EndAcquisitionRoundAction.is

const SkipCompanySaleFields = {
    companyId: Type.String(),
    reason: SkipReason
}
const SkipCompanySaleAction = systemEvent('SkipCompanySale', SkipCompanySaleFields)
export const SkipCompanySale: SystemEventSchema<'SkipCompanySale', typeof SkipCompanySaleFields> =
    SkipCompanySaleAction.schema
export type SkipCompanySale = Type.Static<typeof SkipCompanySale>
export const isSkipCompanySale = SkipCompanySaleAction.is

const OpenCompanySaleFields = {
    companyId: Type.String(),
    metadata: Type.Optional(Type.Object({ kind: ClosingZone }, { additionalProperties: false }))
}
const OpenCompanySaleAction = systemEvent('OpenCompanySale', OpenCompanySaleFields)
export const OpenCompanySale: SystemEventSchema<'OpenCompanySale', typeof OpenCompanySaleFields> =
    OpenCompanySaleAction.schema
export type OpenCompanySale = Type.Static<typeof OpenCompanySale>
export const isOpenCompanySale = OpenCompanySaleAction.is

const OfferCompanyAction = titleAction('OfferCompany', CompanyFields)
export const OfferCompany = OfferCompanyAction.schema
export type OfferCompany = Type.Static<typeof OfferCompany>
export const isOfferCompany = OfferCompanyAction.is

const DeclineOfferAction = titleAction('DeclineOffer', CompanyFields)
export const DeclineOffer = DeclineOfferAction.schema
export type DeclineOffer = Type.Static<typeof DeclineOffer>
export const isDeclineOffer = DeclineOfferAction.is

const BidToAcquireAction = titleAction('BidToAcquire', {
    ...CompanyFields,
    amount: Type.Integer({ minimum: 1 })
})
export const BidToAcquire = BidToAcquireAction.schema
export type BidToAcquire = Type.Static<typeof BidToAcquire>
export const isBidToAcquire = BidToAcquireAction.is

const PassOnCompanyAction = titleAction('PassOnCompany', CompanyFields)
export const PassOnCompany = PassOnCompanyAction.schema
export type PassOnCompany = Type.Static<typeof PassOnCompany>
export const isPassOnCompany = PassOnCompanyAction.is

const CloseCompanySaleFields = {
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
}
const CloseCompanySaleAction = systemEvent('CloseCompanySale', CloseCompanySaleFields)
export const CloseCompanySale: SystemEventSchema<
    'CloseCompanySale',
    typeof CloseCompanySaleFields
> = CloseCompanySaleAction.schema
export type CloseCompanySale = Type.Static<typeof CloseCompanySale>
export const isCloseCompanySale = CloseCompanySaleAction.is

const AcquireCompanyAction = titleAction('AcquireCompany', {
    ...CompanyFields,
    buyerId: Type.String(),
    metadata: Type.Optional(AcquisitionRecord)
})
export const AcquireCompany = AcquireCompanyAction.schema
export type AcquireCompany = Type.Static<typeof AcquireCompany>
export const isAcquireCompany = AcquireCompanyAction.is

const RepayAcquiredLoanAction = titleAction('RepayAcquiredLoan', {
    ...CompanyFields,
    metadata: Type.Optional(LoanRecord)
})
export const RepayAcquiredLoan = RepayAcquiredLoanAction.schema
export type RepayAcquiredLoan = Type.Static<typeof RepayAcquiredLoan>
export const isRepayAcquiredLoan = RepayAcquiredLoanAction.is

const FinishAcquisitionLoansAction = titleAction('FinishAcquisitionLoans', {
    ...CompanyFields,
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
})
export const FinishAcquisitionLoans = FinishAcquisitionLoansAction.schema
export type FinishAcquisitionLoans = Type.Static<typeof FinishAcquisitionLoans>
export const isFinishAcquisitionLoans = FinishAcquisitionLoansAction.is

/**
 * Whether the operating round's acquisition round is still to finish, which holds the game's end
 * until the final set's rounds are done.
 */
export function acquisitionRoundPending(
    state: OperatingState & Pick<SizedCompanyRecords, 'acquisitionRound'>
): boolean {
    const set = state.operatingSet
    const latest = acquisitionRoundOf(state)
    return (
        !!set &&
        !(latest?.set === set.number && latest.round === set.roundNumber && latest.completed)
    )
}

type CompanyAction = { playerId: string; companyId: string }
type Sourced = { source: ActionSource }

/**
 * The acquisition round of the 1817 family: lowest price first, companies in the liquidation
 * and acquisition zones are auctioned and the rest may be offered by their presidents; the
 * winning bidder names the buying company, which settles its loans before the sold company's
 * holders are paid and its charter resets.
 */
export class AcquisitionRounds<S extends HydratedSizedCompanyState = HydratedSizedCompanyState> {
    constructor(readonly rules: AcquisitionRoundRules<S>) {}

    get sales(): CompanySales {
        return this.rules.sales
    }

    private get companyActions(): readonly ActingCompanyAction<S>[] {
        return this.rules.companyActions ?? []
    }

    private requireRound(state: State): AcquisitionRound {
        const round = activeAcquisitionRound(state)
        assertExists(round, 'An acquisition round is in progress')
        return round
    }

    private requireSale(state: State): CompanySale {
        const sale = this.requireRound(state).sale
        assertExists(sale, 'A company is being sold')
        return sale
    }

    private requireAcquisition(state: State): Acquisition {
        const acquisition = this.requireRound(state).acquisition
        assertExists(acquisition, 'A company has been bought')
        return acquisition
    }

    private presidentId(state: State, companyId: string): string {
        return this.sales.rules.conversions.presidentId(state, companyId)
    }

    /** The company the round is busy with: the one being sold or settled, or the next. */
    companyId(state: State): string | undefined {
        const round = activeAcquisitionRound(state)
        return round?.sale?.companyId ?? round?.acquisition?.sale.companyId ?? round?.companyIds[0]
    }

    stateAfterAcquisition(state: State): string {
        const { conversions } = this.sales.rules
        const acquisition = this.requireRound(state).acquisition
        if (!acquisition) return 'AcquisitionRound'
        if (conversions.rules.stations.removableStations(state, acquisition.buyerId).length)
            return 'ReducingStations'
        if (conversions.trainsOverLimit(state, acquisition.buyerId)) return 'DiscardingMergedTrains'
        return 'AcquisitionLoans'
    }

    private stateAfterSettling(state: State): string {
        return state.cashCrisis ? 'RaisingCash' : 'AcquisitionRound'
    }

    /** An acquisition round follows each merger round. */
    due(state: OperatingState & SizedCompanyRecords): boolean {
        const set = state.operatingSet
        const merger = conversionRoundOf(state)
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

    private skipReason(state: State, companyId: string): SkipReason | undefined {
        const merger = conversionRoundOf(state)
        assertExists(merger, 'An acquisition round follows a merger round')
        if (this.sales.enteredClosingZone(state, merger, companyId)) return 'entered-zone'
        const kind = this.sales.saleKind(state, companyId)
        if (kind === 'offered' && !this.sales.hasBidder(state, { companyId, kind }))
            return 'no-bidder'
        return undefined
    }

    private nextCompanyId(state: State): string | undefined {
        const round = this.requireRound(state)
        return round.sale || round.acquisition ? undefined : round.companyIds[0]
    }

    private openSale(state: State, companyId: string, kind: SaleKind): CompanySale {
        const round = this.requireRound(state)
        dropCompany(round, companyId)
        const heldAside =
            kind === 'liquidation' ? this.sales.holdAside(state, companyId) : undefined
        const sale: CompanySale = {
            companyId,
            kind,
            bidding: PassableBidding.openWithoutBid(
                `acquisition:${round.set}.${round.round}:${companyId}`,
                this.sales.biddingOrder(state, companyId)
            ),
            ...(heldAside ? { heldAside } : {})
        }
        round.sale = this.sales.withdrawUnableBidders(state, sale)
        return round.sale
    }

    private endValid(state: State, action: Sourced): boolean {
        const round = this.requireRound(state)
        return (
            action.source === ActionSource.System &&
            !round.companyIds.length &&
            !round.sale &&
            !round.acquisition
        )
    }

    private skipValid(state: State, action: Sourced & { companyId: string; reason: SkipReason }) {
        return (
            action.source === ActionSource.System &&
            this.nextCompanyId(state) === action.companyId &&
            this.skipReason(state, action.companyId) === action.reason
        )
    }

    private openValid(state: State, action: Sourced & { companyId: string }): boolean {
        return (
            action.source === ActionSource.System &&
            this.nextCompanyId(state) === action.companyId &&
            !this.skipReason(state, action.companyId) &&
            this.sales.saleKind(state, action.companyId) !== 'offered'
        )
    }

    private offersFor(state: State, playerId: string, companyId: string): boolean {
        return (
            this.nextCompanyId(state) === companyId &&
            this.sales.saleKind(state, companyId) === 'offered' &&
            !this.skipReason(state, companyId) &&
            this.presidentId(state, companyId) === playerId
        )
    }

    private bidValid(state: State, action: CompanyAction & { amount: number }): boolean {
        const sale = this.requireRound(state).sale
        return (
            sale?.companyId === action.companyId &&
            !this.sales.bidRejection(state, sale, action.playerId, action.amount)
        )
    }

    private passValid(state: State, action: CompanyAction): boolean {
        const sale = this.requireRound(state).sale
        return (
            sale?.companyId === action.companyId &&
            new PassableBidding(sale.bidding).currentBidderId === action.playerId
        )
    }

    private closeValid(state: State, action: Sourced & { companyId: string }): boolean {
        const sale = this.requireRound(state).sale
        return (
            action.source === ActionSource.System &&
            sale?.companyId === action.companyId &&
            new PassableBidding(sale.bidding).unsold
        )
    }

    /** The winning bidder and the companies of theirs that could pay. */
    acquirerChoice(
        state: State
    ): { playerId: string; amount: number; buyerIds: string[] } | undefined {
        const sale = activeAcquisitionRound(state)?.sale
        const winner = sale && new PassableBidding(sale.bidding).winner
        if (!sale || !winner) return undefined
        return {
            ...winner,
            buyerIds: this.sales.buyersFor(state, winner.playerId, sale, winner.amount)
        }
    }

    private acquireValid(
        state: State,
        action: Sourced & CompanyAction & { buyerId: string }
    ): boolean {
        const choice = this.acquirerChoice(state)
        return (
            this.requireRound(state).sale?.companyId === action.companyId &&
            choice?.playerId === action.playerId &&
            choice.buyerIds.includes(action.buyerId) &&
            (action.source === ActionSource.User || choice.buyerIds.length === 1)
        )
    }

    private buyerPresidentFor(state: State, playerId: string): Acquisition | undefined {
        const acquisition = this.requireRound(state).acquisition
        return acquisition && this.presidentId(state, acquisition.buyerId) === playerId
            ? acquisition
            : undefined
    }

    private canBorrowAfterAcquisition(state: State, playerId: string): boolean {
        const acquisition = this.buyerPresidentFor(state, playerId)
        return (
            !!acquisition &&
            !acquisition.repaidLoans &&
            canTakeLoan(state, this.sales.rules.loanRules, playerId, acquisition.buyerId)
        )
    }

    private canRepayAfterAcquisition(state: State, playerId: string): boolean {
        const acquisition = this.buyerPresidentFor(state, playerId)
        return !!acquisition && this.sales.canRepayAcquiredLoan(state, acquisition)
    }

    private repayValid(state: State, action: CompanyAction): boolean {
        return (
            this.buyerPresidentFor(state, action.playerId)?.buyerId === action.companyId &&
            this.canRepayAfterAcquisition(state, action.playerId)
        )
    }

    private buyerChoices(state: S, playerId: string): string[] {
        const acquisition = this.buyerPresidentFor(state, playerId)
        return acquisition
            ? actingCompanyChoices(this.companyActions, state, playerId, acquisition.buyerId)
            : []
    }

    private finishValid(state: S, action: Sourced & CompanyAction): boolean {
        return (
            this.buyerPresidentFor(state, action.playerId)?.buyerId === action.companyId &&
            (action.source === ActionSource.User ||
                (!this.canBorrowAfterAcquisition(state, action.playerId) &&
                    !this.canRepayAfterAcquisition(state, action.playerId) &&
                    !this.buyerChoices(state, action.playerId).length))
        )
    }

    actions(): ActionDefinition[] {
        return AcquisitionRounds.actionsOf(this)
    }

    private static actionsOf<S extends HydratedSizedCompanyState>(
        rounds: AcquisitionRounds<S>
    ): ActionDefinition[] {
        const { sales, valuationRules } = rounds.rules

        class HydratedStartAcquisitionRound
            extends StartAcquisitionRoundAction.Base
            implements StartAcquisitionRound
        {
            declare type: 'StartAcquisitionRound'
            declare metadata?: StartAcquisitionRound['metadata']
            apply(state: HydratedGameState & State): void {
                assert(
                    this.source === ActionSource.System && rounds.due(state),
                    'An acquisition round follows each merger round'
                )
                const set = state.operatingSet
                assertExists(set, 'An acquisition round follows an operating round')
                const companyIds = sales.roundCompanyIds(state)
                state.acquisitionRound = {
                    set: set.number,
                    round: set.roundNumber,
                    companyIds,
                    completed: false
                }
                state.activePlayerIds = []
                this.metadata = { companyIds }
            }
        }

        class HydratedEndAcquisitionRound
            extends EndAcquisitionRoundAction.Base
            implements EndAcquisitionRound
        {
            declare type: 'EndAcquisitionRound'
            declare metadata?: EndAcquisitionRound['metadata']
            apply(state: HydratedGameState & State): void {
                assert(
                    rounds.endValid(state, this),
                    'The acquisition round ends once its companies are done'
                )
                rounds.requireRound(state).completed = true
                state.activePlayerIds = []
                this.metadata = { roundEnd: roundEnd(state, valuationRules, 'title') }
            }
        }

        class HydratedSkipCompanySale
            extends SkipCompanySaleAction.Base
            implements SkipCompanySale
        {
            declare type: 'SkipCompanySale'
            declare companyId: string
            declare reason: SkipReason
            apply(state: HydratedGameState & State): void {
                assert(
                    rounds.skipValid(state, this),
                    'Only a company that cannot be sold now is skipped'
                )
                dropCompany(rounds.requireRound(state), this.companyId)
            }
        }

        class HydratedOpenCompanySale
            extends OpenCompanySaleAction.Base
            implements OpenCompanySale
        {
            declare type: 'OpenCompanySale'
            declare companyId: string
            declare metadata?: OpenCompanySale['metadata']
            apply(state: HydratedGameState & State): void {
                assert(
                    rounds.openValid(state, this),
                    'A company in a closing zone is auctioned in its turn'
                )
                const kind = sales.saleKind(state, this.companyId)
                assert(
                    kind !== 'offered',
                    'Only a company in a closing zone is auctioned without offer'
                )
                rounds.openSale(state, this.companyId, kind)
                this.metadata = { kind }
            }
        }

        class HydratedOfferCompany extends OfferCompanyAction.Base implements OfferCompany {
            declare type: 'OfferCompany'
            declare playerId: string
            declare companyId: string
            apply(state: HydratedGameState & State): void {
                assert(
                    this.source === ActionSource.User &&
                        rounds.offersFor(state, this.playerId, this.companyId),
                    'Only a company’s president may put it up for sale'
                )
                rounds.openSale(state, this.companyId, 'offered')
            }
        }

        class HydratedDeclineOffer extends DeclineOfferAction.Base implements DeclineOffer {
            declare type: 'DeclineOffer'
            declare playerId: string
            declare companyId: string
            apply(state: HydratedGameState & State): void {
                assert(
                    this.source === ActionSource.User &&
                        rounds.offersFor(state, this.playerId, this.companyId),
                    'Only a company’s president may keep it off the market'
                )
                dropCompany(rounds.requireRound(state), this.companyId)
            }
        }

        class HydratedBidToAcquire extends BidToAcquireAction.Base implements BidToAcquire {
            declare type: 'BidToAcquire'
            declare playerId: string
            declare companyId: string
            declare amount: number
            apply(state: HydratedGameState & State): void {
                const sale = rounds.requireSale(state)
                const reason = sales.bidRejection(state, sale, this.playerId, this.amount)
                assert(
                    this.source === ActionSource.User && rounds.bidValid(state, this),
                    reason ?? 'Invalid bid'
                )
                rounds.requireRound(state).sale = sales.withdrawUnableBidders(state, {
                    ...sale,
                    bidding: new PassableBidding(sale.bidding).bid(this.playerId, this.amount)
                })
            }
        }

        class HydratedPassOnCompany extends PassOnCompanyAction.Base implements PassOnCompany {
            declare type: 'PassOnCompany'
            declare playerId: string
            declare companyId: string
            apply(state: HydratedGameState & State): void {
                assert(
                    this.source === ActionSource.User && rounds.passValid(state, this),
                    'Only the player whose bid it is may pass'
                )
                const sale = rounds.requireSale(state)
                rounds.requireRound(state).sale = sales.withdrawUnableBidders(state, {
                    ...sale,
                    bidding: new PassableBidding(sale.bidding).pass(this.playerId)
                })
            }
        }

        class HydratedCloseCompanySale
            extends CloseCompanySaleAction.Base
            implements CloseCompanySale
        {
            declare type: 'CloseCompanySale'
            declare companyId: string
            declare metadata?: CloseCompanySale['metadata']
            apply(state: HydratedGameState & State): void {
                assert(rounds.closeValid(state, this), 'A sale closes once every bidder has passed')
                const sale = rounds.requireSale(state)
                delete rounds.requireRound(state).sale
                if (sale.kind !== 'liquidation') return
                const parachute = sales.payOnLiquidation(state, sale.companyId)
                const { trainIds, payments } = sales.liquidateByBank(state, sale.companyId)
                this.metadata = {
                    trainIds,
                    ...departurePaymentsField(payments),
                    settlement: sales.settleHolders(state, sale.companyId, 0, sale.heldAside),
                    ...(parachute ? { parachute } : {})
                }
            }
        }

        class HydratedAcquireCompany extends AcquireCompanyAction.Base implements AcquireCompany {
            declare type: 'AcquireCompany'
            declare playerId: string
            declare companyId: string
            declare buyerId: string
            declare metadata?: AcquisitionRecord
            apply(state: HydratedGameState & State): void {
                assert(
                    rounds.acquireValid(state, this),
                    'The winning bidder names one of their companies to pay'
                )
                const sale = rounds.requireSale(state)
                const choice = rounds.acquirerChoice(state)
                assertExists(choice, 'A company was bid for')
                const record = sales.acquireCompany(state, sale, this.buyerId, choice.amount)
                const round = rounds.requireRound(state)
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

        class HydratedRepayAcquiredLoan
            extends RepayAcquiredLoanAction.Base
            implements RepayAcquiredLoan
        {
            declare type: 'RepayAcquiredLoan'
            declare playerId: string
            declare companyId: string
            declare metadata?: RepayAcquiredLoan['metadata']
            apply(state: HydratedGameState & State): void {
                assert(
                    this.source === ActionSource.User && rounds.repayValid(state, this),
                    'Only the buyer’s president repays the loans it took on'
                )
                this.metadata = sales.repayAcquiredLoan(state, this.companyId)
                rounds.requireAcquisition(state).repaidLoans++
            }
        }

        class HydratedFinishAcquisitionLoans
            extends FinishAcquisitionLoansAction.Base
            implements FinishAcquisitionLoans
        {
            declare type: 'FinishAcquisitionLoans'
            declare playerId: string
            declare companyId: string
            declare metadata?: FinishAcquisitionLoans['metadata']
            apply(state: HydratedGameState & S): void {
                assert(
                    rounds.finishValid(state, this),
                    'Only the buyer’s president finishes its loans'
                )
                const acquisition = rounds.requireAcquisition(state)
                const round = rounds.requireRound(state)
                const marketMoves = sales.moveBuyerForUnpaidLoans(state, acquisition)
                delete round.acquisition
                const settlement = sales.settleHolders(
                    state,
                    acquisition.sale.companyId,
                    acquisition.price,
                    acquisition.sale.heldAside
                )
                const leftRound =
                    round.companyIds.includes(acquisition.buyerId) &&
                    sales.rules.market.inClosingZone(state.stockMarket, acquisition.buyerId)
                if (leftRound) dropCompany(round, acquisition.buyerId)
                this.metadata = {
                    targetId: acquisition.sale.companyId,
                    marketMoves,
                    settlement,
                    leftRound
                }
            }
        }

        return [
            StartAcquisitionRoundAction.define(
                (action) => new HydratedStartAcquisitionRound(action)
            ),
            EndAcquisitionRoundAction.define((action) => new HydratedEndAcquisitionRound(action)),
            SkipCompanySaleAction.define((action) => new HydratedSkipCompanySale(action)),
            OpenCompanySaleAction.define((action) => new HydratedOpenCompanySale(action)),
            OfferCompanyAction.define((action) => new HydratedOfferCompany(action)),
            DeclineOfferAction.define((action) => new HydratedDeclineOffer(action)),
            BidToAcquireAction.define((action) => new HydratedBidToAcquire(action)),
            PassOnCompanyAction.define((action) => new HydratedPassOnCompany(action)),
            CloseCompanySaleAction.define((action) => new HydratedCloseCompanySale(action)),
            AcquireCompanyAction.define((action) => new HydratedAcquireCompany(action)),
            RepayAcquiredLoanAction.define((action) => new HydratedRepayAcquiredLoan(action)),
            FinishAcquisitionLoansAction.define(
                (action) => new HydratedFinishAcquisitionLoans(action)
            )
        ]
    }

    /** Opens the acquisition round once the merger round is done. */
    starts(handler: EighteenXXStateHandler<S>): EighteenXXStateHandler<S> {
        return new SystemActionFirstHandler(
            handler,
            StartAcquisitionRound,
            (state) => (this.due(state) ? {} : undefined),
            'AcquisitionRound'
        )
    }

    /** The round's machine states, returning to `continuation` when the round ends. */
    stateHandlers(continuation: string): Record<string, EighteenXXStateHandler<S>> {
        return {
            AcquisitionRound: this.roundHandler(continuation),
            AcquisitionBidding: this.biddingHandler(),
            ChoosingAcquirer: this.acquirerHandler(),
            AcquisitionLoans: this.loansHandler()
        }
    }

    /** Each company in turn is auctioned or offered by its president, until all are done. */
    private roundHandler(continuation: string): EighteenXXStateHandler<S> {
        return {
            isValidAction: (action: HydratedAction, context: MachineContext<S>): boolean => {
                const state = context.gameState
                if (isEndAcquisitionRound(action)) return this.endValid(state, action)
                if (isSkipCompanySale(action)) return this.skipValid(state, action)
                if (isOpenCompanySale(action)) return this.openValid(state, action)
                if (isOfferCompany(action) || isDeclineOffer(action))
                    return this.offersFor(state, action.playerId, action.companyId)
                return false
            },
            validActionsForPlayer: (playerId: string, context: MachineContext<S>): string[] => {
                const state = context.gameState
                const companyId = this.nextCompanyId(state)
                return companyId && this.offersFor(state, playerId, companyId)
                    ? ['OfferCompany', 'DeclineOffer']
                    : []
            },
            enter: (context: MachineContext<S>): void => {
                const state = context.gameState
                const companyId = this.nextCompanyId(state)
                if (!companyId) {
                    context.addSystemAction(EndAcquisitionRound, {})
                    return
                }
                const reason = this.skipReason(state, companyId)
                if (reason) context.addSystemAction(SkipCompanySale, { companyId, reason })
                else if (this.sales.saleKind(state, companyId) !== 'offered')
                    context.addSystemAction(OpenCompanySale, { companyId })
                else state.activePlayerIds = [this.presidentId(state, companyId)]
            },
            onAction: (action: HydratedAction): string => {
                if (isEndAcquisitionRound(action)) return continuation
                return isOfferCompany(action) || isOpenCompanySale(action)
                    ? 'AcquisitionBidding'
                    : 'AcquisitionRound'
            }
        }
    }

    /** Players bid in turn or pass for good; a sale nobody bids on closes. */
    private biddingHandler(): EighteenXXStateHandler<S> {
        return {
            isValidAction: (action: HydratedAction, context: MachineContext<S>): boolean => {
                const state = context.gameState
                if (isBidToAcquire(action)) return this.bidValid(state, action)
                if (isPassOnCompany(action)) return this.passValid(state, action)
                if (isCloseCompanySale(action)) return this.closeValid(state, action)
                return false
            },
            validActionsForPlayer: (playerId: string, context: MachineContext<S>): string[] => {
                const sale = this.requireRound(context.gameState).sale
                return sale && new PassableBidding(sale.bidding).currentBidderId === playerId
                    ? ['BidToAcquire', 'PassOnCompany']
                    : []
            },
            enter: (context: MachineContext<S>): void => {
                const state = context.gameState
                const sale = this.requireSale(state)
                const bidding = new PassableBidding(sale.bidding)
                if (bidding.unsold) {
                    context.addSystemAction(CloseCompanySale, { companyId: sale.companyId })
                    return
                }
                const playerId = bidding.currentBidderId
                assertExists(playerId, 'A player is bidding')
                state.activePlayerIds = [playerId]
            },
            onAction: (action: HydratedAction, context: MachineContext<S>): string => {
                if (isCloseCompanySale(action)) return this.stateAfterSettling(context.gameState)
                const sale = this.requireSale(context.gameState)
                return new PassableBidding(sale.bidding).winner
                    ? 'ChoosingAcquirer'
                    : 'AcquisitionBidding'
            }
        }
    }

    /** The winning bidder names the company that pays, by itself when only one can. */
    private acquirerHandler(): EighteenXXStateHandler<S> {
        return {
            isValidAction: (action: HydratedAction, context: MachineContext<S>): boolean =>
                isAcquireCompany(action) && this.acquireValid(context.gameState, action),
            validActionsForPlayer: (playerId: string, context: MachineContext<S>): string[] =>
                this.acquirerChoice(context.gameState)?.playerId === playerId
                    ? ['AcquireCompany']
                    : [],
            enter: (context: MachineContext<S>): void => {
                const state = context.gameState
                const choice = this.acquirerChoice(state)
                assertExists(choice, 'A company was bid for')
                state.activePlayerIds = [choice.playerId]
                const [buyerId] = choice.buyerIds
                if (choice.buyerIds.length === 1)
                    context.addSystemAction(AcquireCompany, {
                        playerId: choice.playerId,
                        companyId: this.requireSale(state).companyId,
                        buyerId
                    })
            },
            onAction: (_action: HydratedAction, context: MachineContext<S>): string =>
                this.stateAfterAcquisition(context.gameState)
        }
    }

    /** The buyer may borrow or repay the loans it took on, then its holders are settled. */
    private loansHandler(): EighteenXXStateHandler<S> {
        return {
            isValidAction: (action: HydratedAction, context: MachineContext<S>): boolean => {
                const state = context.gameState
                if (isTakeLoan(action))
                    return (
                        action.source === ActionSource.User &&
                        this.buyerPresidentFor(state, action.playerId)?.buyerId ===
                            action.companyId &&
                        this.canBorrowAfterAcquisition(state, action.playerId)
                    )
                if (isRepayAcquiredLoan(action)) return this.repayValid(state, action)
                if (isFinishAcquisitionLoans(action)) return this.finishValid(state, action)
                const acquisition = action.playerId
                    ? this.buyerPresidentFor(state, action.playerId)
                    : undefined
                return (
                    !!acquisition &&
                    action.source === ActionSource.User &&
                    !!actingCompanyAction(this.companyActions, action, state, acquisition.buyerId)
                )
            },
            validActionsForPlayer: (playerId: string, context: MachineContext<S>): string[] => {
                const state = context.gameState
                if (!this.buyerPresidentFor(state, playerId)) return []
                return [
                    ...(this.canBorrowAfterAcquisition(state, playerId) ? ['TakeLoan'] : []),
                    ...(this.canRepayAfterAcquisition(state, playerId)
                        ? ['RepayAcquiredLoan']
                        : []),
                    'FinishAcquisitionLoans',
                    ...this.buyerChoices(state, playerId)
                ]
            },
            enter: (context: MachineContext<S>): void => {
                const state = context.gameState
                const { buyerId } = this.requireAcquisition(state)
                const playerId = this.presidentId(state, buyerId)
                state.activePlayerIds = [playerId]
                if (
                    !this.canBorrowAfterAcquisition(state, playerId) &&
                    !this.canRepayAfterAcquisition(state, playerId) &&
                    !this.buyerChoices(state, playerId).length
                )
                    context.addSystemAction(FinishAcquisitionLoans, {
                        playerId,
                        companyId: buyerId
                    })
            },
            onAction: (action: HydratedAction, context: MachineContext<S>): string =>
                isFinishAcquisitionLoans(action)
                    ? this.stateAfterSettling(context.gameState)
                    : 'AcquisitionLoans'
        }
    }
}
