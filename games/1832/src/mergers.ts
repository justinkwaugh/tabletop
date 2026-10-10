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
    type MachineContext
} from '@tabletop/common'
import {
    CashPayment,
    DeparturePayments,
    ShareSaleDetails,
    SystemActionFirstHandler,
    applyShareSale,
    discardTrainToMarket,
    finiteCashOwnedBy,
    settleCashPayments,
    trainsCountingForLimit
} from '@tabletop/18xx'
import { Absorption, absorbCompany, discardSharedHome } from './absorption.js'
import {
    hasMergerOptions,
    mergerOptions,
    mergersAllowed,
    presidentId,
    takeoverPayments,
    takeoverSales,
    takeoverShortfall,
    takeoverSides,
    type MergerOption
} from './mergerRules.js'
import type {
    EighteenThirtyTwoState,
    EighteenThirtyTwoStateHandler,
    HydratedEighteenThirtyTwoState
} from './state.js'
import { EighteenThirtyTwoStockRules } from './stockRules.js'
import { SystemFormation, formSystem } from './systems.js'
import { MergerKind, MergingState, type MergerProposal } from './titleState.js'
import { EighteenThirtyTwoPhases, EighteenThirtyTwoTrainRules } from './trains.js'

const Id = Type.String({ minLength: 1 })

type Decision =
    | { kind: 'discard'; playerId: string; companyId: string }
    | { kind: 'fund'; playerId: string }
    | { kind: 'answer'; playerId: string; proposal: MergerProposal }
    | { kind: 'propose'; playerId: string; index: number }

/** Who acts next in the merger phase, and on what. */
export function mergerDecision(state: EighteenThirtyTwoState): Decision | undefined {
    const phase = state.mergerPhase
    if (!phase) return undefined
    if (phase.discardCompanyId) {
        const playerId = presidentId(state, phase.discardCompanyId)
        assertExists(playerId, 'A company over its train limit has a president')
        return { kind: 'discard', playerId, companyId: phase.discardCompanyId }
    }
    if (phase.funding) return { kind: 'fund', playerId: phase.funding.playerId }
    if (phase.proposal) {
        const playerId = presidentId(state, phase.proposal.partnerId)
        assertExists(playerId, 'A proposed partner has a president')
        return { kind: 'answer', playerId, proposal: phase.proposal }
    }
    for (let index = phase.index; index < phase.playerIds.length; index++) {
        const playerId = phase.playerIds[index]
        if (hasMergerOptions(state, playerId)) return { kind: 'propose', playerId, index }
    }
    return undefined
}

export const MergerOutcome = Type.Object(
    {
        kind: MergerKind,
        /** The two companies: for a takeover, the buyer then the company bought. */
        companyIds: Type.Array(Id, { minItems: 2, maxItems: 2 }),
        survivorId: Id,
        system: Type.Optional(SystemFormation),
        payments: Type.Optional(Type.Array(CashPayment)),
        absorption: Type.Optional(Absorption),
        discardedHomeStationId: Type.Optional(Id)
    },
    { additionalProperties: false }
)
export type MergerOutcome = Type.Static<typeof MergerOutcome>

function overTrainLimit(state: EighteenThirtyTwoState, companyId: string) {
    return (
        trainsCountingForLimit(state, EighteenThirtyTwoTrainRules, companyId).length >
        EighteenThirtyTwoTrainRules.trainLimit(state, companyId)
    )
}

/**
 * The buyer pays for every outside share, its president making up what its treasury lacks as
 * they are paid for their own; it takes the bought company's assets and the bought company
 * closes (§11.7, §11.7.1).
 */
