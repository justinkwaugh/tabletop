import type { GameAction } from '@tabletop/common'

export enum HistoryItemType {
    Default = 'default',
    Action = 'action',
    RoundStart = 'roundStart',
    GameStart = 'gameStart',
    GameEnd = 'gameEnd'
}

export type HistoryItem = {
    type: HistoryItemType
    id: string
    date?: Date
    description?: string
}

export type ActionHistoryItem = HistoryItem & {
    type: HistoryItemType.Action
    action: GameAction
}

export type RoundStartHistoryItem = HistoryItem & {
    type: HistoryItemType.RoundStart
    round: number
}

export function isActionHistoryItem(item: HistoryItem): item is ActionHistoryItem {
    return item.type === HistoryItemType.Action
}

export function isRoundStartHistoryItem(item: HistoryItem): item is RoundStartHistoryItem {
    return item.type === HistoryItemType.RoundStart
}
