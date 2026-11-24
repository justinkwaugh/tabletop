import type { GameAction, Round } from '@tabletop/common'
import { isShip } from '@tabletop/locomotive-werks'

export type HistoryTurn = {
    kind: 'turn'
    key: string
    playerId: string
    actions: GameAction[]
}

export type HistorySystem = {
    kind: 'system'
    key: string
    action: GameAction
}

export type HistoryRound = {
    kind: 'round'
    key: string
    number: number
    // The last action before the next round, where a jump shows the round as it ended.
    lastIndex?: number
}

export type HistoryEntry = HistoryTurn | HistorySystem | HistoryRound

// Groups actions oldest first: a player's consecutive actions make one turn, including any shipping
// done for them automatically, each step of the game itself stands alone, and each round opens with
// a marker.
export function historyEntries(
    actions: readonly GameAction[],
    rounds: readonly Round[]
): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    let open: HistoryTurn | undefined
    let nextRound = 0
    const openRoundsFrom = (index: number) => {
        while (nextRound < rounds.length && rounds[nextRound].start <= index) {
            const round = rounds[nextRound]
            entries.push({
                kind: 'round',
                key: `round-${round.number}`,
                number: round.number,
                lastIndex: round.end === undefined ? undefined : round.end - 1
            })
            open = undefined
            nextRound += 1
        }
    }
    for (const action of actions) {
        openRoundsFrom(action.index ?? 0)
        if (!action.playerId) {
            entries.push({ kind: 'system', key: action.id, action })
            open = undefined
            continue
        }
        if (open && open.playerId === action.playerId && !isShip(open.actions.at(-1))) {
            open.actions.push(action)
            continue
        }
        open = { kind: 'turn', key: action.id, playerId: action.playerId, actions: [action] }
        entries.push(open)
    }
    openRoundsFrom(Infinity)
    return entries
}
