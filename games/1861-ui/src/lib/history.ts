import {
    describeNationalRailwayAction,
    type HistoryDescription,
    type HistoryNames,
    type MoneyFormat
} from '@tabletop/18xx-ui'
import type { GameAction } from '@tabletop/common'

/** 1861's history rows: the family's national railway rows, for the RSR. */
export function describe1861Action(
    action: GameAction,
    names: HistoryNames & { place: (locationId: string) => string },
    money: MoneyFormat
): HistoryDescription | undefined {
    return describeNationalRailwayAction(action, names, money, {
        name: 'The Russian State Railway',
        initials: 'RSR',
        started: 'The Russian State Railway begins to operate'
    })
}
