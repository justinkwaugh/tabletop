// Equal totals share a place (two firsts are followed by a third, not a second), which
// matches how the game itself treats a tie: the crown is shared, not broken.
export function withSharedPlaces<Row extends { total: number }>(
    rows: readonly Row[]
): (Row & { place: number })[] {
    const sorted = rows.toSorted((a, b) => b.total - a.total)
    let place = 0
    let previousTotal: number | undefined
    return sorted.map((row, index) => {
        if (row.total !== previousTotal) {
            place = index + 1
            previousTotal = row.total
        }
        return { ...row, place }
    })
}
