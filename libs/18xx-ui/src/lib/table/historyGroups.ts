import {
    isFinishOperatingTurn,
    isFinishStockTurn,
    isAdvancePhase,
    isFloatCompany,
    isEndGame,
    isCompleteStockRound,
    isStartOperatingSet,
    isStartOperatingRound,
    isSellFundingShares
} from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'
import type { ActionHistoryEntry } from './auctionHistory.js'

export type HistoryGroup = {
    kind: 'operation' | 'turn' | 'event' | 'passes'
    id: string
    companyId?: string
    playerId?: string
    actions: GameAction[]
}
export type GroupedHistoryEntry = Extract<ActionHistoryEntry, { kind: 'auction' }> | HistoryGroup

export function historyGroups(
    entries: readonly ActionHistoryEntry[],
    operating: boolean
): GroupedHistoryEntry[] {
    const groups: GroupedHistoryEntry[] = []
    let current: HistoryGroup | undefined
    for (const entry of entries.toReversed()) {
        if (entry.kind === 'auction') {
            groups.push(entry)
            current = undefined
            continue
        }
        const action = entry.action
        if (!current && isFinishStockTurn(action) && action.metadata?.passed) {
            const previous = groups.at(-1)
            if (previous?.kind === 'passes') previous.actions.push(action)
            else groups.push({ kind: 'passes', id: action.id, actions: [action] })
            continue
        }
        const companyId =
            !isSellFundingShares(action) &&
            'companyId' in action &&
            typeof action.companyId === 'string'
                ? action.companyId
                : undefined
        const phase = isAdvancePhase(action)
        const roundEvent =
            isStartOperatingSet(action) ||
            isStartOperatingRound(action) ||
            isCompleteStockRound(action)
        if (isEndGame(action) || roundEvent) current = undefined
        const consequence = phase || isFloatCompany(action)
        const compatible =
            current &&
            (consequence ||
                (operating && current.kind === 'operation'
                    ? !companyId || current.companyId === companyId
                    : current.kind !== 'event' &&
                      current.playerId === action.playerId &&
                      !isEndGame(action)))
        if (!compatible) {
            current = {
                kind:
                    isEndGame(action) || phase || roundEvent
                        ? 'event'
                        : operating && companyId
                          ? 'operation'
                          : 'turn',
                id: action.id,
                companyId: operating ? companyId : undefined,
                playerId: action.playerId,
                actions: []
            }
            groups.push(current)
        }
        current!.actions.push(action)
        if (isFinishOperatingTurn(action) || isFinishStockTurn(action)) current = undefined
    }
    return groups.toReversed()
}
