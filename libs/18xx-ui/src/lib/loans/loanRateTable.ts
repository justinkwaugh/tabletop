import { loanRateTableRow, type LoanRateTable } from '@tabletop/18xx'

/** The strip's height under the market at render scale 1, its border included. */
export const LoanRateTableHeight = 59

export type LoanRateRow = {
    rate: number
    taken: number
    standing: 'used' | 'current' | 'open'
    /** The rate this operating round charges, where loans taken since have moved past it. */
    charged: boolean
}

export type LoanRateTableView = { rows: LoanRateRow[]; loansPerRow: number }

function standing(row: number, current: number): LoanRateRow['standing'] {
    if (row < current) return 'used'
    return row === current ? 'current' : 'open'
}

export function loanRateTableView(
    table: LoanRateTable,
    outstanding: number,
    roundRate: number | undefined
): LoanRateTableView {
    const current = loanRateTableRow(table, outstanding)
    const rows = table.rates.map((rate, row) => ({
        rate,
        taken: Math.min(table.loansPerRow, Math.max(0, outstanding - row * table.loansPerRow)),
        standing: standing(row, current),
        charged: rate === roundRate && row !== current
    }))
    return { rows, loansPerRow: table.loansPerRow }
}
