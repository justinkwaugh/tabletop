import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

/** R-1.4.8 Seat by seat in turn order, each takes three starting goods. */
export class ChoosingStartingGoodsStateHandler implements MachineStateHandler<
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
        const { gameState } = context
        const playerId = gameState.turnManager.startNextTurn(gameState.actionCount)
        gameState.flow.setupOrder = { playerId }
        gameState.activePlayerIds = [playerId]
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        throw Error('Invalid action type')
    }
}
