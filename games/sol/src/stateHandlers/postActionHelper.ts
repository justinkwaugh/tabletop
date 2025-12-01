import { ActionSource, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { DrawCards } from '../actions/drawCards.js'
import { ActionType } from '../definition/actions.js'
import { nanoid } from 'nanoid'

export function drawCardsOrEndTurn(
    state: HydratedSolGameState,
    context: MachineContext
): MachineState {
    if (state.cardsToDraw && state.cardsToDraw > 0) {
        console.log('Drawing cards, cards left to draw:', state.cardsToDraw)
        // Add the card draw action here
        const drawCardsAction: DrawCards = {
            type: ActionType.DrawCards,
            id: nanoid(),
            gameId: context.gameState.gameId,
            playerId: context.gameState.activePlayerIds[0],
            source: ActionSource.System
        }
        context.addPendingAction(drawCardsAction)
        return MachineState.DrawingCards
    } else {
        state.turnManager.endTurn(state.actionCount)
        return MachineState.StartOfTurn
    }
}
