import {
    setStagedSelectionValue,
    popHighestManualStagedSelection,
    type StagedSelectionState
} from '@tabletop/frontend-components'

type StockActionStages = {
    action: 'buy' | 'sell' | 'start' | 'exchange'
    saleCompany: string
}
const Stages = ['action', 'saleCompany'] as const satisfies readonly (keyof StockActionStages)[]
export type StockActionSelection = StagedSelectionState<StockActionStages>
export type StockAction = StockActionStages['action']
export function chooseStockAction(action: StockAction): StockActionSelection {
    return setStagedSelectionValue<StockActionStages, 'action'>(
        {},
        Stages,
        'action',
        action,
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
