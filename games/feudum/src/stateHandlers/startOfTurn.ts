import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedFeudumGameState } from '../model/gameState.js'

// Scaffold state: the first player is on the clock and no action is offered yet
export class StartOfTurnStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedFeudumGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): boolean {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedFeudumGameState>
    ): string[] {
        return []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        const gameState = context.gameState
        gameState.activePlayerIds = [gameState.turnManager.startNextTurn(gameState.actionCount)]
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        throw Error('Invalid action type')
    }
}
