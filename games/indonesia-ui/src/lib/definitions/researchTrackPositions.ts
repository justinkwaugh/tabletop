import type { Point } from '@tabletop/common'

export type ResearchRow = 'bid' | 'slots' | 'mergers' | 'expansion' | 'hull'

type ResearchRowBounds = {
    row: ResearchRow
    top: number
    bottom: number
}

export type ResearchTrackCell = {
    id: string
    row: ResearchRow
    columnIndex: number
    left: number
    top: number
    width: number
    height: number
    center: Point
}

const RESEARCH_COLUMN_BOUNDS = [2183, 2272, 2360, 2451, 2508, 2566] as const

const RESEARCH_ROW_BOUNDS: readonly ResearchRowBounds[] = [
    { row: 'bid', top: 146, bottom: 204 },
    { row: 'slots', top: 214, bottom: 273 },
    { row: 'mergers', top: 281, bottom: 337 },
    { row: 'expansion', top: 347, bottom: 404 },
    { row: 'hull', top: 414, bottom: 471 }
]

export const RESEARCH_ROWS: readonly ResearchRow[] = RESEARCH_ROW_BOUNDS.map((entry) => entry.row)

export const RESEARCH_TRACK_CELLS: readonly ResearchTrackCell[] = RESEARCH_ROW_BOUNDS.flatMap(
    ({ row, top, bottom }) => {
        const cells: ResearchTrackCell[] = []

        for (let columnIndex = 0; columnIndex < RESEARCH_COLUMN_BOUNDS.length - 1; columnIndex += 1) {
            const left = RESEARCH_COLUMN_BOUNDS[columnIndex]
            const right = RESEARCH_COLUMN_BOUNDS[columnIndex + 1]
            const width = right - left
            const height = bottom - top

            cells.push({
                id: `${row}-${columnIndex}`,
                row,
                columnIndex,
                left,
                top,
                width,
                height,
                center: {
                    x: left + width / 2,
                    y: top + height / 2
                }
            })
        }

        return cells
    }
)
