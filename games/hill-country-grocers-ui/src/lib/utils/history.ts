import type { GameAction } from '@tabletop/common'
import {
    isChooseAction,
    isPassBid,
    isPayDividends,
    isPlaceBid,
    type ActionSpace,
    type CompanyId
} from '@tabletop/hill-country-grocers'
import { actionSale } from './describeAction.js'

export type HistoryTurn = {
    kind: 'turn'
    key: string
    playerId: string
    space: ActionSpace
    actions: GameAction[]
}

export type HistoryAuction = {
    kind: 'initial'
    key: string
    companyId?: CompanyId
    actions: GameAction[]
}

export type HistoryDividend = {
    kind: 'dividend'
    key: string
    action: GameAction
}

export type HistoryEntry = HistoryTurn | HistoryAuction | HistoryDividend

export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    let open: HistoryTurn | HistoryAuction | undefined
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
                space: action.space,
                actions: [action]
            }
            entries.push(open)
            continue
        }
        const startsAuction =
            !open || (open.kind === 'initial' && open.companyId !== undefined && isBid(action))
        if (!turnsStarted && startsAuction) {
            open = { kind: 'initial', key: action.id, actions: [] }
            entries.push(open)
        }
        if (!open) {
            continue
        }
        open.actions.push(action)
        if (open.kind === 'initial') {
            open.companyId ??= actionSale(action)?.companyId
        }
    }
    return entries
}

function isBid(action: GameAction): boolean {
    return isPlaceBid(action) || isPassBid(action)
}

export function entryActions(entry: HistoryEntry): GameAction[] {
    return entry.kind === 'dividend' ? [entry.action] : entry.actions
}
