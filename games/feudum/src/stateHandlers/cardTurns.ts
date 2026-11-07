import { assertExists, type MachineContext } from '@tabletop/common'
import {
    AdvanceTurn,
    holdsCards,
    type AdvanceTurnMetadata,
    type HydratedAdvanceTurn
} from '../actions/advanceTurn.js'
import { NourishPawns } from '../actions/nourishPawns.js'
import { MachineState } from '../definition/states.js'
import type { FollowUp } from '../model/flow.js'
import { nextOpenFollowUp } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

/** R-3.2 The state that decides each follow-up. A new kind is one row here and one in `FollowUp`. */
const FollowUpStates: Readonly<Record<FollowUp['kind'], MachineState>> = {
    'keep-writs': MachineState.KeepingWrits,
    reeve: MachineState.PlacingDisc,
    military: MachineState.PlacingDisc,
    voyage: MachineState.PlacingDisc,
    'inspect-harvest': MachineState.InspectingHarvest
}

/**
 * R-3.2 Every Action that ends a step of the current card returns this from `onAction`: its next
 * open follow-up's state; with none left, `AdvanceTurn` decides what comes next (R-3.3-H1, R-4.4.4).
 */
export function stateAfterCardStep(context: MachineContext<HydratedFeudumGameState>): MachineState {
    const followUp = nextOpenFollowUp(context.gameState)
    if (followUp) {
        return FollowUpStates[followUp.kind]
    }
    assertExists(context.gameState.flow.turn, 'R-3.2 A card step belongs to a turn')
    context.addSystemAction(AdvanceTurn)
    return MachineState.PlayingCards
}

/** R-3.2, R-3.3-H1, R-4.4.4 What each outcome of `AdvanceTurn` leads to. */
const StatesAfterAdvance: Readonly<Record<AdvanceTurnMetadata['outcome'], MachineState>> = {
    'second-card': MachineState.PlayingCards,
    'writ-limit': MachineState.DiscardingWrits,
    'next-seat': MachineState.PlayingCards,
    'last-card': MachineState.Nourishing
}

/**
 * The outcome and not the writ count decides: a seat newly on turn may be over the limit, and it
 * plays first (R-4.4.4). After the last card the game feeds every seat without a choice (R-4.10, D11).
 */
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
            state.flow.turn = { playerId: first, secondCard: false, followUps: [] }
        }
    }
    state.activePlayerIds = state.flow.turn ? [state.flow.turn.playerId] : []
}
