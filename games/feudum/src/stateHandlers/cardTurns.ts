import { assertExists, type MachineContext } from '@tabletop/common'
import {
    AdvanceTurn,
    holdsCards,
    type AdvanceTurnMetadata,
    type HydratedAdvanceTurn
} from '../actions/advanceTurn.js'
import { NourishPawns } from '../actions/nourishPawns.js'
import { MachineState } from '../definition/states.js'
import { seatOverLimit } from '../model/atWill.js'
import type { FollowUp } from '../model/flow.js'
import { nextOpenFollowUp } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { cardTurnSeat } from '../model/turns.js'

/** R-3.2 The state that decides each follow-up. A new kind is one row here and one in `FollowUp`. */
const FollowUpStates: Readonly<Record<FollowUp['kind'], MachineState>> = {
    'keep-writs': MachineState.KeepingWrits,
    reeve: MachineState.PlacingDisc,
    military: MachineState.PlacingDisc,
    voyage: MachineState.PlacingDisc,
    'inspect-harvest': MachineState.InspectingHarvest
}

/** R-3.2, R-3.2-H2, R-4.4.4, R-3.3-H1 */
export function stateAfterCardStep(context: MachineContext<HydratedFeudumGameState>): MachineState {
    if (seatOverLimit(context.gameState)) {
        return MachineState.DiscardingWrits
    }
    const followUp = nextOpenFollowUp(context.gameState)
    if (followUp) {
        return FollowUpStates[followUp.kind]
    }
    assertExists(context.gameState.flow.turn, 'R-3.2 A card step belongs to a turn')
    context.addSystemAction(AdvanceTurn)
    return MachineState.PlayingCards
}

/** R-3.2, R-3.3-H1 */
const StatesAfterAdvance: Readonly<Record<AdvanceTurnMetadata['outcome'], MachineState>> = {
    'second-card': MachineState.PlayingCards,
    'next-seat': MachineState.PlayingCards,
    'last-card': MachineState.Nourishing
}

/** The outcome decides. After the last card the game feeds every seat without a choice (R-4.10, R-4.10-H4). */
export function stateAfterAdvance(
    { metadata }: HydratedAdvanceTurn,
    context: MachineContext<HydratedFeudumGameState>
): MachineState {
    assertExists(metadata, 'R-3.2 AdvanceTurn has been applied')
    if (metadata.outcome === 'last-card') {
        context.addSystemAction(NourishPawns)
    }
    return StatesAfterAdvance[metadata.outcome]
}

/** R-3.2 With no turn open, the first seat in turn order holding a card begins. */
export function askCardTurn(state: HydratedFeudumGameState): void {
    if (!state.flow.turn) {
        const { turnManager, actionCount } = state
        const first = turnManager.turnOrder.find((playerId) => holdsCards(state, playerId))
        if (first) {
            turnManager.startTurn(first, actionCount)
            state.flow.turn = { secondCard: false, followUps: [] }
        }
    }
    const seat = cardTurnSeat(state)
    state.activePlayerIds = seat ? [seat] : []
}
