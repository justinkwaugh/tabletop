import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedLaunch } from '../actions/launch.js'
import { HydratedFly } from '../actions/fly.js'
import { HydratedHurl } from '../actions/hurl.js'
import { HydratedConvert } from '../actions/convert.js'
import { HydratedActivate } from '../actions/activate.js'
import { HydratedChooseActivate, isChooseActivate } from '../actions/chooseActivate.js'
import { HydratedChooseConvert, isChooseConvert } from '../actions/chooseConvert.js'
import { HydratedChooseMove, isChooseMove } from '../actions/chooseMove.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { ActivateEffect } from '../actions/activateEffect.js'
import { EffectType } from '../components/effects.js'

type ActivatedEffectAction =
    | HydratedChooseMove
    | HydratedChooseConvert
    | HydratedChooseActivate
    | HydratedPass

export class ActivatedEffectStateHandler implements MachineStateHandler<ActivatedEffectAction> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext
    ): action is ActivatedEffectAction {
        if (!action.playerId) return false
        return (
            action.type === ActionType.Pass ||
            action.type === ActionType.ChooseMove ||
            action.type === ActionType.ChooseConvert ||
            action.type === ActionType.ChooseActivate
        )
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedSolGameState

        const validActions = [ActionType.Pass]

        if (
            HydratedLaunch.canLaunch(gameState, playerId) ||
            HydratedFly.canFly(gameState, playerId) ||
            HydratedHurl.canHurl(gameState, playerId)
        ) {
            validActions.push(ActionType.ChooseMove)
        }

        if (HydratedConvert.canConvert(gameState, playerId)) {
            validActions.push(ActionType.ChooseConvert)
        }

        if (HydratedActivate.canActivate(gameState, playerId)) {
            validActions.push(ActionType.ChooseActivate)
        }

        console.log('Valid actions', validActions)
        return validActions
    }

    enter(_context: MachineContext) {}

    onAction(action: ActivatedEffectAction, context: MachineContext): MachineState {
        switch (true) {
            case isPass(action): {
                return MachineState.StartOfTurn
            }
            case isChooseMove(action): {
                return MachineState.Moving
            }
            case isChooseConvert(action): {
                return MachineState.Converting
            }
            case isChooseActivate(action): {
                return MachineState.Activating
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
