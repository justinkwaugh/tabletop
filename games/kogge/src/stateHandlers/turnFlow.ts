import { MachineState } from '../definition/states.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'

export function finishTurn(state: HydratedKoggeGameState): MachineState {
    const isLastTurn = state.isLastTurnOfRound()
    state.turnManager.endTurn(state.actionCount)
    delete state.turn
    delete state.raid
    if (isLastTurn) {
        state.rounds.endRound(state.actionCount)
        return MachineState.StartingRound
    }
    state.turnIndex += 1
    return MachineState.TakingTurn
}

export function finishGameDuringTurn(state: HydratedKoggeGameState): MachineState {
    state.turnManager.endTurn(state.actionCount)
    state.rounds.endRound(state.actionCount)
    delete state.turn
    return MachineState.EndOfGame
}
