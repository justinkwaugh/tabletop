import { isCallGameAction, type CallGameAction, type GameAction } from '@tabletop/common'
import { isDealHand } from '@tabletop/koenigrufen'
import { describeAction, type Names } from './actionDescription.js'
import type { CardStyle } from './cardStyle.js'

export type HistoryActionEntry = {
    kind: 'action'
    key: string
    deal?: number
    playerId?: string
    text: string
}

export type HistoryCallEntry = {
    kind: 'call'
    key: string
    action: CallGameAction
}

export type HistoryEntry = HistoryActionEntry | HistoryCallEntry

// Newest first; a deal opens its hand.
export function historyEntries(
    actions: readonly GameAction[],
    names: Names,
    style: CardStyle
): HistoryEntry[] {
    return actions
        .flatMap((action): HistoryEntry[] => {
            if (isCallGameAction(action)) {
                return [{ kind: 'call', key: action.id, action }]
            }
            const text = describeAction(action, names, style)
            if (text === undefined) {
                return []
            }
            const deal = isDealHand(action) ? action.metadata?.deal : undefined
            return [
                {
                    kind: 'action',
                    key: action.id,
                    ...(deal === undefined ? {} : { deal }),
                    ...(action.playerId === undefined ? {} : { playerId: action.playerId }),
                    text
                }
            ]
        })
        .reverse()
}
