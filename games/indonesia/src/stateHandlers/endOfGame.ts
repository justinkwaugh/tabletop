import {
    GameResult,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'

type EndOfGameAction = HydratedAction

export class EndOfGameStateHandler implements MachineStateHandler<
    EndOfGameAction,
    HydratedIndonesiaGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): action is EndOfGameAction {
        // Leave this comment if you want the template to generate code for valid actions
        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        const gameState = context.gameState
        gameState.activePlayerIds = []

        if (gameState.phaseManager.currentPhase?.name !== PhaseName.NewEra) {
            gameState.phaseManager.startPhase(PhaseName.NewEra, gameState.actionCount)
        }

        let winnerId: string | undefined
        let winnerTotal = Number.NEGATIVE_INFINITY
        for (const playerId of gameState.turnManager.turnOrder) {
            const player = gameState.getPlayerState(playerId)
            const total = player.cash + player.bank
            if (total > winnerTotal) {
                winnerTotal = total
                winnerId = playerId
            }
        }

        if (!winnerId) {
            gameState.result = GameResult.Draw
            gameState.winningPlayerIds = []
            return
        }

        gameState.result = GameResult.Win
        gameState.winningPlayerIds = [winnerId]
    }

    onAction(
        action: EndOfGameAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): MachineState {
        switch (true) {
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
