import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedActivateEffect, isActivateEffect } from '../actions/activateEffect.js'
import { HydratedChooseMove, isChooseMove } from '../actions/chooseMove.js'
import { HydratedFly } from '../actions/fly.js'
import { HydratedHurl } from '../actions/hurl.js'
import { HydratedLaunch } from '../actions/launch.js'
import { HydratedChooseConvert, isChooseConvert } from '../actions/chooseConvert.js'
import { HydratedConvert } from '../actions/convert.js'
import { HydratedChooseActivate, isChooseActivate } from '../actions/chooseActivate.js'
import { HydratedActivate } from '../actions/activate.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedInvade } from '../actions/invade.js'
import { EffectType } from '../components/effects.js'
import { HydratedSacrifice } from '../actions/sacrifice.js'

// Transition from StartOfTurn(Pass) -> StartOfTurn
// Transition from StartOfTurn(ChooseMove) -> Moving
// Transition from StartOfTurn(ChooseActivate) -> Activating
// Transition from StartOfTurn(ChooseConvert) -> Converting
// Transition from StartOfTurn(ActivateEffect) -> ActivatedEffect

type StartOfTurnAction =
    | HydratedChooseMove
    | HydratedChooseConvert
    | HydratedChooseActivate
    | HydratedActivateEffect
    | HydratedPass

export class StartOfTurnStateHandler implements MachineStateHandler<StartOfTurnAction> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is StartOfTurnAction {
        if (!action.playerId) return false
        return (
            action.type === ActionType.Pass ||
            action.type === ActionType.ChooseMove ||
            action.type === ActionType.ChooseConvert ||
            action.type === ActionType.ChooseActivate ||
            action.type === ActionType.ActivateEffect
        )
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedSolGameState
        const validActions = [ActionType.Pass]

        if (HydratedActivateEffect.canActivateHeldEffect(gameState, playerId)) {
            validActions.push(ActionType.ActivateEffect)
        }

        if (
            HydratedLaunch.canLaunch(gameState, playerId) ||
            HydratedFly.canFly(gameState, playerId) ||
            HydratedHurl.canHurl(gameState, playerId)
        ) {
            validActions.push(ActionType.ChooseMove)
        }

        if (
            HydratedConvert.canConvert(gameState, playerId) ||
            (gameState.playerHasCardForEffect(playerId, EffectType.Invade) &&
                HydratedInvade.canInvade(gameState, playerId)) ||
            (gameState.playerHasCardForEffect(playerId, EffectType.Sacrifice) &&
                HydratedSacrifice.canSacrifice(gameState))
        ) {
            validActions.push(ActionType.ChooseConvert)
        }

        if (
            HydratedActivate.canActivate(gameState, playerId) ||
            (gameState.playerHasCardForEffect(playerId, EffectType.Pulse) &&
                HydratedActivate.canPulse(gameState, playerId))
        ) {
            validActions.push(ActionType.ChooseActivate)
        }

        console.log('Valid actions', validActions)
        return validActions
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedSolGameState

        const preHatchState = gameState.getEffectTracking()?.preHatchState
        if (preHatchState === MachineState.StartOfTurn) {
            // If hatch came from here.. just clear it and don't reset the turn
            gameState.getEffectTracking().preHatchState = undefined
            return
        }

        gameState.hurled = false
        gameState.moved = false
        gameState.activation = undefined
        gameState.solarFlareActivations = []
        gameState.paidPlayerIds = []
        gameState.activeEffect = undefined
        gameState.effectTracking = undefined

        const lastPlayerId = gameState.turnManager.lastPlayer()
        if (lastPlayerId) {
            gameState.advanceMothership(lastPlayerId)
        }

        const nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
        gameState.activePlayerIds = [nextPlayerId]
        const playerState = gameState.getPlayerState(nextPlayerId)
        playerState.movementPoints = playerState.movement
    }

    onAction(action: StartOfTurnAction, context: MachineContext): MachineState {
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
            case isActivateEffect(action): {
                if (action.effect === EffectType.Hatch) {
                    return MachineState.Hatching
                }
                return MachineState.ActivatedEffect
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
