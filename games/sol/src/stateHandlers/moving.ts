import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedLaunch, isLaunch } from '../actions/launch.js'
import { HydratedFly, isFly } from '../actions/fly.js'
import { HydratedHurl, isHurl } from '../actions/hurl.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { drawCardsOrEndTurn, onActivateEffect } from './postActionHelper.js'
import { HydratedActivateEffect, isActivateEffect } from '../actions/activateEffect.js'
import { HydratedFuel, isFuel } from '../actions/fuel.js'
import { EffectType } from '../components/effects.js'

// Transition from Moving(Launch) -> Moving | StartOfTurn
// Transition from Moving(Fly) -> Moving | StartOfTurn
// Transition from Moving(Hurl) -> Moving | StartOfTurn
// Transition from Moving(Pass) -> StartOfTurn
// Transition from Moving(ActivateEffect) -> Moving

type MovingAction =
    | HydratedLaunch
    | HydratedFly
    | HydratedHurl
    | HydratedPass
    | HydratedActivateEffect
    | HydratedFuel

export class MovingStateHandler implements MachineStateHandler<MovingAction> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is MovingAction {
        if (!action.playerId) return false
        return (
            action.type === ActionType.Launch ||
            action.type === ActionType.Fly ||
            action.type === ActionType.Hurl ||
            action.type === ActionType.Pass ||
            action.type === ActionType.ActivateEffect ||
            action.type === ActionType.Fuel
        )
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedSolGameState

        const validActions = [ActionType.Pass]
        const actions = [
            ActionType.Launch,
            ActionType.Fly,
            ActionType.Hurl,
            ActionType.ActivateEffect
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
                    if (HydratedHurl.canHurl(gameState, playerId)) {
                        validActions.push(ActionType.Hurl)
                    }
                    break
                }
                case ActionType.ActivateEffect: {
                    if (HydratedActivateEffect.canActivateHeldEffect(gameState, playerId)) {
                        validActions.push(ActionType.ActivateEffect)
                    }
                    break
                }
            }
        }

        if (HydratedFuel.canFuel(gameState, playerId)) {
            validActions.push(ActionType.Fuel)
        }

        console.log('Valid moving actions', validActions)
        return validActions
    }

    enter(_context: MachineContext) {}

    onAction(action: MovingAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState
        const playerState = gameState.getPlayerState(action.playerId)

        switch (true) {
            case isLaunch(action):
            case isFly(action):
            case isHurl(action): {
                if (
                    HydratedFly.canFly(gameState, action.playerId) ||
                    HydratedLaunch.canLaunch(gameState, action.playerId)
                ) {
                    return MachineState.Moving
                } else if (
                    HydratedActivateEffect.canActivateEffect(
                        gameState,
                        action.playerId,
                        EffectType.Chain
                    )
                ) {
                    return MachineState.CheckEffect
                } else {
                    return drawCardsOrEndTurn(gameState, context)
                }
            }
            case isFuel(action): {
                return MachineState.Moving
            }
            case isPass(action): {
                return drawCardsOrEndTurn(gameState, context)
            }
            case isActivateEffect(action): {
                return onActivateEffect(action, context)
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
