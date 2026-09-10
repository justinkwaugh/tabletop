import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { isRunTrains, type HydratedRunTrains } from './runTrains.js'
import { RouteEvaluation, type RouteRules } from './routeEvaluation.js'
import type { TrainRunningState } from './route.js'
type State = HydratedGameState & TrainRunningState
export class RunningTrainsHandler implements MachineStateHandler<HydratedRunTrains, State> {
    constructor(
        private readonly rules: RouteRules,
        private readonly nextState: string
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const state = context.gameState
        if (
            !isRunTrains(action) ||
            action.source !== ActionSource.User ||
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
    enter(): void {}
    onAction(): string {
        return this.nextState
    }
}
