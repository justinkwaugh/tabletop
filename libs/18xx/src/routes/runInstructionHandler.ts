import {
    ActionSource,
    assert,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import * as Value from 'typebox/value'
import { FinishTrack } from '../construction/finishTrack.js'
import { DistributeEarnings } from '../earnings/distributeEarnings.js'
import { controllingOwner } from '../finance/finance.js'
import { FinishOperatingTurn } from '../operating/finishOperatingTurn.js'
import { nextOperatingCompany } from '../operating/operatingSet.js'
import { FinishStations } from '../stations/finishStations.js'
import { FinishTrains } from '../trains/finishTrains.js'
import {
    consumeInstructedRun,
    declaredRunInstructionFor,
    isInstructedRun,
    isSolvedRun,
    type StandingRunInstruction
} from './instructedRuns.js'
import {
    evaluateRunInstruction,
    type RunInstructionEvaluationState,
    type RunInstructionOutcome,
    type RunInstructionRules,
    type RunInstructionStep
} from './runInstructionEvaluation.js'
import type { TrainRoute } from './route.js'
import { RunTrains, isRunTrains } from './runTrains.js'
import { StopRunInstruction, isStopRunInstruction } from './stopRunInstruction.js'

type State = HydratedGameState & RunInstructionEvaluationState
type Evaluation = { standing: StandingRunInstruction; outcome: RunInstructionOutcome }
/** The System Action an evaluation calls for: what it records, and how to schedule it. */
type ExpectedAction<S extends State> = {
    type: string
    data: Record<string, unknown>
    schedule(context: MachineContext<S>): void
}

/** Operates a company with a Run Instruction through one family operating step. */
export class RunInstructionHandler<S extends State> implements MachineStateHandler<
    HydratedAction,
    S
> {
    constructor(
        private readonly step: RunInstructionStep,
        private readonly handler: MachineStateHandler<HydratedAction, S>,
        private readonly rules: RunInstructionRules
    ) {}

    private evaluate(context: MachineContext<S>): Evaluation | undefined {
        const state = context.gameState
        const companyId = nextOperatingCompany(state)
        const declared = companyId ? declaredRunInstructionFor(state, companyId) : undefined
        if (!declared) return undefined
        const presides = controllingOwner(state, declared.companyId)?.playerId === declared.playerId
        if (declared.stopReason && presides) return undefined
        const available = state.activePlayerIds.includes(declared.playerId)
            ? this.handler.validActionsForPlayer(declared.playerId, context)
            : []
        return {
            standing: declared,
            outcome: evaluateRunInstruction(state, declared, this.step, this.rules, available)
        }
    }

    private instructedRoutes(standing: StandingRunInstruction): TrainRoute[] {
        const run = standing.runs[0]
        assert(isSolvedRun(run), 'An instructed run has routes')
        return run.routes
    }

    private expected({ standing, outcome }: Evaluation): ExpectedAction<S> | undefined {
        const { companyId, playerId } = standing
        if (outcome.kind === 'stop') {
            const data = { companyId, reason: outcome.reason }
            return {
                type: 'StopRunInstruction',
                data,
                schedule: (context) => context.addSystemAction(StopRunInstruction, data)
            }
        }
        if (outcome.kind !== 'act') return undefined
        switch (this.step) {
            case 'LayingTrack': {
                const data = { playerId, companyId }
                return {
                    type: 'FinishTrack',
                    data,
                    schedule: (context) => context.addSystemAction(FinishTrack, data)
                }
            }
            case 'PlacingStation': {
                const data = { playerId, companyId }
                return {
                    type: 'FinishStations',
                    data,
                    schedule: (context) => context.addSystemAction(FinishStations, data)
                }
            }
            case 'RunningTrains': {
                const data = { playerId, companyId, routes: this.instructedRoutes(standing) }
                return {
                    type: 'RunTrains',
                    data,
                    schedule: (context) => context.addSystemAction(RunTrains, structuredClone(data))
                }
            }
            case 'DistributingEarnings': {
                const data = { playerId, companyId, choice: standing.payout }
                return {
                    type: 'DistributeEarnings',
                    data,
                    schedule: (context) => context.addSystemAction(DistributeEarnings, data)
                }
            }
            case 'BuyingTrains':
            case 'RepayingLoans': {
                const data = { playerId, companyId }
                const finish =
                    outcome.finish === 'FinishTrains' ? FinishTrains : FinishOperatingTurn
                return {
                    type: outcome.finish ?? 'FinishOperatingTurn',
                    data,
                    schedule: (context) => context.addSystemAction(finish, data)
                }
            }
        }
    }

    private matches(action: HydratedAction, evaluation: Evaluation): boolean {
        const expected = this.expected(evaluation)
        return (
            expected?.type === action.type &&
            Object.entries(expected.data).every(([key, value]) =>
                Value.Equal(Reflect.get(action, key), value)
            )
        )
    }

    isValidAction(action: HydratedAction, context: MachineContext<S>): boolean {
        if (action.source === ActionSource.System) {
            const evaluation = this.evaluate(context)
            if (evaluation && this.matches(action, evaluation)) return true
            if (isStopRunInstruction(action)) return false
        }
        return this.handler.isValidAction(action, context)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<S>): string[] {
        return this.handler.validActionsForPlayer(playerId, context)
    }

    enter(context: MachineContext<S>): void {
        this.handler.enter(context)
        if (context.getPendingActions().length > 0) return
        const evaluation = this.evaluate(context)
        if (evaluation) this.expected(evaluation)?.schedule(context)
    }

    onAction(action: HydratedAction, context: MachineContext<S>): string {
        const state = context.gameState
        if (isStopRunInstruction(action)) return state.machineState
        const instructedRun =
            action.source === ActionSource.System &&
            isRunTrains(action) &&
            isInstructedRun(state, action)
        const next = this.handler.onAction(action, context)
        if (instructedRun) consumeInstructedRun(state, action.companyId)
        return next
    }
}
