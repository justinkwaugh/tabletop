import type { ActionDefinition } from '../actions/actionDefinition.js'
import { systemAction } from '../actions/titleAction.js'
import * as Type from 'typebox'
import {
    ActionSource,
    assert,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { operatingPlayerIds, type ReceivershipRules } from '../finance/receivership.js'
import {
    PlaceHomeStations,
    isPlaceHomeStations,
    type HydratedPlaceHomeStations
} from '../stations/placeHomeStations.js'
import type { StationPlacementState, StationRules } from '../stations/stationPlacement.js'
import { createStockRound } from '../stock/stockRound.js'
import type { StockState } from '../stock/stockState.js'
import {
    nextOperatingCompany,
    reorderPendingOperatingCompanies,
    type OperatingRules,
    type OperatingState
} from './operatingSet.js'
import { BetweenCompaniesState, OperatingStepStates } from './operatingSteps.js'

/**
 * A stock round due in the middle of a company's operating turn, as when 1880's last train of a
 * kind leaves the bank (§XII): the turn waits through the stock round and resumes in the step
 * the title names.
 */
export const StockRoundInterruption = Type.Object(
    {
        companyId: Type.String(),
        /** The operating step the company resumes in once the stock round ends. */
        resumeState: Type.String(),
        /** The stock round is under way. */
        started: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type StockRoundInterruption = Type.Static<typeof StockRoundInterruption>
export const StockRoundInterruptionFields = {
    stockRoundInterruption: Type.Optional(StockRoundInterruption)
}
export type StockRoundInterruptionState = Type.Static<
    Type.TObject<typeof StockRoundInterruptionFields>
>

export const InterruptingOperatingTurnState = 'InterruptingOperatingTurn'
export const ResumingOperatingTurnState = 'ResumingOperatingTurn'
export const StockRoundInterruptionMachineStates = [
    InterruptingOperatingTurnState,
    ResumingOperatingTurnState
] as const
/**
 * The states in which an interrupted operating turn waits, keeping its earnings and steps, for
 * a title's `operatingInterruptions` validation.
 */
export const InterruptedOperatingTurnStates: readonly string[] = [
    ...StockRoundInterruptionMachineStates,
    'StockRound'
]

type State = HydratedGameState & OperatingState & StockState & StockRoundInterruptionState

/** Records that a stock round interrupts the company's turn, to resume in the step given. */
export function interruptForStockRound(
    state: StockRoundInterruptionState,
    companyId: string,
    resumeState: string
): void {
    assert(!state.stockRoundInterruption, 'A stock round already interrupts the operating turn')
    state.stockRoundInterruption = { companyId, resumeState }
}

/** Whether a stock round is due before the operating turn goes on. */
export function stockRoundDue(state: StockRoundInterruptionState): boolean {
    return !!state.stockRoundInterruption && !state.stockRoundInterruption.started
}

/** What resuming or interrupting an operating turn records: the company and its step. */
const TurnRecord = Type.Optional(
    Type.Object(
        { companyId: Type.String(), resumeState: Type.String() },
        { additionalProperties: false }
    )
)
const InterruptAction = systemAction('InterruptOperatingTurn', { metadata: TurnRecord })
export const InterruptOperatingTurn = InterruptAction.schema
export type InterruptOperatingTurn = Type.Static<typeof InterruptOperatingTurn>
export const isInterruptOperatingTurn = InterruptAction.is
/** Sets the operating turn aside and starts the stock round, its priority player first. */
export class HydratedInterruptOperatingTurn extends InterruptAction.Base {
    declare metadata?: InterruptOperatingTurn['metadata']
    apply(state: State): void {
        assert(
            this.source === ActionSource.System && stockRoundDue(state),
            'No stock round interrupts the operating turn'
        )
        const interruption = state.stockRoundInterruption
        assertExists(interruption, 'A stock round is due')
        interruption.started = true
        if (state.turnManager.currentTurn()) state.turnManager.endTurn(state.actionCount)
        state.stockRound = createStockRound(state.stockRound.number + 1)
        const playerId = state.turnManager.turnOrder[0]
        assert(playerId, 'Stock round requires a priority player')
        state.activePlayerIds = [playerId]
        state.turnManager.startTurn(playerId, state.actionCount + 1)
        this.metadata = { companyId: interruption.companyId, resumeState: interruption.resumeState }
    }
}

const ResumeAction = systemAction('ResumeOperatingTurn', { metadata: TurnRecord })
export const ResumeOperatingTurn = ResumeAction.schema
export type ResumeOperatingTurn = Type.Static<typeof ResumeOperatingTurn>
export const isResumeOperatingTurn = ResumeAction.is
/**
 * Returns play to the interrupted company's turn once the stock round has ended; the companies
 * still to operate take their places in the operating order as it now stands.
 */
export class HydratedResumeOperatingTurn extends ResumeAction.Base {
    declare metadata?: ResumeOperatingTurn['metadata']
    readonly #rules: OperatingRules
    readonly #receivership?: ReceivershipRules
    constructor(
        data: ResumeOperatingTurn,
        rules: OperatingRules,
        receivership?: ReceivershipRules
    ) {
        super(data)
        this.#rules = rules
        this.#receivership = receivership
    }
    apply(state: State): void {
        const interruption = state.stockRoundInterruption
        assert(
            this.source === ActionSource.System &&
                !!interruption?.started &&
                state.stockRound.completed,
            'No interrupted operating turn awaits its stock round'
        )
        const { companyId, resumeState } = interruption
        assert(
            nextOperatingCompany(state) === companyId,
            'The interrupted company is still the one operating'
        )
        delete state.stockRoundInterruption
        const set = state.operatingSet
        assertExists(set, 'An interrupted turn belongs to an operating round')
        set.resumptions = (set.resumptions ?? 0) + 1
        // Companies floated in the stock round that come after the resuming one operate in
        // this round too (1880, as 18xx.games rebuilds the round).
        reorderPendingOperatingCompanies(state, this.#rules.companyOrder(state), {
            admitsLaterCompanies: true
        })
        const operators = operatingPlayerIds(state, companyId, this.#receivership)
        state.activePlayerIds = operators
        state.turnManager.startTurn(operators[0], state.actionCount + 1)
        this.metadata = { companyId, resumeState }
    }
}

export class InterruptingOperatingTurnHandler implements MachineStateHandler<
    HydratedInterruptOperatingTurn,
    State
> {
    isValidAction(action: HydratedAction): boolean {
        return action.source === ActionSource.System && isInterruptOperatingTurn(action)
    }
    validActionsForPlayer(): string[] {
        return []
    }
    enter(context: MachineContext<State>): void {
        context.addSystemAction(InterruptOperatingTurn, {})
    }
    onAction(): string {
        return 'StockRound'
    }
}

/**
 * Returns to the interrupted turn once the stock round is over; the homes of the companies it
 * floated go down first, where the station rules hold them pending (1880 §XII).
 */
export class ResumingOperatingTurnHandler implements MachineStateHandler<
    HydratedResumeOperatingTurn | HydratedPlaceHomeStations,
    State & StationPlacementState
> {
    constructor(private readonly stationRules: StationRules) {}
    private homesPending(state: State & StationPlacementState): boolean {
        return this.stationRules.pendingHomes(state).length > 0
    }
    isValidAction(action: HydratedAction, context: MachineContext<State & StationPlacementState>) {
        if (action.source !== ActionSource.System) return false
        return this.homesPending(context.gameState)
            ? isPlaceHomeStations(action)
            : isResumeOperatingTurn(action)
    }
    validActionsForPlayer(): string[] {
        return []
    }
    enter(context: MachineContext<State & StationPlacementState>): void {
        if (this.homesPending(context.gameState))
            context.addSystemAction(PlaceHomeStations, {
                playerId: context.gameState.activePlayerIds[0]
            })
        else context.addSystemAction(ResumeOperatingTurn, {})
    }
    onAction(action: HydratedResumeOperatingTurn | HydratedPlaceHomeStations): string {
        if (!(action instanceof HydratedResumeOperatingTurn)) return ResumingOperatingTurnState
        assertExists(action.metadata, 'A resumed turn records its step')
        return action.metadata.resumeState
    }
}

const ResumableStates: readonly string[] = [...OperatingStepStates, BetweenCompaniesState]

/**
 * Once the action that made a stock round due has run its course, back in an operating step or
 * between companies, play turns to the stock round before going on.
 */
export class StockRoundInterruptionHandler<S extends State> implements MachineStateHandler<
    HydratedAction,
    S
> {
    constructor(private readonly handler: MachineStateHandler<HydratedAction, S>) {}
    isValidAction(action: HydratedAction, context: MachineContext<S>): boolean {
        return this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<S>): string[] {
        return this.handler.validActionsForPlayer(playerId, context)
    }
    enter(context: MachineContext<S>): void {
        this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<S>): string {
        const next = this.handler.onAction(action, context)
        return stockRoundDue(context.gameState) && ResumableStates.includes(next)
            ? InterruptingOperatingTurnState
            : next
    }
}

/** A stock round that interrupted an operating turn returns to it as it ends. */
export class ResumesInterruptedTurnHandler<S extends State> implements MachineStateHandler<
    HydratedAction,
    S
> {
    constructor(private readonly handler: MachineStateHandler<HydratedAction, S>) {}
    isValidAction(action: HydratedAction, context: MachineContext<S>): boolean {
        return this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<S>): string[] {
        return this.handler.validActionsForPlayer(playerId, context)
    }
    enter(context: MachineContext<S>): void {
        this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<S>): string {
        const next = this.handler.onAction(action, context)
        const state = context.gameState
        return state.stockRoundInterruption?.started &&
            state.stockRound.completed &&
            next !== 'StockRound'
            ? ResumingOperatingTurnState
            : next
    }
}

export function stockRoundInterruptionActions(
    rules: OperatingRules,
    receivership?: ReceivershipRules
): ActionDefinition[] {
    return [
        InterruptAction.define((action) => new HydratedInterruptOperatingTurn(action)),
        ResumeAction.define(
            (action) => new HydratedResumeOperatingTurn(action, rules, receivership)
        )
    ]
}
