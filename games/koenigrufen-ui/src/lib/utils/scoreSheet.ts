import type { GameAction } from '@tabletop/common'
import { isEndHand, PackPoints, type HandResult } from '@tabletop/koenigrufen'

// One finished hand, numbered by its deal.
export type ScoreSheetRow = { hand: number; result: HandResult }

export type ScoreSheet = {
    // The finished hands the history on hand records, oldest first. A game opens before its
    // history loads, so the earliest may be missing; `complete` says whether any are.
    rows: ScoreSheetRow[]
    complete: boolean
    // From State, so they are right whatever history has loaded.
    totals: Record<string, number>
}

export function handResults(actions: readonly GameAction[]): HandResult[] {
    return actions.flatMap((action) =>
        isEndHand(action) && action.metadata ? [action.metadata] : []
    )
}

export function scoreSheet(
    actions: readonly GameAction[],
    players: readonly { playerId: string; score: number }[],
    handsFinished: number
): ScoreSheet {
    const recorded = handResults(actions)
    const hands = recorded.slice(Math.max(0, recorded.length - handsFinished))
    const first = handsFinished - hands.length + 1
    return {
        rows: hands.map((result, index) => ({ hand: first + index, result })),
        complete: hands.length === handsFinished,
        totals: Object.fromEntries(players.map((player) => [player.playerId, player.score]))
    }
}

export function declarerSide(result: HandResult): string[] {
    return result.partnerId ? [result.declarerId, result.partnerId] : [result.declarerId]
}

export function defenderPoints(result: HandResult): number {
    return PackPoints - result.declarerPoints
}
