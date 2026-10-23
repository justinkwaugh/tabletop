import { RecordedHistory, Visibility, type GameAction } from '@tabletop/common'
import { isAdvanceResolution, type LowenherzProjectedState } from '@tabletop/lowenherz'

export type PlayerScoreHistory = {
    playerId: string
    scores: number[]
}

type PowerPoints = Record<string, number>

export function powerPointHistory(
    finalState: LowenherzProjectedState,
    actions: readonly GameAction[]
): PlayerScoreHistory[] | undefined {
    // Projection replaces actions it cannot reverse with redacted records, which hide their round ends.
    if (actions.some(Visibility.isRedactedAction)) return undefined
    const pointsAfter = new RecordedHistory(finalState, actions).select(powerPoints)
    const checkpoints: PowerPoints[] = []
    for (const action of actions) {
        if (!isRoundEnd(action)) continue
        const points = pointsAfter.get(action.id)?.after
        if (!points) return undefined
        checkpoints.push(points)
    }
    checkpoints.push(powerPoints(finalState))
    return finalState.players.map(({ playerId }) => ({
        playerId,
        scores: checkpoints.map((points) => points[playerId])
    }))
}

function isRoundEnd(action: GameAction): boolean {
    return isAdvanceResolution(action) && action.metadata?.roundAdvanced === true
}

function powerPoints(state: Readonly<LowenherzProjectedState>): PowerPoints {
    return Object.fromEntries(
        state.players.map(({ playerId, powerPoints }) => [playerId, powerPoints])
    )
}
