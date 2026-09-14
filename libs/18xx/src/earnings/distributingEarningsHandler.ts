import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { DistributeEarnings, isDistributeEarnings, type HydratedDistributeEarnings } from './distributeEarnings.js'
import {
    EarningsDistribution,
    type EarningsRules,
    type DistributionState
} from './earningsDistribution.js'
type State = HydratedGameState & DistributionState
export class DistributingEarningsHandler implements MachineStateHandler<
    HydratedDistributeEarnings,
    State
> {
    constructor(private readonly rules: EarningsRules) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const state = context.gameState
        if (
            !isDistributeEarnings(action) ||
            (action.source !== ActionSource.User &&
                !(action.source === ActionSource.System &&
                    new EarningsDistribution(state, this.rules).automaticChoice(action.companyId) === action.choice)) ||
            !action.playerId ||
            !state.activePlayerIds.includes(action.playerId)
        )
            return false
        const distribution = new EarningsDistribution(state, this.rules)
        return (
            distribution.canAct(action.playerId, action.companyId) &&
            !!distribution.evaluate(action.companyId, action.choice).details
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState,
            companyId = state.routeStep?.companyId
        return companyId &&
            state.activePlayerIds.includes(playerId) &&
            new EarningsDistribution(state, this.rules).canAct(playerId, companyId)
            ? ['DistributeEarnings']
            : []
    }
    enter(context: MachineContext<State>): void {
        const state = context.gameState
        const companyId = state.routeStep?.companyId
        if (!companyId || state.earningsDistribution) return
        const choice = new EarningsDistribution(state, this.rules).automaticChoice(companyId)
        if (choice) context.addSystemAction(DistributeEarnings, {
            companyId, playerId: state.activePlayerIds[0], choice
        })
    }
    onAction(): string {
        return 'BuyingTrains'
    }
}
