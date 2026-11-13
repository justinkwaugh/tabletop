import type { GameAction } from '@tabletop/common'
import {
    isBuildTrack,
    isChooseAction,
    isPayDividends,
    type ActionBox,
    type RailroadId
} from '@tabletop/south-african-railroads'
import { actionSale } from './describeAction.js'

export type HistoryTurn = {
    kind: 'turn'
    key: string
    playerId: string
    box: ActionBox
    actions: GameAction[]
}

export type HistoryOffering = {
    kind: 'offering'
    key: string
    railroadId?: RailroadId
    actions: GameAction[]
}

export type HistoryDividend = {
    kind: 'dividend'
    key: string
    action: GameAction
}

export type HistoryEntry = HistoryTurn | HistoryOffering | HistoryDividend

// Groups actions oldest first: each chosen action opens a turn holding everything it caused,
// the opening auctions group with their free builds, and every dividend stands alone.
export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    let open: HistoryTurn | HistoryOffering | undefined
    let turnsStarted = false
    for (const action of actions) {
        if (isPayDividends(action)) {
            entries.push({ kind: 'dividend', key: action.id, action })
            open = undefined
            continue
        }
        if (isChooseAction(action)) {
            turnsStarted = true
            open = {
                kind: 'turn',
                key: action.id,
                playerId: action.playerId,
                box: action.box,
                actions: [action]
            }
            entries.push(open)
            continue
        }
        if (!open && !turnsStarted) {
            open = { kind: 'offering', key: action.id, actions: [] }
            entries.push(open)
        }
        if (!open) {
            continue
        }
        open.actions.push(action)
        if (open.kind === 'offering') {
            open.railroadId ??= actionSale(action)?.railroadId
            if (isBuildTrack(action)) {
                open = undefined
            }
        }
    }
    return entries
}

export function entryActions(entry: HistoryEntry): GameAction[] {
    return entry.kind === 'dividend' ? [entry.action] : entry.actions
}
