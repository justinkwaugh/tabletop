import { RecordedHistory, type GameAction } from '@tabletop/common'
import {
    calculateTotalScores,
    isEndRoundEvent,
    type PlayerMoney,
    type PlayerScores,
    type SantiagoProjectedState
} from '@tabletop/santiago'

export type PlayerRoundScores = {
    playerId: string
    scores: number[]
}

export function roundScoresFromHistory(
    finalState: SantiagoProjectedState,
    actions: readonly GameAction[]
): PlayerRoundScores[] | undefined {
    const totalsAfter = new RecordedHistory(finalState, actions).select(totalScores)
    const roundEndScores: PlayerScores[] = []
    for (const action of actions) {
        if (!isEndRoundEvent(action)) continue
        const scores = totalsAfter.get(action.id)?.after
        if (!scores) return undefined
        roundEndScores.push(scores)
    }
    // Projection replaces actions it cannot reverse with redacted records, which hide their round ends.
    if (roundEndScores.length !== finalState.round) return undefined
    return finalState.players.map(({ playerId }) => ({
        playerId,
        scores: roundEndScores.map((scores) => scores[playerId])
    }))
}

function totalScores(state: Readonly<SantiagoProjectedState>): PlayerScores | undefined {
    const players: PlayerMoney[] = state.players.flatMap(({ playerId, money }) =>
        money === undefined ? [] : [{ playerId, money }]
    )
    if (players.length < state.players.length) return undefined
    return calculateTotalScores(state.board, players)
}
