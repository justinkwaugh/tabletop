export interface ColumnFill {
    columns: number
    rows: number
}

// Items fill columns top to bottom, then left to right. Columns are `preferredRows` deep while
// that many columns fit the width; with less room the columns that do fit grow deeper.
export function columnFill(
    count: number,
    width: number,
    columnWidth: number,
    preferredRows: number
): ColumnFill {
    const fitting = Math.max(1, Math.floor(width / columnWidth))
    const columns = Math.max(1, Math.min(fitting, Math.ceil(count / preferredRows)))
    return { columns, rows: Math.max(1, Math.ceil(count / columns)) }
}