function completeTakeover(
    state: HydratedEighteenThirtyTwoState,
    buyerId: string,
    targetId: string,
    playerId: string
): MergerOutcome {
    assert(presidentId(state, buyerId) === playerId, 'The buyer’s president pays for a takeover')
    const buyer = { kind: 'company' as const, companyId: buyerId }
    const president = { kind: 'player' as const, playerId }
    const payments = takeoverPayments(state, buyerId, targetId)
    const ownPrice = payments
        .filter((payment) => payment.to.kind === 'player' && payment.to.playerId === playerId)
        .reduce((sum, payment) => sum + payment.amount, 0)
    const cost = payments.reduce((sum, payment) => sum + payment.amount, 0)
    const contribution = Math.max(0, cost - finiteCashOwnedBy(state, buyer))
    const net = contribution - ownPrice
    const settled: CashPayment[] = [
        ...(net > 0 ? [{ from: president, to: buyer, amount: net }] : []),
        ...payments.filter(
            (payment) => !(payment.to.kind === 'player' && payment.to.playerId === playerId)
        ),
        ...(net < 0 ? [{ from: buyer, to: president, amount: -net }] : [])
    ]
    settleCashPayments(state, settled)
    const discardedHomeStationId = discardSharedHome(state, buyerId, targetId)
    const absorption = absorbCompany(state, targetId, buyerId, 'takeover')
    state.mergers = [
        ...state.mergers,
        { kind: 'takeover', companyIds: [buyerId, targetId], survivorId: buyerId }
    ]
    const phase = state.mergerPhase
    assertExists(phase, 'A takeover happens in a merger phase')
    delete phase.funding
    if (overTrainLimit(state, buyerId)) phase.discardCompanyId = buyerId
    return {
        kind: 'takeover',
        companyIds: [buyerId, targetId],
        survivorId: buyerId,
        payments: settled,
        absorption,
        ...(discardedHomeStationId ? { discardedHomeStationId } : {})
    }
}

/** Carries out an agreed merger, or begins the buyer's president's sales for a takeover. */
function executeMerger(
    state: HydratedEighteenThirtyTwoState,
    proposal: MergerProposal
): MergerOutcome | undefined {
    const partnerPresident = presidentId(state, proposal.partnerId)
    assertExists(partnerPresident, 'A merger partner has a president')
    if (proposal.kind === 'system') {
        const initiator = proposal.yielded ? partnerPresident : proposal.proposerPlayerId
        const system = formSystem(state, [proposal.companyId, proposal.partnerId], initiator)
        state.mergers = [
            ...state.mergers,
            {
                kind: 'system',
                companyIds: [proposal.companyId, proposal.partnerId],
                survivorId: system.systemId
            }
        ]
        return {
            kind: 'system',
            companyIds: [proposal.companyId, proposal.partnerId],
            survivorId: system.systemId,
            system
        }
    }
    const { buyerId, targetId } = takeoverSides(proposal)
    const playerId = presidentId(state, buyerId)
    assertExists(playerId, 'A buying company has a president')
    if (takeoverShortfall(state, buyerId, targetId, playerId)) {
        const phase = state.mergerPhase
        assertExists(phase, 'A takeover happens in a merger phase')
        phase.funding = { buyerId, targetId, playerId }
        return undefined
    }
    return completeTakeover(state, buyerId, targetId, playerId)
}

function currentDecision<Kind extends Decision['kind']>(
    state: EighteenThirtyTwoState,
    kind: Kind,
    playerId: string
): Extract<Decision, { kind: Kind }> | undefined {
    const decision = mergerDecision(state)
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

const StartFields = Type.Object({
    type: Type.Literal('StartMergerPhase'),
    final: Type.Boolean(),
    metadata: Type.Optional(Type.Object({ held: Type.Boolean() }, { additionalProperties: false }))
})
export const StartMergerPhase: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof StartFields.properties
> = Type.Object(
    { ...GameAction.properties, ...StartFields.properties },
    { additionalProperties: false }
)
export type StartMergerPhase = Type.Static<typeof StartMergerPhase>
const StartValidator = Compile(StartMergerPhase)
export function isStartMergerPhase(action: GameAction): action is StartMergerPhase {
    return (
        action instanceof HydratedStartMergerPhase ||
        (action.type === 'StartMergerPhase' && StartValidator.Check(action))
    )
}

function phaseFor(state: EighteenThirtyTwoState, final: boolean) {
    return { final, playerIds: [...state.turnManager.turnOrder], index: 0, refused: [] }
}

function anyOptions(state: EighteenThirtyTwoState, final: boolean) {
    const probe = { ...state, mergerPhase: phaseFor(state, final) }
    return state.players.some((player) => hasMergerOptions(probe, player.playerId))
}

/** Whether a merger phase follows this stock round in phases 4 and 5 (§11.1). */
function stockMergerPhaseDue(state: EighteenThirtyTwoState): boolean {
    return (
        mergersAllowed(state) &&
        !state.mergerPhase &&
        !EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '6') &&
        state.mergedAfterStockRound !== state.stockRound.number &&
        anyOptions(state, false)
    )
}

