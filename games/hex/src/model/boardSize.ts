// The board a game is played on, a rhombus of hexagons so many to a side. Kept apart from the
// board's cells, as the game's config, which the site loads with every page, names it.
export enum BoardSize {
    Nine = 'Nine',
    Eleven = 'Eleven',
    Thirteen = 'Thirteen',
    Fourteen = 'Fourteen',
    Nineteen = 'Nineteen'
}

const CELLS_PER_SIDE: Readonly<Record<BoardSize, number>> = {
    [BoardSize.Nine]: 9,
    [BoardSize.Eleven]: 11,
    [BoardSize.Thirteen]: 13,
    [BoardSize.Fourteen]: 14,
    [BoardSize.Nineteen]: 19
}

export function cellsPerSide(size: BoardSize): number {
    return CELLS_PER_SIDE[size]
}
