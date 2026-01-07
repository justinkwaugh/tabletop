import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSampleGameState } from '../model/gameState.js'
import { HydratedAddAmount, isAddAmount } from '../actions/addAmount.js'
import { HydratedPass, isPass } from '../actions/pass.js'

// You can make a union type here of multiple actions if desired
type StartOfTurnAction = HydratedAddAmount | HydratedPass

// State handler for the StartOfTurn state.  The main purposes of a state handler are to
// define what actions are valid in this state, handle entering the state, and provide
// a new state after an action has happened.
export class StartOfTurnStateHandler implements MachineStateHandler<StartOfTurnAction> {
    // Type guard to ensure action is one of the valid types for this state
    isValidAction(action: HydratedAction, context: MachineContext): action is StartOfTurnAction {
        // Types are not the only thing that has to be checked here
        if (!action.playerId) return false

        return action.type === ActionType.Pass || action.type === ActionType.AddAmount
    }

    // This returns the valid action type names for the given player in this state.
    // it is used by the UI to show valid options, and by the engine to validate actions.
    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedSampleGameState

        // Always can pass
        const validActions = [ActionType.Pass]

        // Check to see if the player can do the AddAmount
        if (HydratedAddAmount.canDoAddAmount(gameState, playerId)) {
            validActions.push(ActionType.AddAmount)
        }

        return validActions
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedSampleGameState

        // This would be a good place to reset turn-specific flags on the state
        // if there were any

        // Now start the next turn and set the active player
        const nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
        gameState.activePlayerIds = [nextPlayerId]

        // Maybe modify the player state for the new active player
        const playerState = gameState.getPlayerState(nextPlayerId)
        playerState.addAmount(5) // Give some amount at start of turn
    }

    onAction(action: StartOfTurnAction, context: MachineContext): MachineState {
        switch (true) {
            case isAddAmount(action): {
                const state = context.gameState as HydratedSampleGameState
                // Check to see if this action ends the game
                if (state.total === state.maxTotal) {
                    return MachineState.EndOfGame
                }

                // Otherwise go back to start of turn for the next player
                return MachineState.StartOfTurn
            }
            case isPass(action): {
                // Passing just goes to the next player's turn
                return MachineState.StartOfTurn
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
