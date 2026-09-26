import {
    assertExists,
    GameResult,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { totalMoney } from '../model/playerState.js'

type EndOfGameAction = HydratedAction

export class EndOfGameStateHandler implements MachineStateHandler<
    EndOfGameAction,
    HydratedIndonesiaGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedIndonesiaGameState>
    ): action is EndOfGameAction {
        // Leave this comment if you want the template to generate code for valid actions
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        const gameState = context.gameState
        gameState.activePlayerIds = []

        let winnerId: string | undefined
        let winnerTotal = Number.NEGATIVE_INFINITY
        for (const playerId of gameState.turnManager.turnOrder) {
            const total = totalMoney(gameState.getPlayerState(playerId))
            if (total > winnerTotal) {
                winnerTotal = total
                winnerId = playerId
            }
        }

        assertExists(winnerId, 'End of game requires at least one player in turn order')

        gameState.result = GameResult.Win
        gameState.winningPlayerIds = [winnerId]
    }

    onAction(
        _action: EndOfGameAction,
        _context: MachineContext<HydratedIndonesiaGameState>
    ): MachineState {
        switch (true) {
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