/** Whether the last merger phase follows the first 6-train's buyer's turn (§11.1). */
function finalMergerPhaseDue(state: EighteenThirtyTwoState): boolean {
    return (
        mergersAllowed(state) &&
        !state.mergerPhase &&
        EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '6')
    )
}

function mergerPhaseDue(state: EighteenThirtyTwoState, final: boolean) {
    return final ? finalMergerPhaseDue(state) : stockMergerPhaseDue(state)
}

/** Opens the merger phase, or ends mergers when the last phase has nothing to merge. */
export class HydratedStartMergerPhase
    extends HydratableAction<typeof StartMergerPhase>
    implements StartMergerPhase
{
    declare type: 'StartMergerPhase'
    declare final: boolean
    declare metadata?: StartMergerPhase['metadata']
    constructor(data: StartMergerPhase) {
        super(data instanceof HydratedStartMergerPhase ? data.dehydrate() : data, StartValidator)
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(
            this.source === ActionSource.System && mergerPhaseDue(state, this.final),
            'A merger phase begins after a stock round in phases 4 and 5, or the first 6-train'
        )
        const held = !this.final || anyOptions(state, true)
        if (held) state.mergerPhase = phaseFor(state, this.final)
        else state.mergersEnded = true
        this.metadata = { held }
    }
}

const CompleteFields = Type.Object({
    type: Type.Literal('CompleteMergerPhase'),
    metadata: Type.Optional(Type.Object({ final: Type.Boolean() }, { additionalProperties: false }))
})
export const CompleteMergerPhase: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof CompleteFields.properties
> = Type.Object(
    { ...GameAction.properties, ...CompleteFields.properties },
    { additionalProperties: false }
)
export type CompleteMergerPhase = Type.Static<typeof CompleteMergerPhase>
const CompleteValidator = Compile(CompleteMergerPhase)
export function isCompleteMergerPhase(action: GameAction): action is CompleteMergerPhase {
    return (
        action instanceof HydratedCompleteMergerPhase ||
        (action.type === 'CompleteMergerPhase' && CompleteValidator.Check(action))
    )
}

export class HydratedCompleteMergerPhase
    extends HydratableAction<typeof CompleteMergerPhase>
    implements CompleteMergerPhase
{
    declare type: 'CompleteMergerPhase'
    declare metadata?: CompleteMergerPhase['metadata']
    constructor(data: CompleteMergerPhase) {
        super(
            data instanceof HydratedCompleteMergerPhase ? data.dehydrate() : data,
            CompleteValidator
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        const phase = state.mergerPhase
        assert(
            this.source === ActionSource.System && phase && !mergerDecision(state),
            'A merger phase ends once every player has passed'
        )
        if (phase.final) state.mergersEnded = true
        else state.mergedAfterStockRound = state.stockRound.number
        delete state.mergerPhase
        this.metadata = { final: phase.final }
    }
}

export const ProposeMerger = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('ProposeMerger'),
        companyId: Id,
        partnerId: Id,
        kind: MergerKind,
        yielded: Type.Boolean(),
        metadata: Type.Optional(
            Type.Object({ outcome: Type.Optional(MergerOutcome) }, { additionalProperties: false })
        )
    },
    { additionalProperties: false }
)
export type ProposeMerger = Type.Static<typeof ProposeMerger>
const ProposeValidator = Compile(ProposeMerger)
export function isProposeMerger(action: GameAction): action is ProposeMerger {
    return (
        action instanceof HydratedProposeMerger ||
        (action.type === 'ProposeMerger' && ProposeValidator.Check(action))
    )
}

