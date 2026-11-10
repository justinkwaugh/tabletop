import type { GameAction } from '@tabletop/common'
import { isEndHand, PackPoints, type HandResult } from '@tabletop/koenigrufen'

export type ScoreSheet = {
    hands: HandResult[]
    totals: Record<string, number>
}

export function handResults(actions: readonly GameAction[]): HandResult[] {
    return actions.flatMap((action) =>
        isEndHand(action) && action.metadata ? [action.metadata] : []
    )
}

export function scoreSheet(
    actions: readonly GameAction[],
    playerIds: readonly string[]
): ScoreSheet {
    const hands = handResults(actions)
    const totals = Object.fromEntries(
        playerIds.map((playerId) => [
            playerId,
            hands.reduce((sum, hand) => sum + (hand.scoreChanges[playerId] ?? 0), 0)
        ])
    )
    return { hands, totals }
}

export function declarerSide(result: HandResult): string[] {
    return result.partnerId ? [result.declarerId, result.partnerId] : [result.declarerId]
}

export function defenderPoints(result: HandResult): number {
    return PackPoints - result.declarerPoints
}
