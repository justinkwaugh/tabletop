import { type HydratedAction, type MachineStateHandler, MachineContext, GameResult } from '@tabletop/common'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'

export class EndOfGameStateHandler
    implements MachineStateHandler<HydratedAction, HydratedSantiagoGameState>
{
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedSantiagoGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedSantiagoGameState>
    ): string[] {
        return []
    }

    enter(context: MachineContext<HydratedSantiagoGameState>) {
        const state = context.gameState
        state.score()
        state.activePlayerIds = []

        const maxScore = Math.max(...state.players.map((p) => p.score))
        const winners = state.players.filter((p) => p.score === maxScore)
        state.winningPlayerIds = winners.map((p) => p.playerId)
        state.result = GameResult.Win
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedSantiagoGameState>
    ): MachineState {
        throw new Error('EndOfGame does not handle actions')
    }
}
