import type { GameAction } from '@tabletop/common'
import { describeAction, type ActionLine, type NameOf } from './describeAction.js'

export type HistoryLine = ActionLine & { key: string }

export type HistoryEntry = {
    key: string
    playerId: string
    lines: HistoryLine[]
    lastAt?: Date
}

function createdAt(action: GameAction): Date | undefined {
    return action.createdAt
}

// A player's placements in a row are one turn, whichever pieces they were.
export function historyEntries(actions: GameAction[], nameOf: NameOf): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    for (const action of actions) {
        const line = describeAction(action, nameOf)
        if (!line || !action.playerId) {
            continue
        }
        const latest = entries.at(-1)
        const entry =
            latest?.playerId === action.playerId
                ? latest
                : {
                      key: action.id,
                      playerId: action.playerId,
                      lines: []
                  }
        if (entry !== latest) {
            entries.push(entry)
        }
        entry.lines.push({ ...line, key: action.id })
        entry.lastAt = createdAt(action)
    }
    return entries
}
