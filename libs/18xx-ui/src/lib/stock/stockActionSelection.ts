import type { Owner } from '@tabletop/18xx'

export type StockAction = 'buy' | 'sell' | 'start' | 'auction' | 'exchange' | 'privates'
export const stockActionLabels: Readonly<Record<StockAction, string>> = {
    buy: 'Buy',
    sell: 'Sell',
    start: 'Start',
    auction: 'Auction',
    exchange: 'Exchange',
    privates: 'Privates'
}
export type StockActionStages = {
    action: { menu: StockAction; buyer?: Owner }
    saleCompany: string
}
export const StockActionStageOrder = ['action', 'saleCompany'] as const

export type StockMenuOption = { label: string; selected?: boolean; onSelect: () => void }
