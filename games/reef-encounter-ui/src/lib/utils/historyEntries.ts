import type { GameAction } from '@tabletop/common'
import { isEndGame } from '@tabletop/reef-encounter'

export type HistoryEntry = {
    // The player whose turn or setup choice this is; absent for the game's end.
    playerId?: string
    actions: GameAction[]
    firstActionIndex: number
    lastActionIndex: number
}

// One entry per stretch of actions by one player, with the system actions they caused (such as
// the open-sea refill) joining that player's entry; the game's end stands alone.
export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    actions.forEach((action, index) => {
        const current = entries.at(-1)
        const joinsCurrent =
            current !== undefined &&
            !isEndGame(action) &&
            (action.playerId === undefined || action.playerId === current.playerId)
        if (joinsCurrent) {
            current.actions.push(action)
            current.lastActionIndex = index
            return
        }
        entries.push({
            playerId: isEndGame(action) ? undefined : action.playerId,
            actions: [action],
            firstActionIndex: index,
            lastActionIndex: index
        })
    })
    return entries
}
