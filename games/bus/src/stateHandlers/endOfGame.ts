import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedBusGameState } from '../model/gameState.js'

type EndOfGameAction = HydratedAction

export class EndOfGameStateHandler implements MachineStateHandler<
    EndOfGameAction,
    HydratedBusGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedBusGameState>
    ): action is EndOfGameAction {
        // Leave this comment if you want the template to generate code for valid actions
        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedBusGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedBusGameState>) {
        const gameState = context.gameState

        const scoreOrderIndexByPlayerId = new Map<string, number>(
            gameState.scoreOrder.map((playerId, index) => [playerId, index])
        )

        // Final score uses the rulebook time-stone penalty:
        // score - stones. Tie-breaks are: more stones, then earlier in scoreOrder.
        const rankedPlayers = [...gameState.players].toSorted((a, b) => {
            const aFinalScore = a.score - a.stones
            const bFinalScore = b.score - b.stones
            if (aFinalScore !== bFinalScore) {
                return bFinalScore - aFinalScore
            }

            if (a.stones !== b.stones) {
                return b.stones - a.stones
            }

            const aOrder = scoreOrderIndexByPlayerId.get(a.playerId) ?? Number.MAX_SAFE_INTEGER
            const bOrder = scoreOrderIndexByPlayerId.get(b.playerId) ?? Number.MAX_SAFE_INTEGER
            if (aOrder !== bOrder) {
                return aOrder - bOrder
            }

            // Deterministic fallback if scoreOrder data is missing or malformed.
            return a.playerId.localeCompare(b.playerId)
        })

        const winner = rankedPlayers[0]
        gameState.result = GameResult.Win
        gameState.winningPlayerIds = [winner.playerId]
        gameState.activePlayerIds = []
    }

    onAction(action: EndOfGameAction, context: MachineContext<HydratedBusGameState>): MachineState {
        switch (true) {
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
