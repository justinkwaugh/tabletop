import { MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { DrawingCardsStateHandler } from './drawingCards.js'
import { EffectType } from '../components/effects.js'

export function drawCardsOrEndTurn(
    state: HydratedSolGameState,
    context: MachineContext
): MachineState {
    const currentPlayerId = state.turnManager.currentTurn()?.playerId
    const playerState = state.getPlayerState(currentPlayerId)

    if (state.activeEffect === EffectType.Hyperdrive) {
        const energyGained = Math.floor(state.getEffectTracking().movementUsed / 3)
        playerState.energyCubes += energyGained
    }

    if (!state.cardsToDraw && playerState.drawnCards.length > 0) {
        if (!currentPlayerId) {
            throw Error('No current player')
        }
        return DrawingCardsStateHandler.handleDrawnCards(state, context, currentPlayerId)
    } else if (state.cardsToDraw && state.cardsToDraw > 0) {
        return MachineState.DrawingCards
    } else {
        state.turnManager.endTurn(state.actionCount)
        return MachineState.StartOfTurn
    }
}
