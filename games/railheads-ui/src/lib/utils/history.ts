import type { GameAction } from '@tabletop/common'
import {
    isChooseAction,
    isConsolidate,
    isEndRound,
    isScoreGame,
    type ActionSpaceId,
    type CompanyId
} from '@tabletop/railheads'
import { actionSale } from './describeAction.js'

export type HistoryTurn = {
    kind: 'turn'
    key: string
    playerId: string
    space: ActionSpaceId | undefined
    actions: GameAction[]
}

export type HistoryOffering = {
    kind: 'offering'
    key: string
    companyId?: CompanyId
    actions: GameAction[]
}

export type HistoryPayout = {
    kind: 'payout'
    key: string
    action: GameAction
}

export type HistoryEntry = HistoryTurn | HistoryOffering | HistoryPayout

// Groups actions oldest first: each opening share is one entry, each turn opens with its chosen
// action or consolidation and holds what followed, and every payout stands alone.
export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    let open: HistoryTurn | HistoryOffering | undefined
    let turnsStarted = false
    for (const action of actions) {
        if (isEndRound(action) || isScoreGame(action)) {
            entries.push({ kind: 'payout', key: action.id, action })
            open = undefined
            continue
        }
        if ((isChooseAction(action) || isConsolidate(action)) && action.playerId) {
            turnsStarted = true
            open = {
                kind: 'turn',
                key: action.id,
                playerId: action.playerId,
                space: isChooseAction(action) ? action.space : undefined,
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
            const sale = actionSale(action)
            if (sale) {
                open.companyId = sale.companyId
                open = undefined
            }
        }
    }
    return entries
}

export function entryActions(entry: HistoryEntry): GameAction[] {
    return entry.kind === 'payout' ? [entry.action] : entry.actions
}
