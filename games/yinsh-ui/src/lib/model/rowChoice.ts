import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'

export type Row = AxialCoordinates[]

const contains = (row: Row, coords: AxialCoordinates) =>
    row.some((candidate) => sameCoordinates(candidate, coords))

export function rowsThrough(rows: readonly Row[], ...markers: AxialCoordinates[]): Row[] {
    return rows.filter((row) => markers.every((coords) => contains(row, coords)))
}

// A tap on a marker takes the one row it settles. A marker in several rows (inside a run
// longer than five, or where two rows cross) becomes one end of the choice instead: `reach`
// narrows to the rows through it, and the markers that then settle a single row are offered.
export type RowChoice = {
    markers: AxialCoordinates[]
    reach: AxialCoordinates[]
    settling: AxialCoordinates[]
}

export function rowChoice(rows: readonly Row[], anchor?: AxialCoordinates): RowChoice {
    const markers = unique(rows.flat())
    const reach = anchor === undefined ? markers : unique(rowsThrough(rows, anchor).flat())
    const settling = reach.filter((coords) => {
        if (anchor !== undefined && sameCoordinates(coords, anchor)) return false
        const through = anchor === undefined ? [coords] : [anchor, coords]
        return rowsThrough(rows, ...through).length === 1
    })
    return { markers, reach, settling }
}

function unique(list: readonly AxialCoordinates[]): AxialCoordinates[] {
    const result: AxialCoordinates[] = []
    for (const coords of list) {
        if (!result.some((candidate) => sameCoordinates(candidate, coords))) result.push(coords)
    }
    return result
}
