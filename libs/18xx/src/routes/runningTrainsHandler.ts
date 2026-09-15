import { nextOperatingCompany, type OperatingState } from '../operating/operatingSet.js'
import { trainsRustingAfterOperation } from '../trains/rustTrains.js'
import {
    ActionSource,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { RunTrains, isRunTrains, type HydratedRunTrains } from './runTrains.js'
import { RouteEvaluation, type RouteRules } from './routeEvaluation.js'
import type { TrainRunningState } from './route.js'
type State = HydratedGameState & OperatingState & TrainRunningState
export class RunningTrainsHandler implements MachineStateHandler<HydratedRunTrains, State> {
    constructor(
        private readonly rules: RouteRules,
        private readonly nextState: string
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const state = context.gameState
        if (
            !isRunTrains(action) ||
            (action.source !== ActionSource.User &&
                !(action.source === ActionSource.System &&
                    action.routes.length === 0 && new RouteEvaluation(state, this.rules).cannotRun(action.companyId))) ||
            !action.playerId ||
            !state.activePlayerIds.includes(action.playerId)
        )
            return false
        const running = new RouteEvaluation(state, this.rules)
        return (
            running.canAct(action.playerId, action.companyId) &&
            Boolean(running.evaluate(action.companyId, action.routes).result)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState,
            companyId = state.routeStep?.companyId
        return companyId &&
            state.activePlayerIds.includes(playerId) &&
            new RouteEvaluation(state, this.rules).canAct(playerId, companyId)
            ? ['RunTrains']
            : []
    }
    enter(context: MachineContext<State>): void {
        const state = context.gameState
        const operatingCompanyId = nextOperatingCompany(state)
        assertExists(operatingCompanyId, 'Step entry requires an operating company')
        if (!state.routeStep) {
            state.routeStep = { companyId: operatingCompanyId }
        }
        const companyId = state.routeStep?.companyId
        if (companyId && !state.routeStep?.result &&
            new RouteEvaluation(state, this.rules).cannotRun(companyId)) {
            context.addSystemAction(RunTrains, {
                companyId, playerId: state.activePlayerIds[0], routes: []
            })
        }
    }
    onAction(action: HydratedRunTrains, context: MachineContext<State>): string {
        return trainsRustingAfterOperation(context.gameState, action.companyId).length
            ? 'RustingTrains'
            : this.nextState
    }
}
