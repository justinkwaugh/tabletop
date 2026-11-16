import { HexOrientation, hexSpiralPattern, type AxialCoordinates } from '@tabletop/common'
import { BoardLayout } from '../definition/config.js'

const BASE_RADIUS = 3

// Rulebook section G, diagram 6: the 11 rings added along three edges of the 37-ring board.
const TOURNAMENT_ADDITIONS: readonly AxialCoordinates[] = [
    { q: -3, r: 4 },
    { q: -2, r: 4 },
    { q: -1, r: 4 },
    { q: 0, r: 4 },
    { q: 1, r: 3 },
    { q: 2, r: 2 },
    { q: 3, r: 1 },
    { q: 4, r: 0 },
    { q: 4, r: -1 },
    { q: 4, r: -2 },
    { q: 4, r: -3 }
]

export function layoutCoordinates(layout: BoardLayout): AxialCoordinates[] {
    const base = Array.from(
        hexSpiralPattern({ radius: BASE_RADIUS, orientation: HexOrientation.Flat })()
    )
    switch (layout) {
        case BoardLayout.Rings37:
            return base
        case BoardLayout.Rings48:
            return [...base, ...TOURNAMENT_ADDITIONS]
    }
}
