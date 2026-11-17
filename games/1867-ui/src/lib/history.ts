import {
    describeNationalRailwayAction,
    type HistoryDescription,
    type HistoryNames,
    type MoneyFormat
} from '@tabletop/18xx-ui'
import type { GameAction } from '@tabletop/common'

/** 1867's history rows: the family's national railway rows, for the Canadian National. */
export function describe1867Action(
    action: GameAction,
    names: HistoryNames & { place: (locationId: string) => string },
    money: MoneyFormat
): HistoryDescription | undefined {
    return describeNationalRailwayAction(action, names, money, {
        name: 'The Canadian National',
        initials: 'CN',
        started: 'The Canadian National begins to export trains'
    })
}
