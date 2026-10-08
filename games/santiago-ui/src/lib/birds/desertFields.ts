import { isFieldSquare, type BoardSquare, type Intersection } from '@tabletop/santiago'

export function isDesertField(square: BoardSquare): boolean {
    return isFieldSquare(square) && square.dried
}

export function desertFields(squares: BoardSquare[][]): Intersection[] {
    return squares.flatMap((column, col) =>
        column.flatMap((square, row) => (isDesertField(square) ? [{ col, row }] : []))
    )
}

// More than half of the planted fields have dried to desert.
export function desertDominates(squares: BoardSquare[][]): boolean {
    let fields = 0
    let deserts = 0
    for (const column of squares) {
        for (const square of column) {
            if (!isFieldSquare(square)) continue
            fields++
            if (square.dried) deserts++
        }
    }
    return deserts * 2 > fields
}
