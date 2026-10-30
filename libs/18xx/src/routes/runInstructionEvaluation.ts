import { controllingOwner, getCompany } from '../finance/finance.js'
import type { ReceivershipRules } from '../finance/receivership.js'
import {
    EarningsDistribution,
    type DistributionState,
    type EarningsRules
} from '../earnings/earningsDistribution.js'
import {
    finishOperatingTurnReason,
    type OperatingTurnState
} from '../operating/finishOperatingTurn.js'
import { trainIdsOwnedBy } from '../trains/train.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import {
    isSolvedRun,
    type IgnorableRunInstructionStop,
    type RunInstructionState,
    type RunInstructionStopReason,
    type StandingRunInstruction
} from './instructedRuns.js'
import { atRunningStep, type TrainRunningState, type TrainRoute } from './route.js'
import { RouteEvaluation, type OperatingEvaluation, type RouteRules } from './routeEvaluation.js'

export const runInstructionSteps = [
    'LayingTrack',
    'PlacingStation',
    'RunningTrains',
    'DistributingEarnings',
    'BuyingTrains',
    'RepayingLoans'
] as const
export type RunInstructionStep = (typeof runInstructionSteps)[number]
const stepsBeforeTheRun: readonly RunInstructionStep[] = [
    'LayingTrack',
    'PlacingStation',
    'RunningTrains'
]

export type RunInstructionRules = {
    routeRules: RouteRules
    trainRules: TrainRules
    earningsRules: EarningsRules
    receivershipRules?: ReceivershipRules
}
export type RunInstructionEvaluationState = TrainRunningState &
    RunInstructionState &
    OperatingTurnState &
    DistributionState

export type BuyingTrainsFinish = 'FinishOperatingTurn' | 'FinishTrains'
export type RunInstructionOutcome =
    | { kind: 'wait' }
    | { kind: 'act'; finish?: BuyingTrainsFinish }
    | { kind: 'stop'; reason: RunInstructionStopReason }

export function evaluateInstructedRoutes(
    state: TrainRunningState,
    rules: RouteRules,
    companyId: string,
    routes: readonly TrainRoute[]
): OperatingEvaluation {
    return new RouteEvaluation(atRunningStep(state, companyId), rules).evaluate(companyId, routes)
}

const stepAction = {
    LayingTrack: 'FinishTrack',
    PlacingStation: 'FinishStations',
    RunningTrains: 'RunTrains'
} as const satisfies Partial<Record<RunInstructionStep, string>>

function stop(reason: RunInstructionStopReason): RunInstructionOutcome {
    return { kind: 'stop', reason }
}

function runChange(
    state: TrainRunningState,
    standing: StandingRunInstruction,
    rules: RouteRules
): RunInstructionStopReason | undefined {
    const watched = (stop: IgnorableRunInstructionStop) => !standing.ignoredStops?.includes(stop)
    const owned = new Set(
        trainIdsOwnedBy(state, { kind: 'company', companyId: standing.companyId })
    )
    if (watched('train-lost') && standing.declaredTrainIds.some((id) => !owned.has(id)))
        return 'train-lost'
    const run = standing.runs[0]
    if (!isSolvedRun(run)) return 'routes-unsolved'
    const { result } = evaluateInstructedRoutes(state, rules, standing.companyId, run.routes)
    if (!result) return 'routes-stale'
    return result.revenue < standing.declaredRevenue && watched('run-lowered')
        ? 'run-lowered'
        : undefined
}

export function evaluateRunInstruction(
    state: RunInstructionEvaluationState,
    standing: StandingRunInstruction,
    step: RunInstructionStep,
    rules: RunInstructionRules,
    availableActions: readonly string[]
): RunInstructionOutcome {
    const { companyId } = standing
    if (controllingOwner(state, companyId)?.playerId !== standing.playerId)
        return stop('president-changed')
    if (availableActions.length === 0 || getCompany(state, companyId).closed)
        return { kind: 'wait' }
    if (stepsBeforeTheRun.includes(step)) {
        const change = runChange(state, standing, rules.routeRules)
        if (change) return stop(change)
    }
    switch (step) {
        case 'LayingTrack':
        case 'PlacingStation':
        case 'RunningTrains':
            return availableActions.includes(stepAction[step]) ? { kind: 'act' } : { kind: 'wait' }
        case 'DistributingEarnings': {
            if (!availableActions.includes('DistributeEarnings')) return { kind: 'wait' }
            const distribution = new EarningsDistribution(
                state,
                rules.earningsRules,
                rules.receivershipRules
            )
            return distribution.choices(companyId).includes(standing.payout) &&
                distribution.evaluate(companyId, standing.payout).details
                ? { kind: 'act' }
                : stop('payout-unavailable')
        }
        case 'BuyingTrains': {
            const finish = (['FinishOperatingTurn', 'FinishTrains'] as const).find((type) =>
                availableActions.includes(type)
            )
            if (finish) return { kind: 'act', finish }
            return finishOperatingTurnReason(state, rules.trainRules, companyId)
                ? stop('must-buy-train')
                : { kind: 'wait' }
        }
        case 'RepayingLoans':
            return availableActions.includes('FinishOperatingTurn')
                ? { kind: 'act', finish: 'FinishOperatingTurn' }
                : { kind: 'wait' }
    }
}
