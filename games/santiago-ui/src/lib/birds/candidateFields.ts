import { isFieldSquare, type BoardSquare, type Intersection } from '@tabletop/santiago'

export function isCandidateField(square: BoardSquare): boolean {
    return isFieldSquare(square) && !square.dried
}

export function isDesertField(square: BoardSquare): boolean {
    return isFieldSquare(square) && square.dried
}

// Every field the birds might come for, living or dried out.
export function plantedFields(squares: BoardSquare[][]): Intersection[] {
    return squares.flatMap((column, col) =>
        column.flatMap((square, row) => (isFieldSquare(square) ? [{ col, row }] : []))
    )
}

export function adjacentCandidates(squares: BoardSquare[][], field: Intersection): Intersection[] {
    const neighbours = [
        { col: field.col - 1, row: field.row },
        { col: field.col + 1, row: field.row },
        { col: field.col, row: field.row - 1 },
        { col: field.col, row: field.row + 1 }
    ]
    return neighbours.filter((spot) => {
        const square = squares[spot.col]?.[spot.row]
        return square !== undefined && isCandidateField(square)
    })
}

export function nearbyCandidates(squares: BoardSquare[][], fields: Intersection[]): Intersection[] {
    const taken = new Set(fields.map((field) => `${field.col},${field.row}`))
    const result: Intersection[] = []
    for (const field of fields) {
        for (let col = field.col - 1; col <= field.col + 1; col++) {
            for (let row = field.row - 1; row <= field.row + 1; row++) {
                const key = `${col},${row}`
                const square = squares[col]?.[row]
                if (taken.has(key) || square === undefined || !isCandidateField(square)) continue
                taken.add(key)
                result.push({ col, row })
            }
        }
    }
    return result
}
