import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedLaunch, isLaunch } from '../actions/launch.js'
import { HydratedFly, isFly } from '../actions/fly.js'
import { HydratedHurl, isHurl } from '../actions/hurl.js'
import { HydratedConvert, isConvert } from '../actions/convert.js'

// Transition from StartOfTurn(Launch) -> Moving | TakingActions

type StartOfTurnAction = HydratedLaunch | HydratedFly | HydratedHurl

export class StartOfTurnStateHandler implements MachineStateHandler<StartOfTurnAction> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is StartOfTurnAction {
        if (!action.playerId) return false
        return (
            action.type === ActionType.Launch ||
            action.type === ActionType.Fly ||
            action.type === ActionType.Hurl ||
            action.type === ActionType.Convert
        )
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedSolGameState

        const validActions = []
        const actions = [ActionType.Launch, ActionType.Fly, ActionType.Hurl, ActionType.Convert]

        for (const action of actions) {
            switch (action) {
                case ActionType.Launch: {
                    if (HydratedLaunch.canLaunch(gameState, playerId)) {
                        validActions.push(ActionType.Launch)
                    }
                    break
                }
                case ActionType.Fly: {
                    if (HydratedFly.canFly(gameState, playerId)) {
                        validActions.push(ActionType.Fly)
                    }
                    break
                }
                case ActionType.Hurl: {
                    break
                }
                case ActionType.Convert: {
                    if (HydratedConvert.canConvert(gameState, playerId)) {
                        validActions.push(ActionType.Convert)
                    }
                    break
                }
            }
        }

        console.log('Valid actions', validActions)
        return validActions
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedSolGameState
        gameState.advanceMothership(gameState.activePlayerIds[0])
        const nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
        gameState.activePlayerIds = [nextPlayerId]
        const playerState = gameState.getPlayerState(nextPlayerId)
        playerState.movementPoints = playerState.movement
    }

    onAction(action: StartOfTurnAction, context: MachineContext): MachineState {
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
            case isConvert(action): {
                gameState.turnManager.endTurn(gameState.actionCount)
                return MachineState.StartOfTurn
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