/** A player proposes a merger; one between their own companies happens at once. */
export class HydratedProposeMerger
    extends HydratableAction<typeof ProposeMerger>
    implements ProposeMerger
{
    declare type: 'ProposeMerger'
    declare playerId: string
    declare companyId: string
    declare partnerId: string
    declare kind: MergerKind
    declare yielded: boolean
    declare metadata?: ProposeMerger['metadata']
    constructor(data: ProposeMerger) {
        super(data instanceof HydratedProposeMerger ? data.dehydrate() : data, ProposeValidator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return (
            this.source === ActionSource.User &&
            !!currentDecision(state, 'propose', this.playerId) &&
            mergerOptions(state, this.playerId).some((option) => this.matches(option))
        )
    }
    private matches(option: MergerOption): boolean {
        return (
            option.companyId === this.companyId &&
            option.partnerId === this.partnerId &&
            option.kind === this.kind &&
            option.yielded === this.yielded
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'This merger cannot be proposed')
        const phase = state.mergerPhase
        assertExists(phase, 'Mergers are proposed in a merger phase')
        const proposal: MergerProposal = {
            proposerPlayerId: this.playerId,
            companyId: this.companyId,
            partnerId: this.partnerId,
            kind: this.kind,
            yielded: this.yielded
        }
        if (presidentId(state, this.partnerId) !== this.playerId) {
            phase.proposal = proposal
            this.metadata = {}
            return
        }
        const outcome = executeMerger(state, proposal)
        this.metadata = outcome ? { outcome } : {}
    }
}

export const AnswerMerger = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('AnswerMerger'),
        accept: Type.Boolean(),
        metadata: Type.Optional(
            Type.Object(
                {
                    proposal: Type.Object(
                        {
                            proposerPlayerId: Id,
                            companyId: Id,
                            partnerId: Id,
                            kind: MergerKind,
                            yielded: Type.Boolean()
                        },
                        { additionalProperties: false }
                    ),
                    outcome: Type.Optional(MergerOutcome)
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type AnswerMerger = Type.Static<typeof AnswerMerger>
const AnswerValidator = Compile(AnswerMerger)
export function isAnswerMerger(action: GameAction): action is AnswerMerger {
    return (
        action instanceof HydratedAnswerMerger ||
        (action.type === 'AnswerMerger' && AnswerValidator.Check(action))
    )
}

/** The partner's president agrees to the proposed merger, or refuses it for this phase. */
export class HydratedAnswerMerger
    extends HydratableAction<typeof AnswerMerger>
    implements AnswerMerger
{
    declare type: 'AnswerMerger'
    declare playerId: string
    declare accept: boolean
    declare metadata?: AnswerMerger['metadata']
    constructor(data: AnswerMerger) {
        super(data instanceof HydratedAnswerMerger ? data.dehydrate() : data, AnswerValidator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return (
            this.source === ActionSource.User && !!currentDecision(state, 'answer', this.playerId)
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'Only the partner’s president answers a merger')
        const phase = state.mergerPhase
        assertExists(phase, 'Mergers are answered in a merger phase')
        const proposal = phase.proposal
        assertExists(proposal, 'An answer requires a proposal')
        delete phase.proposal
        if (!this.accept) {
            phase.refused.push({
                companyId: proposal.companyId,
                partnerId: proposal.partnerId,
                kind: proposal.kind,
                yielded: proposal.yielded
            })
            this.metadata = { proposal }
            return
        }
        const outcome = executeMerger(state, proposal)
        this.metadata = { proposal, ...(outcome ? { outcome } : {}) }
    }
}

export const PassMerger = Type.Object(
    { ...PlayerAction.properties, type: Type.Literal('PassMerger') },
    { additionalProperties: false }
)
export type PassMerger = Type.Static<typeof PassMerger>
const PassValidator = Compile(PassMerger)
export function isPassMerger(action: GameAction): action is PassMerger {
    return (
        action instanceof HydratedPassMerger ||
        (action.type === 'PassMerger' && PassValidator.Check(action))
    )
}

export class HydratedPassMerger extends HydratableAction<typeof PassMerger> implements PassMerger {
    declare type: 'PassMerger'
    declare playerId: string
    constructor(data: PassMerger) {
        super(data instanceof HydratedPassMerger ? data.dehydrate() : data, PassValidator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return (
            this.source === ActionSource.User && !!currentDecision(state, 'propose', this.playerId)
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        const decision = currentDecision(state, 'propose', this.playerId)
        assert(this.source === ActionSource.User && decision, 'Only the proposing player passes')
        const phase = state.mergerPhase
        assertExists(phase, 'Players pass in a merger phase')
        phase.index = decision.index + 1
    }
}

export const SellTakeoverShares = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('SellTakeoverShares'),
        companyId: Id,
        shares: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(ShareSaleDetails)
    },
    { additionalProperties: false }
)
export type SellTakeoverShares = Type.Static<typeof SellTakeoverShares>
const SellValidator = Compile(SellTakeoverShares)
export function isSellTakeoverShares(action: GameAction): action is SellTakeoverShares {
    return (
        action instanceof HydratedSellTakeoverShares ||
        (action.type === 'SellTakeoverShares' && SellValidator.Check(action))
    )
}

/** The buyer's president sells shares to raise the takeover's price (§11.7). */
export class HydratedSellTakeoverShares
    extends HydratableAction<typeof SellTakeoverShares>
    implements SellTakeoverShares
{
    declare type: 'SellTakeoverShares'
    declare playerId: string
    declare companyId: string
    declare shares: number
    declare metadata?: SellTakeoverShares['metadata']
    constructor(data: SellTakeoverShares) {
        super(data instanceof HydratedSellTakeoverShares ? data.dehydrate() : data, SellValidator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return (
            this.source === ActionSource.User &&
            !!currentDecision(state, 'fund', this.playerId) &&
            !!this.sale(state)
        )
    }
    private sale(state: EighteenThirtyTwoState) {
        const funding = state.mergerPhase?.funding
        if (!funding || funding.playerId !== this.playerId) return undefined
        return takeoverSales(state, funding).find(
            (sale) =>
                sale.sales[0].companyId === this.companyId && sale.sales[0].shares === this.shares
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'This sale cannot fund the takeover')
        const details = this.sale(state)
        assertExists(details, 'A valid takeover sale has its details')
        applyShareSale(state, details)
        EighteenThirtyTwoStockRules.afterSale?.(state, details)
        this.metadata = details
    }
}

const CompleteTakeoverFields = Type.Object({
    type: Type.Literal('CompleteTakeover'),
    metadata: Type.Optional(MergerOutcome)
})
export const CompleteTakeover: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof CompleteTakeoverFields.properties
> = Type.Object(
    { ...GameAction.properties, ...CompleteTakeoverFields.properties },
    { additionalProperties: false }
)
export type CompleteTakeover = Type.Static<typeof CompleteTakeover>
const CompleteTakeoverValidator = Compile(CompleteTakeover)
export function isCompleteTakeover(action: GameAction): action is CompleteTakeover {
    return (
        action instanceof HydratedCompleteTakeover ||
        (action.type === 'CompleteTakeover' && CompleteTakeoverValidator.Check(action))
    )
}

function fundingCovered(state: EighteenThirtyTwoState) {
    const funding = state.mergerPhase?.funding
    return (
        !!funding && !takeoverShortfall(state, funding.buyerId, funding.targetId, funding.playerId)
    )
}

/** Completes a takeover once its buyer's president has raised the price. */
export class HydratedCompleteTakeover
    extends HydratableAction<typeof CompleteTakeover>
    implements CompleteTakeover
{
    declare type: 'CompleteTakeover'
    declare metadata?: CompleteTakeover['metadata']
    constructor(data: CompleteTakeover) {
        super(
            data instanceof HydratedCompleteTakeover ? data.dehydrate() : data,
            CompleteTakeoverValidator
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        const funding = state.mergerPhase?.funding
        assert(
            this.source === ActionSource.System && funding && fundingCovered(state),
            'A takeover completes once its price is raised'
        )
        this.metadata = completeTakeover(state, funding.buyerId, funding.targetId, funding.playerId)
    }
}

export const DiscardMergedTrain = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('DiscardMergedTrain'),
        companyId: Id,
        trainId: Id,
        metadata: Type.Optional(
            Type.Object({ departurePayments: DeparturePayments }, { additionalProperties: false })
        )
    },
    { additionalProperties: false }
)
export type DiscardMergedTrain = Type.Static<typeof DiscardMergedTrain>
const DiscardValidator = Compile(DiscardMergedTrain)
export function isDiscardMergedTrain(action: GameAction): action is DiscardMergedTrain {
    return (
        action instanceof HydratedDiscardMergedTrain ||
        (action.type === 'DiscardMergedTrain' && DiscardValidator.Check(action))
    )
}

/** The company over its train limit after a takeover, and the trains it may discard. */
export function mergedTrainDiscards(state: EighteenThirtyTwoState, playerId: string) {
    const decision = mergerDecision(state)
    if (decision?.kind !== 'discard' || decision.playerId !== playerId) return undefined
    const trains = trainsCountingForLimit(state, EighteenThirtyTwoTrainRules, decision.companyId)
    return {
        companyId: decision.companyId,
        trains,
        excess: trains.length - EighteenThirtyTwoTrainRules.trainLimit(state, decision.companyId)
    }
}

/** The president discards a train of their choice to the open market, uncompensated (§11.7.1). */
export class HydratedDiscardMergedTrain
    extends HydratableAction<typeof DiscardMergedTrain>
    implements DiscardMergedTrain
{
    declare type: 'DiscardMergedTrain'
    declare playerId: string
    declare companyId: string
    declare trainId: string
    declare metadata?: DiscardMergedTrain['metadata']
    constructor(data: DiscardMergedTrain) {
        super(
            data instanceof HydratedDiscardMergedTrain ? data.dehydrate() : data,
            DiscardValidator
        )
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        const discards = mergedTrainDiscards(state, this.playerId)
        return (
            this.source === ActionSource.User &&
            discards?.companyId === this.companyId &&
            discards.trains.some((train) => train.id === this.trainId)
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'This train cannot be discarded')
        const phase = state.mergerPhase
        assertExists(phase, 'Trains are discarded in a merger phase')
        const payments = discardTrainToMarket(
            state,
            EighteenThirtyTwoTrainRules,
            this.companyId,
            this.trainId
        )
        if (!overTrainLimit(state, this.companyId)) delete phase.discardCompanyId
        if (payments.length) this.metadata = { departurePayments: payments }
    }
}

const DecisionActions: Readonly<Record<Decision['kind'], readonly string[]>> = {
    discard: ['DiscardMergedTrain'],
    fund: ['SellTakeoverShares'],
    answer: ['AnswerMerger'],
    propose: ['ProposeMerger', 'PassMerger']
}

/** Players in priority order propose, answer and fund mergers (§11.1). */
export class MergingHandler implements EighteenThirtyTwoStateHandler {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenThirtyTwoState>
    ): boolean {
        const state = context.gameState
        if (action instanceof HydratedCompleteMergerPhase)
            return action.source === ActionSource.System && !mergerDecision(state)
        if (action instanceof HydratedCompleteTakeover)
            return action.source === ActionSource.System && fundingCovered(state)
        return (
            (action instanceof HydratedProposeMerger ||
                action instanceof HydratedAnswerMerger ||
                action instanceof HydratedPassMerger ||
                action instanceof HydratedSellTakeoverShares ||
                action instanceof HydratedDiscardMergedTrain) &&
            action.isValid(state)
        )
    }
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEighteenThirtyTwoState>
    ): string[] {
        const state = context.gameState
        const decision = mergerDecision(state)
        if (!decision || decision.playerId !== playerId || fundingCovered(state)) return []
        return [...DecisionActions[decision.kind]]
    }
    enter(context: MachineContext<HydratedEighteenThirtyTwoState>): void {
        const state = context.gameState
        if (fundingCovered(state)) {
            context.addSystemAction(CompleteTakeover, {})
            return
        }
        const decision = mergerDecision(state)
        if (decision) state.activePlayerIds = [decision.playerId]
        else context.addSystemAction(CompleteMergerPhase, {})
    }
    onAction(action: HydratedAction): string {
        if (!(action instanceof HydratedCompleteMergerPhase)) return MergingState
        assertExists(action.metadata, 'A completed merger phase records which it was')
        return action.metadata.final ? 'OperatingSet' : 'StartingOperatingSet'
    }
}

/**
 * Opens a merger phase where one is due before the state does anything else: after a stock
 * round, or, ``final``, after the first 6-train's buyer's turn.
 */
export function startsMergerPhase(
    handler: EighteenThirtyTwoStateHandler,
    final: boolean
): EighteenThirtyTwoStateHandler {
    return new SystemActionFirstHandler(
        handler,
        StartMergerPhase,
        (state) => (mergerPhaseDue(state, final) ? { final } : undefined),
        (state) => (state.mergerPhase ? MergingState : state.machineState)
    )
}
