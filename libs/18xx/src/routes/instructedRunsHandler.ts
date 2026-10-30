import {
    ActionSource,
    assertExists,
    type GameAction,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { instructedRunsOf } from '../actions/eighteenXXPlayerAction.js'
import {
    attachInstructedRuns,
    declaredRunInstructionFor,
    type RunInstructionState,
    instructableCompanyIds
} from './instructedRuns.js'
import type { TrainRunningState } from './route.js'
import type { RouteRules } from './routeEvaluation.js'
import { isRunInstructionDeclaration } from './runInstructionActions.js'
import { isSetRunInstruction, runInstructionProblem } from './setRunInstruction.js'
import { isSetRunInstructionStops, runInstructionStopsProblem } from './setRunInstructionStops.js'

type State = HydratedGameState & TrainRunningState & RunInstructionState

/** Accepts Run Instruction declarations in every state, and stores the runs any Action carries. */
export class InstructedRunsHandler<S extends State> implements MachineStateHandler<
    HydratedAction,
    S
> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, S>,
        private readonly rules: RouteRules | undefined
    ) {}

    private attachmentsAllowed(action: GameAction, state: S): boolean {
        if (!('instructedRuns' in action)) return true
        const attachments = instructedRunsOf(action)
        if (!attachments || action.source !== ActionSource.User) return false
        const companyIds = attachments.map((attachment) => attachment.companyId)
        const declaredHere = (companyId: string) =>
            isSetRunInstruction(action) &&
            action.companyId === companyId &&
            action.instruction !== undefined
        return (
            new Set(companyIds).size === companyIds.length &&
            companyIds.every(
                (companyId) =>
                    !!declaredRunInstructionFor(state, companyId) || declaredHere(companyId)
            )
        )
    }

    private declarationProblem(action: HydratedAction, state: S): string | undefined {
        if (isSetRunInstructionStops(action)) return runInstructionStopsProblem(state, action)
        if (!isSetRunInstruction(action)) return undefined
        assertExists(this.rules, 'Run instructions are registered only with their rules')
        return runInstructionProblem(state, this.rules, action)
    }

    isValidAction(action: HydratedAction, context: MachineContext<S>): boolean {
        const state = context.gameState
        if (!this.attachmentsAllowed(action, state)) return false
        if (isRunInstructionDeclaration(action))
            return (
                action.source === ActionSource.User &&
                this.declarationProblem(action, state) === undefined
            )
        return this.handler.isValidAction(action, context)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<S>): string[] {
        const actions = this.handler.validActionsForPlayer(playerId, context)
        if (!this.rules) return actions
        const instructable = instructableCompanyIds(context.gameState, playerId)
        if (instructable.length > 0) actions.push('SetRunInstruction')
        if (
            context.gameState.runInstructions?.some(
                (declared) =>
                    declared.playerId === playerId && instructable.includes(declared.companyId)
            )
        )
            actions.push('SetRunInstructionStops')
        return actions
    }

    enter(context: MachineContext<S>): void {
        this.handler.enter(context)
    }

    onAction(action: HydratedAction, context: MachineContext<S>): string {
        const state = context.gameState
        const next = isRunInstructionDeclaration(action)
            ? state.machineState
            : this.handler.onAction(action, context)
        const attachments = instructedRunsOf(action)
        if (attachments) attachInstructedRuns(state, attachments)
        return next
    }
}
