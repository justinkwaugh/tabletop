import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedLaunch, isLaunch } from '../actions/launch.js'
import { HydratedFly, isFly } from '../actions/fly.js'
import { HydratedHurl, isHurl } from '../actions/hurl.js'
import { HydratedConvert, isConvert } from '../actions/convert.js'
import { HydratedActivate, isActivate } from '../actions/activate.js'
import { HydratedActivateBonus } from '../actions/activateBonus.js'

// Transition from StartOfTurn(Launch) -> Moving | TakingActions
// Transition from StartOfTurn(Fly) -> Moving | TakingActions
// Transition from StartOfTurn(Hurl) -> Moving | TakingActions ???
// Transition from StartOfTurn(Convert) -> StartOfTurn
// Transition from StartOfTurn(Activate) -> Activating | StartOfTurn

type StartOfTurnAction =
    | HydratedLaunch
    | HydratedFly
    | HydratedHurl
    | HydratedConvert
    | HydratedActivate

export class StartOfTurnStateHandler implements MachineStateHandler<StartOfTurnAction> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is StartOfTurnAction {
        if (!action.playerId) return false
        return (
            action.type === ActionType.Launch ||
            action.type === ActionType.Fly ||
            action.type === ActionType.Hurl ||
            action.type === ActionType.Convert ||
            action.type === ActionType.Activate
        )
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedSolGameState

        const validActions = []
        const actions = [
            ActionType.Launch,
            ActionType.Fly,
            ActionType.Hurl,
            ActionType.Convert,
            ActionType.Activate
        ]

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
                case ActionType.Activate: {
                    if (HydratedActivate.canActivate(gameState, playerId)) {
                        validActions.push(ActionType.Activate)
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
        const lastPlayerId = gameState.turnManager.lastPlayer()
        if (!lastPlayerId) {
            throw Error('Cannot find last player')
        }
        gameState.advanceMothership(lastPlayerId)
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
                // Need to do more things here w/ card drawing and such
                gameState.turnManager.endTurn(gameState.actionCount)
                return MachineState.StartOfTurn
            }
            case isActivate(action): {
                const station = gameState.getActivatingStation()
                const activation = gameState.activation
                if (!activation) {
                    throw Error('No activation found')
                }

                if (HydratedActivateBonus.canActivateBonus(gameState, station.playerId)) {
                    // Give station owner chance to do bonus activation
                    gameState.activePlayerIds = [station.playerId]
                    return MachineState.Activating
                } else if (
                    action.playerId !== station.playerId &&
                    HydratedActivateBonus.canActivateBonus(gameState, action.playerId)
                ) {
                    // Give activating player a chance to do bonus activation
                    gameState.activePlayerIds = [activation.playerId]
                    return MachineState.Activating
                } else if (HydratedActivate.canActivate(gameState, activation.playerId)) {
                    // Allow activating player to continue if possible
                    activation.currentStationId = undefined
                    activation.currentStationCoords = undefined
                    gameState.activePlayerIds = [activation.playerId]
                    return MachineState.Activating
                } else {
                    // No more activations possible, end turn
                    gameState.activation = undefined
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
