import type {
    HydratedAction,
    HydratedGameState,
    MachineContext,
    MachineStateHandler
} from '@tabletop/common'
import { endingDue, pendingEnding, type EndingState, type EndingRules } from './gameEnding.js'
import { ScheduleGameEnd, HydratedScheduleGameEnd } from './scheduleGameEnd.js'
import { EndGame, HydratedEndGame } from './endGame.js'
export class GameEndingHandler<
    State extends HydratedGameState & EndingState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, State>,
        private readonly rules: EndingRules
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (action instanceof HydratedScheduleGameEnd || action instanceof HydratedEndGame)
            return action.isValid(context.gameState)
        return (
            !pendingEnding(context.gameState, this.rules) &&
            !endingDue(context.gameState) &&
            this.handler.isValidAction(action, context)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        return pendingEnding(context.gameState, this.rules) || endingDue(context.gameState)
            ? []
            : this.handler.validActionsForPlayer(playerId, context)
    }
    enter(context: MachineContext<State>): void {
        if (pendingEnding(context.gameState, this.rules))
            context.addSystemAction(ScheduleGameEnd, {})
        else if (endingDue(context.gameState)) context.addSystemAction(EndGame, {})
        else this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        if (action instanceof HydratedEndGame) return 'GameOver'
        if (action instanceof HydratedScheduleGameEnd) return context.gameState.machineState
        return this.handler.onAction(action, context)
    }
}
