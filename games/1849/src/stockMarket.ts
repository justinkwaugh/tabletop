import { createRectangularStockMarketSpaces, StockMarketChart } from '@tabletop/18xx'
import { Phases1849 } from './trains.js'

// Zone letters: p the starting values of phase 4, x of phase 6 and z of phase 10 (§9.4); u the blue
// "Phase 16 Only" section (§5); e the L. 377 that ends the game (§13); c the Closed box (§11).
const Market: readonly string[] = [
    '72 83 95 107 120 133 147 164 182 202 224 248 276 306u 340u 377e',
    '63 72 82 93 104 116 128 142 158 175 195 216z 240 266u 295u 328u',
    '57 66 75 84 95 105 117 129 144x 159 177 196 218 242u 269u 298u',
    '54 62 71 80 90 100p 111 123 137 152 169 187 208 230',
    '52 59 68p 77 86 95 106 117 130 145 160 178 198',
    '47 54 62 70 78 87 96 107 118 131 146 162',
    '41 47 54 61 68 75 84 93 103 114 127',
    '34 39 45 50 57 63 70 77 86 95',
    '27 31 36 40 45 50 56',
    '0c 24 27 31'
]
const Cells = Market.map((row) => row.split(' '))
const Zones: Readonly<Record<string, string>> = {
    p: 'yellow',
    x: 'green',
    z: 'brown',
    u: 'blue',
    e: 'orange',
    c: 'black'
}
const zoneOf = (row: number, column: number) => Cells[row][column].replace(/\d/g, '')

export const Market1849 = new StockMarketChart(
    createRectangularStockMarketSpaces(
        Cells.map((row) => row.map((cell) => Number.parseInt(cell))),
        (row, column) => Zones[zoneOf(row, column)] ?? 'white'
    )
)

function spaceIdsIn(zone: string): string[] {
    return Cells.flatMap((row, rowIndex) =>
        row.flatMap((_, column) =>
            zoneOf(rowIndex, column) === zone ? [`${rowIndex}:${column}`] : []
        )
    )
}

/** The starting values each phase adds: L. 68 and 100, then 144, then 216 (§9.4). */
export const ParSpaceIdsByPhase1849: Readonly<Record<string, readonly string[]>> = {
    '4H': spaceIdsIn('p'),
    '6H': spaceIdsIn('x'),
    '10H': spaceIdsIn('z')
}

export function parSpaceIds1849(phaseId: string): string[] {
    return Object.entries(ParSpaceIdsByPhase1849).flatMap(([fromPhaseId, spaceIds]) =>
        Phases1849.isAtLeast(phaseId, fromPhaseId) ? spaceIds : []
    )
}

/** Closed to share prices before phase 16; until then its edge is the market's right edge (§5). */
export const BlueZoneSpaceIds1849: readonly string[] = spaceIdsIn('u')
export const EndGameSpaceId1849 = spaceIdsIn('e')[0]
export const ClosedSpaceId1849 = spaceIdsIn('c')[0]

/**
 * The market as prices move before phase 16: the blue zone is not there, so its edge is the
 * market's right edge and a price beneath it cannot rise into it (§5).
 */
export const MarketBeforeBlueZone1849 = new StockMarketChart(
    createRectangularStockMarketSpaces(
        Cells.map((row, rowIndex) =>
            row.map((cell, column) =>
                zoneOf(rowIndex, column) === 'u' ? null : Number.parseInt(cell)
            )
        ),
        (row, column) => Zones[zoneOf(row, column)] ?? 'white'
    )
)
