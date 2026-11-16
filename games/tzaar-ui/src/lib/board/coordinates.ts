import type { AxialCoordinates } from '@tabletop/common'
import { spaceName } from '@tabletop/tzaar'

// The rulebook's names for the ends of each column: the bottom space (A1–I1) below it and the top
// space (A5, B6 … I5) above it.
export type ColumnEnd = {
    key: string
    text: string
    coords: AxialCoordinates
    above: boolean
}

export function boardLabels(positions: readonly AxialCoordinates[]): ColumnEnd[] {
    const columns = [...new Set(positions.map((coords) => coords.q))].sort((a, b) => a - b)
    return columns.flatMap((q) => {
        const rows = positions.filter((coords) => coords.q === q).map((coords) => coords.r)
        const top = { q, r: Math.min(...rows) }
        const bottom = { q, r: Math.max(...rows) }
        return [
            { key: `top-${q}`, text: spaceName(top), coords: top, above: true },
            { key: `bottom-${q}`, text: spaceName(bottom), coords: bottom, above: false }
        ]
    })
}
