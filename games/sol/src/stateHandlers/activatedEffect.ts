import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedLaunch, isLaunch } from '../actions/launch.js'
import { HydratedFly, isFly } from '../actions/fly.js'
import { HydratedHurl, isHurl } from '../actions/hurl.js'
import { HydratedConvert, isConvert } from '../actions/convert.js'
import { HydratedActivate, isActivate } from '../actions/activate.js'
import { ActivatingStateHandler } from './activating.js'
import { drawCardsOrEndTurn } from './postActionHelper.js'

// Transition from ActivatedEffect(Launch) -> Moving | StartOfTurn
// Transition from ActivatedEffect(Fly) -> Moving | StartOfTurn
// Transition from ActivatedEffect(Hurl) -> Moving | StartOfTurn
// Transition from ActivatedEffect(Convert) -> StartOfTurn
// Transition from ActivatedEffect(Activate) -> Activating

type ActivatedEffectAction =
    | HydratedLaunch
    | HydratedFly
    | HydratedHurl
    | HydratedConvert
    | HydratedActivate

export class ActivatedEffectStateHandler implements MachineStateHandler<ActivatedEffectAction> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext
    ): action is ActivatedEffectAction {
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

    enter(_context: MachineContext) {}

    onAction(action: ActivatedEffectAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState
        const playerState = gameState.getPlayerState(action.playerId)

        switch (true) {
            case isLaunch(action):
            case isFly(action):
            case isHurl(action): {
                if (playerState.movementPoints > 0) {
                    return MachineState.Moving
                } else {
                    return drawCardsOrEndTurn(gameState, context)
                }
            }
            case isConvert(action): {
                return drawCardsOrEndTurn(gameState, context)
            }
            case isActivate(action): {
                return ActivatingStateHandler.handleActivation(gameState, action, context)
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
