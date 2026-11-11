import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'
import { HydratedEatCoral, isEatCoral } from '../actions/eatCoral.js'
import { HydratedPassFinalTurn, isPassFinalTurn, PassFinalTurn } from '../actions/passFinalTurn.js'
import { EndGame } from '../actions/endGame.js'

type FinalTurnAction = HydratedEatCoral | HydratedPassFinalTurn

// After the game ends by locked tiles or eaten shrimps, every other player in turn order may
// have one more turn, in which they may only eat a coral (rulebook p. 11).
export class FinalTurnsStateHandler implements MachineStateHandler<
    FinalTurnAction,
    HydratedReefEncounterGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedReefEncounterGameState>
    ): action is FinalTurnAction {
        const gameState = context.gameState
        if (!gameState.activePlayerIds.includes(action.playerId ?? '')) {
            return false
        }
        if (isEatCoral(action)) {
            return gameState.canEatCoral(action.playerId, {
                boardId: action.boardId,
                coords: action.coords
            })
        }
        return isPassFinalTurn(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedReefEncounterGameState>
    ): ActionType[] {
        const gameState = context.gameState
        if (!gameState.activePlayerIds.includes(playerId)) {
            return []
        }
        return gameState.hasEdibleCoral(playerId)
            ? [ActionType.EatCoral, ActionType.PassFinalTurn]
            : [ActionType.PassFinalTurn]
    }

    // A player whose shrimps guard no coral that would score passes without being asked.
    enter(context: MachineContext<HydratedReefEncounterGameState>) {
        const gameState = context.gameState
        gameState.activateTurnPlayer()
        const playerId = gameState.turnPlayerId()
        if (!gameState.hasScoringCoral(playerId)) {
            context.addSystemAction(PassFinalTurn, { playerId })
        }
    }

    onAction(
        action: FinalTurnAction,
        context: MachineContext<HydratedReefEncounterGameState>
    ): MachineState {
        const gameState = context.gameState
        gameState.finishTurn()
        if (gameState.turnManager.nextPlayer(action.playerId) === gameState.endingPlayerId) {
            context.addSystemAction(EndGame, { revealsInfo: true })
            return MachineState.EndingGame
        }
        return MachineState.FinalTurns
    }
}
