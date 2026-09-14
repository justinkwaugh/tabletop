import type { Owner } from '@tabletop/18xx'
import {
    setStagedSelectionValue,
    popHighestManualStagedSelection,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type StockAction = 'buy' | 'sell' | 'start' | 'exchange'
type StockActionStages = {
    action: { menu: StockAction; buyer?: Owner }
    saleCompany: string
}
const Stages = ['action', 'saleCompany'] as const satisfies readonly (keyof StockActionStages)[]
export type StockActionSelection = StagedSelectionState<StockActionStages>
export function chooseStockAction(menu: StockAction, buyer?: Owner): StockActionSelection {
    return setStagedSelectionValue<StockActionStages, 'action'>(
        {},
        Stages,
        'action',
        { menu, ...(buyer ? { buyer } : {}) },
        'manual'
    )
}
export function chooseSaleCompany(
    selection: StockActionSelection,
    companyId: string
): StockActionSelection {
    return setStagedSelectionValue(selection, Stages, 'saleCompany', companyId, 'manual')
}
export function backFromStockAction(selection: StockActionSelection): StockActionSelection {
    return popHighestManualStagedSelection(selection, Stages).nextState
}

export type StockMenuOption = { label: string; onSelect: () => void }
