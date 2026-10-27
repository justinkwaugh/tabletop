import type { Point } from '@tabletop/common'
import { Step } from '@tabletop/power-grid'

export const MARKET_CARD = 116
export const MARKET_COLUMN_GAP = 10
export const MARKET_ROW_GAP = 26

export function marketColumns(step: Step): number {
    return step === Step.Three ? 3 : 4
}

export function marketCell(index: number, step: Step): Point {
    const columns = marketColumns(step)
    return {
        x: (index % columns) * (MARKET_CARD + MARKET_COLUMN_GAP),
        y: Math.floor(index / columns) * (MARKET_CARD + MARKET_ROW_GAP)
    }
}
