import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import {
    EighteenXXPlayerAction,
    HydratedDiscardMergedTrain,
    RoundEnd,
    SystemActionFirstHandler,
    canStartStockRound,
    controllingOwner,
    floatedCompaniesInMarketOrder,
    overTrainLimit,
    roundEnd,
    trainsCountingForLimit,
    type MergedTrainDiscardRules,
    type ValuationRules
} from '@tabletop/18xx'
import type { HydratedState1833NE, State1833NE, StateHandler1833NE } from './state.js'
import { Market1833NE } from './stock.js'
import { consentingPlayer, offerReason, takeoverTargets } from './takeoverRules.js'
import { TakeoverOutcome, settleTakeover } from './takeoverSettlement.js'
import { ShareSwap, TakeoverOffer, TakingOverState, type TakeoverStep } from './takeoverState.js'
import { Phases1833NE, TrainRules1833NE } from './trains.js'

const Id = Type.String({ minLength: 1 })

function requireStep(state: State1833NE): TakeoverStep {
    const step = state.takeoverStep
    assertExists(step, 'A takeover step is in progress')
    return step
}

/** Passes over the corporations at the front of the order with no takeover to attempt. */
function skipCorporationsWithoutTargets(state: State1833NE): void {
    const step = requireStep(state)
    while (step.companyIds.length && !takeoverTargets(state, step.companyIds[0]).length)
        step.companyIds.shift()
}

/** Ends the current corporation's attempt; the next one with a takeover to attempt follows. */
function endAttempt(state: State1833NE): void {
    requireStep(state).companyIds.shift()
    skipCorporationsWithoutTargets(state)
}

/** Settles a takeover; an acquirer over its new limit turns trains in before the step goes on. */
function takeOver(state: HydratedState1833NE, offer: TakeoverOffer): TakeoverOutcome {
    const step = requireStep(state)
    delete step.offer
    const outcome = settleTakeover(state, offer)
    if (overTrainLimit(state, TrainRules1833NE, offer.companyId))
        step.discardCompanyId = offer.companyId
    else endAttempt(state)
    return outcome
}

type Decision =
    | { kind: 'discard'; playerId: string; companyId: string }
    | { kind: 'answer'; playerId: string; offer: TakeoverOffer }
    | { kind: 'offer'; playerId: string; companyId: string }

/** Who acts next in the takeover step, and on what. */
export function takeoverDecision(state: State1833NE): Decision | undefined {
    const step = state.takeoverStep
    if (!step) return undefined
    if (step.discardCompanyId) {
        const playerId = controllingOwner(state, step.discardCompanyId)?.playerId
        assertExists(playerId, 'An acquirer over its train limit has a president')
        return { kind: 'discard', playerId, companyId: step.discardCompanyId }
    }
    if (step.offer) {
        const playerId = consentingPlayer(state, step.offer)
        assertExists(playerId, 'A held offer awaits its target’s president')
        return { kind: 'answer', playerId, offer: step.offer }
    }
    const companyId = step.companyIds[0]
    if (!companyId) return undefined
    const playerId = controllingOwner(state, companyId)?.playerId
    assertExists(playerId, 'A corporation attempting a takeover has a president')
    return { kind: 'offer', playerId, companyId }
}

