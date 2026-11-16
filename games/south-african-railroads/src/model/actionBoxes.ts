import type { SarMap } from '../maps/maps.js'

export enum ActionBox {
    ConstructTrack = 'ConstructTrack',
    OfferStock = 'OfferStock',
    DevelopSettlements = 'DevelopSettlements',
    PayDividends = 'PayDividends'
}

export const ACTION_BOXES: readonly ActionBox[] = [
    ActionBox.PayDividends,
    ActionBox.DevelopSettlements,
    ActionBox.OfferStock,
    ActionBox.ConstructTrack
]

export const ACTION_TRACK_ADVANCE: Record<ActionBox, number> = {
    [ActionBox.ConstructTrack]: 3,
    [ActionBox.OfferStock]: 4,
    [ActionBox.DevelopSettlements]: 5,
    [ActionBox.PayDividends]: 0
}

export const ACTION_TRACK_LIMIT = 35

export function boxCapacity(box: ActionBox, playerCount: number, map: SarMap): number {
    switch (box) {
        case ActionBox.ConstructTrack:
            return playerCount
        case ActionBox.OfferStock:
            return map.offerStockSlots(playerCount)
        case ActionBox.DevelopSettlements:
            return 2
        case ActionBox.PayDividends:
            return 1
    }
}
