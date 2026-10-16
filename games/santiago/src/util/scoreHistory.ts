import { GameEngine, type GameAction } from '@tabletop/common'
import { SantiagoRuntime } from '../definition/runtime.js'
import type { SantiagoProjectedState } from '../model/gameState.js'
import { isEndRoundEvent } from '../actions/endRoundEvent.js'
import { calculateTotalScores, type PlayerMoney, type PlayerScores } from './scoring.js'

export type PlayerRoundScores = {
    playerId: string
    scores: number[]
}

export function roundScoreHistory(
    finalState: SantiagoProjectedState,
    actions: readonly GameAction[]
): PlayerRoundScores[] | undefined {
    const engine = new GameEngine(SantiagoRuntime)
    const roundEndScores: PlayerScores[] = []
    let state = finalState
    for (const action of actions.toReversed()) {
        if (isEndRoundEvent(action)) {
            const scores = totalScores(state)
            if (!scores) return undefined
            roundEndScores.unshift(scores)
            if (roundEndScores.length === finalState.round) break
        }
        if (!action.undoPatch) return undefined
        state = engine.undoProcessedAction({ state, action })
    }
    if (roundEndScores.length !== finalState.round) return undefined
    return finalState.players.map(({ playerId }) => ({
        playerId,
        scores: roundEndScores.map((scores) => scores[playerId])
    }))
}

function totalScores(state: SantiagoProjectedState): PlayerScores | undefined {
    const players: PlayerMoney[] = state.players.flatMap(({ playerId, money }) =>
        money === undefined ? [] : [{ playerId, money }]
    )
    if (players.length < state.players.length) return undefined
    return calculateTotalScores(state.board, players)
}
