import type { GameAction } from '@tabletop/common'
import { isDrawTile, isEndAuction, isStallTile, type GoodsType } from '@tabletop/fresh-fish'

export type TimeGroup = { label: string; actions: GameAction[] }

export function groupByTimeLabel(
    actions: readonly GameAction[],
    labelFor: (action: GameAction) => string
): TimeGroup[] {
    const groups: TimeGroup[] = []
    for (const action of actions) {
        const label = labelFor(action)
        const last = groups.at(-1)
        if (last?.label === label) last.actions.push(action)
        else groups.push({ label, actions: [action] })
    }
    return groups
}

export function auctionedGoodsById(actions: readonly GameAction[]): Map<string, GoodsType> {
    const goods = new Map<string, GoodsType>()
    let lastDrawn: GoodsType | undefined
    for (const action of actions) {
        if (isDrawTile(action) && isStallTile(action.metadata?.chosenTile)) {
            lastDrawn = action.metadata.chosenTile.goodsType
        } else if (isEndAuction(action)) {
            // Auctions recorded before EndAuction carried its goods type fall back to the draw
            // that opened them.
            const goodsType = action.metadata?.goodsType ?? lastDrawn
            if (goodsType) goods.set(action.id, goodsType)
        }
    }
    return goods
}
