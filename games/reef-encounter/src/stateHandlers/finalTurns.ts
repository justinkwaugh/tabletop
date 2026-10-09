import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'
import { HydratedEatCoral, isEatCoral } from '../actions/eatCoral.js'
import { HydratedPassFinalTurn, isPassFinalTurn } from '../actions/passFinalTurn.js'
import { EndGame } from '../actions/endGame.js'
import { newTurnRecord } from '../model/turn.js'
import { activateTurnPlayer } from '../util/turns.js'

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

    enter(context: MachineContext<HydratedReefEncounterGameState>) {
        activateTurnPlayer(context.gameState)
    }

    onAction(
        action: FinalTurnAction,
        context: MachineContext<HydratedReefEncounterGameState>
    ): MachineState {
        const gameState = context.gameState
        gameState.turnManager.endTurn(gameState.actionCount)
        gameState.turn = newTurnRecord()
        if (gameState.nextInTurnOrder(action.playerId) === gameState.endingPlayerId) {
            context.addSystemAction(EndGame, { revealsInfo: true })
            return MachineState.EndingGame
        }
        return MachineState.FinalTurns
    }
}
