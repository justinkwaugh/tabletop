import { GameAction, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { DrawingCardsStateHandler } from './drawingCards.js'
import { EffectType } from '../components/effects.js'
import { ActivateEffect } from '../actions/activateEffect.js'
import { isHurl } from '../actions/hurl.js'
import { isFly } from '../actions/fly.js'

export function drawCardsOrEndTurn(
    state: HydratedSolGameState,
    context: MachineContext,
    action?: GameAction
): MachineState {
    const currentPlayerId = state.turnManager.currentTurn()?.playerId
    const playerState = state.getPlayerState(currentPlayerId)

    if (state.activeEffect === EffectType.Hyperdrive) {
        const energyGained = Math.floor(state.getEffectTracking().movementUsed / 3)
        playerState.energyCubes += energyGained

        if ((isFly(action) || isHurl(action)) && action.metadata) {
            action.metadata.energyGained = energyGained
        }
    }

    if (!state.cardsToDraw && playerState.drawnCards.length > 0) {
        if (!currentPlayerId) {
            throw Error('No current player')
        }
        return DrawingCardsStateHandler.handleDrawnCards(state, context, currentPlayerId)
    } else if (state.cardsToDraw && state.cardsToDraw > 0) {
        if (state.playerHasCardForEffect(playerState.playerId, EffectType.Pillar)) {
            return MachineState.CheckEffect
        }
        return MachineState.DrawingCards
    } else {
        state.turnManager.endTurn(state.actionCount)
        return MachineState.StartOfTurn
    }
}

export function onActivateEffect(action: ActivateEffect, context: MachineContext): MachineState {
    if (action.effect === EffectType.Hatch) {
        return MachineState.Hatching
    } else if (action.effect === EffectType.Accelerate) {
        return MachineState.Accelerating
    } else if (action.effect === EffectType.Tribute) {
        return MachineState.Tributing
    } else if (action.effect === EffectType.Chain) {
        return MachineState.Chaining
    }

    const state = context.gameState as HydratedSolGameState
    return state.machineState
}
