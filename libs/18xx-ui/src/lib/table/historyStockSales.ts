import { isSellShares } from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'

export function historyStockSales(actions: readonly GameAction[]) {
    const blocks = new Map<string, { firstId: string; companyId: string; shares: number; proceeds: number; actionIds: string[] }>()
    for (const action of actions) {
        if (!isSellShares(action) || !action.metadata?.saleBlockId) continue
        const sale = action.metadata.sales[0]
        const id = action.metadata.saleBlockId
        let block = blocks.get(id)
        if (!block) {
            block = { firstId: action.id, companyId: sale.companyId, shares: 0, proceeds: 0, actionIds: [] }
            blocks.set(id, block)
        }
        block.shares += sale.shares
        block.proceeds += sale.proceeds
        block.actionIds.push(action.id)
    }
    return new Map([...blocks.values()].flatMap((block) =>
        block.actionIds.map((id) => [id, block] as const)))
}
