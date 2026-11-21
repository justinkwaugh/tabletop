import {
    loanRateTableRow,
    loanRateTableRowLoans,
    loanRateTableRowStart,
    type LoanRateTable
} from '@tabletop/18xx'

/** The strip's height under the market at render scale 1, its border included. */
export const LoanRateTableHeight = 59

export type LoanRateRow = {
    rate: number
    /** The loans the row lends. */
    loans: number
    taken: number
    standing: 'used' | 'current' | 'open'
    /** The rate this operating round charges, where loans taken since have moved past it. */
    charged: boolean
}

export type LoanRateTableView = { rows: LoanRateRow[] }

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
    const rows = table.rates.map((rate, row) => {
        const loans = loanRateTableRowLoans(table, row)
        return {
            rate,
            loans,
            taken: Math.min(loans, Math.max(0, outstanding - loanRateTableRowStart(table, row))),
            standing: standing(row, current),
            charged: rate === roundRate && row !== current
        }
    })
    return { rows }
}
