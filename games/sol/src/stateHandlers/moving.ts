import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedLaunch, isLaunch } from '../actions/launch.js'
import { HydratedFly, isFly } from '../actions/fly.js'
import { HydratedHurl, isHurl } from '../actions/hurl.js'

// Transition from Moving(Launch) -> Moving | StartOfTurn
// Transition from Moving(Fly) -> Moving | StartOfTurn
// Transition from Moving(Hurl) -> Moving | StartOfTurn

type MovingAction = HydratedLaunch | HydratedFly | HydratedHurl

export class MovingStateHandler implements MachineStateHandler<MovingAction> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is MovingAction {
        if (!action.playerId) return false
        return (
            action.type === ActionType.Launch ||
            action.type === ActionType.Fly ||
            action.type === ActionType.Hurl
        )
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedSolGameState

        const validActions = []
        const actions = [ActionType.Launch, ActionType.Fly, ActionType.Hurl]

        for (const action of actions) {
            switch (action) {
                case ActionType.Launch: {
                    if (HydratedLaunch.canLaunch(gameState, playerId)) {
                        validActions.push(ActionType.Launch)
                    }
                    break
                }
                case ActionType.Fly: {
                    break
                }
                case ActionType.Hurl: {
                    break
                }
            }
        }

        console.log('Valid moving actions', validActions)
        return validActions
    }

    enter(_context: MachineContext) {}

    onAction(action: MovingAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState
        const playerState = gameState.getPlayerState(action.playerId)

        switch (true) {
            case isLaunch(action): {
                if (playerState.movementPoints > 0) {
                    return MachineState.Moving
                } else {
                    gameState.turnManager.endTurn(gameState.actionCount)
                    return MachineState.StartOfTurn
                }
            }
            case isFly(action): {
                if (playerState.movementPoints > 0) {
                    return MachineState.Moving
                } else {
                    gameState.turnManager.endTurn(gameState.actionCount)
                    return MachineState.StartOfTurn
                }
            }
            case isHurl(action): {
                if (playerState.movementPoints > 0) {
                    return MachineState.Moving
                } else {
                    gameState.turnManager.endTurn(gameState.actionCount)
                    return MachineState.StartOfTurn
                }
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
