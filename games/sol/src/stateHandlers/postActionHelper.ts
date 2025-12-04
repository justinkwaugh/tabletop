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
        return MachineState.DrawingCards
    } else {
        state.turnManager.endTurn(state.actionCount)
        return MachineState.StartOfTurn
    }
}
