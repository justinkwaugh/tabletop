import { assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import type { FollowUp } from '../model/flow.js'
import { nextOpenFollowUp } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

/** R-3.2 The state that decides each follow-up. A new kind is one row here and one in `FollowUp`. */
const FollowUpStates: Readonly<Record<FollowUp['kind'], MachineState>> = {
    'keep-writs': MachineState.KeepingWrits,
    reeve: MachineState.PlacingDisc,
    military: MachineState.PlacingDisc,
    voyage: MachineState.PlacingDisc
}

function holdsCards(state: HydratedFeudumGameState, playerId: string): boolean {
    return state.getPlayerState(playerId).handCount > 0
}

/** R-3.2, R-3.2-H1 Clockwise, skipping seats with no cards. Nobody left: no turn. */
function passTurn(state: HydratedFeudumGameState): void {
    const { turnManager, actionCount } = state
    turnManager.endTurn(actionCount)
    const anyLeft = turnManager.turnOrder.some((playerId) => holdsCards(state, playerId))
    state.flow.turn = anyLeft
        ? {
              playerId: turnManager.startNextTurn(actionCount, (playerId) =>
                  holdsCards(state, playerId)
              ),
              secondCard: false,
              followUps: []
          }
        : undefined
}

/**
 * R-3.2, R-3.3-H1 Every Action that ends a step of the current card returns this from `onAction`:
 * its next open follow-up's state; with none left, a declared second card or the next seat.
 */
export function stateAfterCardStep(state: HydratedFeudumGameState): MachineState {
    const followUp = nextOpenFollowUp(state)
    if (followUp) {
        return FollowUpStates[followUp.kind]
    }
    assertExists(state.flow.turn, 'R-3.2 A card step belongs to a turn')
    if (!state.flow.turn.secondCard) {
        passTurn(state)
    }
    return MachineState.PlayingCards
}

/** R-3.2 With no turn open, the first seat in turn order holding a card begins. */
export function askCardTurn(state: HydratedFeudumGameState): void {
    if (!state.flow.turn) {
        const { turnManager, actionCount } = state
        const first = turnManager.turnOrder.find((playerId) => holdsCards(state, playerId))
        if (first) {
            turnManager.startTurn(first, actionCount)
            state.flow.turn = { playerId: first, secondCard: false, followUps: [] }
        }
    }
    state.activePlayerIds = state.flow.turn ? [state.flow.turn.playerId] : []
}