function decisionFor<Kind extends Decision['kind']>(
    state: State1833NE,
    kind: Kind,
    playerId: string
): Extract<Decision, { kind: Kind }> | undefined {
    const decision = takeoverDecision(state)
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

/** Takeovers start in phase II, after each set's second operating round (§4, §11). */
function takeoverStepDue(state: State1833NE): boolean {
    const set = state.operatingSet
    return (
        !!state.takeoverGame &&
        !!set &&
        Phases1833NE.isAtLeast(state.phaseId, 'II') &&
        canStartStockRound(state) &&
        state.takeoverSet !== set.number &&
        floatedCompaniesInMarketOrder(Market1833NE, state).some(
            (companyId) => takeoverTargets(state, companyId).length > 0
        )
    )
}

const StartFields = Type.Object({ type: Type.Literal('StartTakeoverStep') })
export const StartTakeoverStep: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof StartFields.properties
> = Type.Object(
    { ...GameAction.properties, ...StartFields.properties },
    { additionalProperties: false }
)
export type StartTakeoverStep = Type.Static<typeof StartTakeoverStep>
const StartValidator = Compile(StartTakeoverStep)

export class HydratedStartTakeoverStep
    extends HydratableAction<typeof StartTakeoverStep>
    implements StartTakeoverStep
{
    declare type: 'StartTakeoverStep'
    constructor(data: StartTakeoverStep) {
        super(data instanceof HydratedStartTakeoverStep ? data.dehydrate() : data, StartValidator)
    }
    apply(state: HydratedState1833NE): void {
        assert(
            this.source === ActionSource.System && takeoverStepDue(state),
            'A takeover step follows the second operating round from phase II'
        )
        const set = state.operatingSet
        assertExists(set, 'A takeover step follows an operating round')
        state.takeoverSet = set.number
        state.takeoverStep = { companyIds: floatedCompaniesInMarketOrder(Market1833NE, state) }
        skipCorporationsWithoutTargets(state)
        state.activePlayerIds = []
    }
}

const EndFields = Type.Object({
    type: Type.Literal('EndTakeoverStep'),
    metadata: Type.Optional(Type.Object({ roundEnd: RoundEnd }, { additionalProperties: false }))
})
export const EndTakeoverStep: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof EndFields.properties
> = Type.Object(
    { ...GameAction.properties, ...EndFields.properties },
    { additionalProperties: false }
)
export type EndTakeoverStep = Type.Static<typeof EndTakeoverStep>
const EndValidator = Compile(EndTakeoverStep)

export class HydratedEndTakeoverStep
    extends HydratableAction<typeof EndTakeoverStep>
    implements EndTakeoverStep
{
    declare type: 'EndTakeoverStep'
    declare metadata?: EndTakeoverStep['metadata']
    readonly #valuationRules: ValuationRules
    constructor(data: EndTakeoverStep, valuationRules: ValuationRules) {
        super(data instanceof HydratedEndTakeoverStep ? data.dehydrate() : data, EndValidator)
        this.#valuationRules = valuationRules
    }
    apply(state: HydratedState1833NE): void {
        assert(
            this.source === ActionSource.System && !!state.takeoverStep && !takeoverDecision(state),
            'The takeover step ends once every corporation has had its chance'
        )
        delete state.takeoverStep
        state.activePlayerIds = []
        this.metadata = { roundEnd: roundEnd(state, this.#valuationRules, 'title') }
    }
}

const OfferFields = {
    ...EighteenXXPlayerAction.properties,
    type: Type.Literal('OfferTakeover'),
    companyId: Id,
    targetId: Id,
    swaps: Type.Array(ShareSwap),
    metadata: Type.Optional(
        Type.Object({ outcome: Type.Optional(TakeoverOutcome) }, { additionalProperties: false })
    )
}
export const OfferTakeover = Type.Object(OfferFields, { additionalProperties: false })
export type OfferTakeover = Type.Static<typeof OfferTakeover>
const OfferValidator = Compile(OfferTakeover)

/**
 * The president of the corporation whose turn it is offers to take another over, naming the
 * shares it redeems by swap; the rest it pays for in cash. An offer the target's president may
 * refuse waits for their answer (§11.4–11.5).
 */
export class HydratedOfferTakeover
    extends HydratableAction<typeof OfferTakeover>
    implements OfferTakeover
{
    declare type: 'OfferTakeover'
    declare playerId: string
    declare companyId: string
    declare targetId: string
    declare swaps: ShareSwap[]
    declare metadata?: OfferTakeover['metadata']
    constructor(data: OfferTakeover) {
        super(data instanceof HydratedOfferTakeover ? data.dehydrate() : data, OfferValidator)
    }
    get offer(): TakeoverOffer {
        return { companyId: this.companyId, targetId: this.targetId, swaps: this.swaps }
    }
    isValid(state: HydratedState1833NE): boolean {
        return (
            this.source === ActionSource.User &&
            decisionFor(state, 'offer', this.playerId)?.companyId === this.companyId &&
            offerReason(state, this.offer) === undefined
        )
    }
    apply(state: HydratedState1833NE): void {
        assert(this.isValid(state), offerReason(state, this.offer) ?? 'Not this player’s offer')
        const offer = structuredClone(this.offer)
        if (consentingPlayer(state, offer)) {
            requireStep(state).offer = offer
            this.metadata = {}
            return
        }
        this.metadata = { outcome: takeOver(state, offer) }
    }
}

const AnswerFields = {
    ...EighteenXXPlayerAction.properties,
    type: Type.Literal('AnswerTakeover'),
    accept: Type.Boolean(),
    metadata: Type.Optional(
        Type.Object(
            { offer: TakeoverOffer, outcome: Type.Optional(TakeoverOutcome) },
            { additionalProperties: false }
        )
    )
}
export const AnswerTakeover = Type.Object(AnswerFields, { additionalProperties: false })
export type AnswerTakeover = Type.Static<typeof AnswerTakeover>
const AnswerValidator = Compile(AnswerTakeover)

/** The target's president agrees to the offer or refuses it, ending the attempt (§11.4). */
export class HydratedAnswerTakeover
    extends HydratableAction<typeof AnswerTakeover>
    implements AnswerTakeover
{
    declare type: 'AnswerTakeover'
    declare playerId: string
    declare accept: boolean
    declare metadata?: AnswerTakeover['metadata']
    constructor(data: AnswerTakeover) {
        super(data instanceof HydratedAnswerTakeover ? data.dehydrate() : data, AnswerValidator)
    }
    isValid(state: HydratedState1833NE): boolean {
        return this.source === ActionSource.User && !!decisionFor(state, 'answer', this.playerId)
    }
    apply(state: HydratedState1833NE): void {
        assert(this.isValid(state), 'Only the target’s president answers a takeover offer')
        const step = requireStep(state)
        const offer = step.offer
        assertExists(offer, 'An answer requires an offer')
        if (this.accept) {
            this.metadata = { offer, outcome: takeOver(state, offer) }
            return
        }
        delete step.offer
        endAttempt(state)
        this.metadata = { offer }
    }
}

const PassFields = {
    ...EighteenXXPlayerAction.properties,
    type: Type.Literal('PassTakeover'),
    companyId: Id
}
export const PassTakeover = Type.Object(PassFields, { additionalProperties: false })
export type PassTakeover = Type.Static<typeof PassTakeover>
const PassValidator = Compile(PassTakeover)

export class HydratedPassTakeover
    extends HydratableAction<typeof PassTakeover>
    implements PassTakeover
{
    declare type: 'PassTakeover'
    declare playerId: string
    declare companyId: string
    constructor(data: PassTakeover) {
        super(data instanceof HydratedPassTakeover ? data.dehydrate() : data, PassValidator)
    }
    isValid(state: HydratedState1833NE): boolean {
        return (
            this.source === ActionSource.User &&
            decisionFor(state, 'offer', this.playerId)?.companyId === this.companyId
        )
    }
    apply(state: HydratedState1833NE): void {
        assert(this.isValid(state), 'Only the president whose turn it is passes')
        endAttempt(state)
    }
}

/** The trains an acquirer over its new train limit may turn in, and how many it must. */
export function mergedTrainDiscards(state: State1833NE, playerId: string) {
    const decision = decisionFor(state, 'discard', playerId)
    if (!decision) return undefined
    const trains = trainsCountingForLimit(state, TrainRules1833NE, decision.companyId)
    const limit = TrainRules1833NE.trainLimit(state, decision.companyId)
    return { companyId: decision.companyId, trains, limit, excess: trains.length - limit }
}

/** An acquirer over its train limit turns in trains of its president's choice (§11.5.4). */
export const MergedTrainDiscards1833NE: MergedTrainDiscardRules<HydratedState1833NE> = {
    discards: mergedTrainDiscards,
    withinLimit(state) {
        delete requireStep(state).discardCompanyId
        endAttempt(state)
    }
}

const DecisionActions: Readonly<Record<Decision['kind'], readonly string[]>> = {
    discard: ['DiscardMergedTrain'],
    answer: ['AnswerTakeover'],
    offer: ['OfferTakeover', 'PassTakeover']
}

type Context = MachineContext<HydratedState1833NE>

/** Corporations in stock price order attempt their takeovers (§11). */
export class TakeoverStepHandler implements StateHandler1833NE {
    isValidAction(action: HydratedAction, context: Context): boolean {
        const state = context.gameState
        if (action instanceof HydratedEndTakeoverStep)
            return action.source === ActionSource.System && !takeoverDecision(state)
        return (
            (action instanceof HydratedOfferTakeover ||
                action instanceof HydratedAnswerTakeover ||
                action instanceof HydratedPassTakeover ||
                action instanceof HydratedDiscardMergedTrain) &&
            action.isValid(state)
        )
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        const decision = takeoverDecision(context.gameState)
        return decision?.playerId === playerId ? [...DecisionActions[decision.kind]] : []
    }
    enter(context: Context): void {
        const decision = takeoverDecision(context.gameState)
        if (decision) context.gameState.activePlayerIds = [decision.playerId]
        else context.addSystemAction(EndTakeoverStep, {})
    }
    onAction(action: HydratedAction): string {
        return action instanceof HydratedEndTakeoverStep ? 'OperatingSet' : TakingOverState
    }
}

/** Holds a takeover step, when one is due, before the stock round follows the set. */
export function startsTakeoverSteps(handler: StateHandler1833NE): StateHandler1833NE {
    return new SystemActionFirstHandler(
        handler,
        StartTakeoverStep,
        (state) => (takeoverStepDue(state) ? {} : undefined),
        TakingOverState
    )
}

export const isOfferTakeover = (action: GameAction): action is OfferTakeover =>
    action instanceof HydratedOfferTakeover ||
    (action.type === 'OfferTakeover' && OfferValidator.Check(action))
export const isAnswerTakeover = (action: GameAction): action is AnswerTakeover =>
    action instanceof HydratedAnswerTakeover ||
    (action.type === 'AnswerTakeover' && AnswerValidator.Check(action))
export const isPassTakeover = (action: GameAction): action is PassTakeover =>
    action instanceof HydratedPassTakeover ||
    (action.type === 'PassTakeover' && PassValidator.Check(action))
export const isStartTakeoverStep = (action: GameAction): action is StartTakeoverStep =>
    action instanceof HydratedStartTakeoverStep ||
    (action.type === 'StartTakeoverStep' && StartValidator.Check(action))
export const isEndTakeoverStep = (action: GameAction): action is EndTakeoverStep =>
    action instanceof HydratedEndTakeoverStep ||
    (action.type === 'EndTakeoverStep' && EndValidator.Check(action))
