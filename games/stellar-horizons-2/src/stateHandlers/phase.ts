import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedCompletePhase, isCompletePhase } from '../actions/completePhase.js'
import { type PactAction, isPactAction } from '../actions/pactActions.js'
import { HydratedStartPhase, isStartPhase } from '../actions/startPhase.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { isClosed } from '../model/holds.js'
import { pactsNaming } from '../model/pacts.js'
import { TurnPhase } from '../model/turn.js'
import { playState } from '../model/turnPlan.js'
import { stateAfterPhase } from './transitions.js'

type PhaseAction = HydratedStartPhase | HydratedCompletePhase

export class PhaseStateHandler implements MachineStateHandler<
    PhaseAction,
    HydratedStellarHorizonsGameState
> {
    constructor(private readonly phase: TurnPhase) {}

    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is PhaseAction {
        return isStartPhase(action) || isCompletePhase(action)
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const state = context.gameState
        state.activePlayerIds = state.initiativeOrder()
    }

    onAction(
        action: PhaseAction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return isStartPhase(action)
            ? playState(this.phase)
            : stateAfterPhase(context.gameState, this.phase)
    }
}

// The exploration span's Branching Machine State also handles the pact's Common Actions; their
// cascades end back here (docs/parallel-spans.md, Common Actions rule 3).
export class ExplorationPhaseStateHandler implements MachineStateHandler<
    PhaseAction | PactAction,
    HydratedStellarHorizonsGameState
> {
    private readonly phaseHandler = new PhaseStateHandler(TurnPhase.Exploration)

    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is PhaseAction | PactAction {
        return isPactAction(action)
            ? action.isValid(context.gameState)
            : this.phaseHandler.isValidAction(action, context)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        const state = context.gameState
        const span = state.parallelSpan
        if (
            span === undefined ||
            !span.playerIds.includes(playerId) ||
            isClosed(state, playerId) ||
            state.scenarioDefinition().anomalies === undefined
        ) {
            return []
        }
        const naming = pactsNaming(state, playerId).filter((candidate) => !candidate.agreed)
        return [
            ActionType.ProposePact,
            ...(naming.some((candidate) => !candidate.acceptedIds.includes(playerId))
                ? [ActionType.AcceptPact]
                : []),
            ...(naming.length > 0 ? [ActionType.WithdrawPact] : [])
        ]
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        this.phaseHandler.enter(context)
    }

    onAction(
        action: PhaseAction | PactAction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return isPactAction(action)
            ? MachineState.ExplorationPhase
            : this.phaseHandler.onAction(action, context)
    }
}
