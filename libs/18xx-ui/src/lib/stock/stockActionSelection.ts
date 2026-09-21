import type { Owner } from '@tabletop/18xx'

export type StockAction = 'buy' | 'sell' | 'start' | 'exchange'
export type StockActionStages = {
    action: { menu: StockAction; buyer?: Owner }
    saleCompany: string
}
export const StockActionStageOrder = ['action', 'saleCompany'] as const

export type StockMenuOption = { label: string; selected?: boolean; onSelect: () => void }
