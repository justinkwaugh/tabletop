import { assert } from '@tabletop/common'
import { MarketId } from './potatoes.js'

export enum MarketBoardId {
    TwoPlayers = 'TwoPlayers',
    ThreeToSixPlayers = 'ThreeToSixPlayers'
}

export type DemandRange = { min: number; max?: number }

// Each space of a track has an ID of its own, never derived from its place or printed value,
// so correcting a chart leaves every stored marker on the space it names. A space added by a
// correction takes a new ID.
export type DemandRow = DemandRange & { id: string }
export type PriceSpace = { id: string; marks: number }

// The spaces a market's two markers rest on.
export type MarketPosition = { demandRowId: string; priceSpaceId: string }

type MarketBoard = {
    demand: readonly DemandRow[]
    prices: readonly PriceSpace[]
    start: (playerCount: number) => Record<MarketId, MarketPosition>
}

const THREE_TO_SIX_DEMAND: DemandRow[] = [
    { id: 'D1', min: 0, max: 1 },
    { id: 'D2', min: 2, max: 2 },
    { id: 'D3', min: 3, max: 4 },
    { id: 'D4', min: 5, max: 7 },
    { id: 'D5', min: 8, max: 10 },
    { id: 'D6', min: 11, max: 14 },
    { id: 'D7', min: 15, max: 19 },
    { id: 'D8', min: 20, max: 24 },
    { id: 'D9', min: 25, max: 29 },
    { id: 'D10', min: 30, max: 35 },
    { id: 'D11', min: 36, max: 42 },
    { id: 'D12', min: 43, max: 50 },
    { id: 'D13', min: 51, max: 59 },
    { id: 'D14', min: 60 }
]

const TWO_PLAYER_DEMAND: DemandRow[] = [
    { id: 'D1', min: 0, max: 1 },
    { id: 'D2', min: 2, max: 2 },
    { id: 'D3', min: 3, max: 4 },
    { id: 'D4', min: 5, max: 6 },
    { id: 'D5', min: 7, max: 8 },
    { id: 'D6', min: 9, max: 10 },
    { id: 'D7', min: 11, max: 12 },
    { id: 'D8', min: 13, max: 14 },
    { id: 'D9', min: 15, max: 17 },
    { id: 'D10', min: 18, max: 21 },
    { id: 'D11', min: 22, max: 26 },
    { id: 'D12', min: 27 }
]

const THREE_TO_SIX_PRICES: PriceSpace[] = [
    { id: 'P1', marks: 60 },
    { id: 'P2', marks: 80 },
    { id: 'P3', marks: 100 },
    { id: 'P4', marks: 120 },
    { id: 'P5', marks: 140 },
    { id: 'P6', marks: 160 },
    { id: 'P7', marks: 180 },
    { id: 'P8', marks: 200 },
    { id: 'P9', marks: 220 },
    { id: 'P10', marks: 240 },
    { id: 'P11', marks: 260 },
    { id: 'P12', marks: 280 },
    { id: 'P13', marks: 300 },
    { id: 'P14', marks: 320 }
]

const TWO_PLAYER_PRICES: PriceSpace[] = [
    { id: 'P1', marks: 80 },
    { id: 'P2', marks: 100 },
    { id: 'P3', marks: 120 },
    { id: 'P4', marks: 140 },
    { id: 'P5', marks: 160 },
    { id: 'P6', marks: 180 },
    { id: 'P7', marks: 200 },
    { id: 'P8', marks: 220 },
    { id: 'P9', marks: 240 },
    { id: 'P10', marks: 260 },
    { id: 'P11', marks: 280 },
    { id: 'P12', marks: 300 }
]

// Starting rows printed beside the tracks ("Startwert für Norm 3", ...), by player count.
const THREE_TO_SIX_DEMAND_START: Record<MarketId, Record<number, string>> = {
    [MarketId.AmalieNorm]: { 3: 'D5', 4: 'D6', 5: 'D7', 6: 'D7' },
    [MarketId.AmalieBio]: { 3: 'D1', 4: 'D1', 5: 'D2', 6: 'D2' },
    [MarketId.BiolaNorm]: { 3: 'D4', 4: 'D5', 5: 'D5', 6: 'D6' },
    [MarketId.BiolaBio]: { 3: 'D5', 4: 'D6', 5: 'D7', 6: 'D7' },
    [MarketId.ChrisNorm]: { 3: 'D3', 4: 'D4', 5: 'D4', 6: 'D5' },
    [MarketId.ChrisBio]: { 3: 'D1', 4: 'D1', 5: 'D2', 6: 'D2' }
}

const THREE_TO_SIX_PRICE_START: Record<MarketId, string> = {
    [MarketId.AmalieNorm]: 'P6',
    [MarketId.AmalieBio]: 'P9',
    [MarketId.BiolaNorm]: 'P6',
    [MarketId.BiolaBio]: 'P7',
    [MarketId.ChrisNorm]: 'P5',
    [MarketId.ChrisBio]: 'P6'
}

const TWO_PLAYER_START: Record<MarketId, MarketPosition> = {
    [MarketId.AmalieNorm]: { demandRowId: 'D5', priceSpaceId: 'P5' },
    [MarketId.AmalieBio]: { demandRowId: 'D1', priceSpaceId: 'P8' },
    [MarketId.BiolaNorm]: { demandRowId: 'D2', priceSpaceId: 'P5' },
    [MarketId.BiolaBio]: { demandRowId: 'D3', priceSpaceId: 'P6' },
    [MarketId.ChrisNorm]: { demandRowId: 'D2', priceSpaceId: 'P4' },
    [MarketId.ChrisBio]: { demandRowId: 'D1', priceSpaceId: 'P5' }
}

const BOARDS: Record<MarketBoardId, MarketBoard> = {
    [MarketBoardId.TwoPlayers]: {
        demand: TWO_PLAYER_DEMAND,
        prices: TWO_PLAYER_PRICES,
        start: () => TWO_PLAYER_START
    },
    [MarketBoardId.ThreeToSixPlayers]: {
        demand: THREE_TO_SIX_DEMAND,
        prices: THREE_TO_SIX_PRICES,
        start: (playerCount) => ({
            [MarketId.AmalieNorm]: threeToSixStart(MarketId.AmalieNorm, playerCount),
            [MarketId.AmalieBio]: threeToSixStart(MarketId.AmalieBio, playerCount),
            [MarketId.BiolaNorm]: threeToSixStart(MarketId.BiolaNorm, playerCount),
            [MarketId.BiolaBio]: threeToSixStart(MarketId.BiolaBio, playerCount),
            [MarketId.ChrisNorm]: threeToSixStart(MarketId.ChrisNorm, playerCount),
            [MarketId.ChrisBio]: threeToSixStart(MarketId.ChrisBio, playerCount)
        })
    }
}

function threeToSixStart(id: MarketId, playerCount: number): MarketPosition {
    return {
        demandRowId: THREE_TO_SIX_DEMAND_START[id][playerCount],
        priceSpaceId: THREE_TO_SIX_PRICE_START[id]
    }
}

export function marketBoardFor(playerCount: number): MarketBoardId {
    return playerCount === 2 ? MarketBoardId.TwoPlayers : MarketBoardId.ThreeToSixPlayers
}

export function demandRows(board: MarketBoardId): readonly DemandRow[] {
    return BOARDS[board].demand
}

export function priceSpaces(board: MarketBoardId): readonly PriceSpace[] {
    return BOARDS[board].prices
}

export function startingPosition(
    board: MarketBoardId,
    playerCount: number,
    id: MarketId
): MarketPosition {
    return { ...BOARDS[board].start(playerCount)[id] }
}

// The row whose range holds this many sacks; offers beyond the chart rest on its last row.
export function demandRowFor(board: MarketBoardId, sacks: number): DemandRow {
    const rows = BOARDS[board].demand
    const row = rows.find((range) => sacks >= range.min && (range.max ?? sacks) >= sacks)
    return row ?? rows[rows.length - 1]
}

// Where a space sits on its track, counted from the bottom.
export function demandRowIndex(board: MarketBoardId, rowId: string): number {
    const row = BOARDS[board].demand.findIndex((candidate) => candidate.id === rowId)
    assert(row >= 0, `No demand row ${rowId} on the ${board} board`)
    return row
}

export function priceSpaceIndex(board: MarketBoardId, spaceId: string): number {
    const space = BOARDS[board].prices.findIndex((candidate) => candidate.id === spaceId)
    assert(space >= 0, `No price space ${spaceId} on the ${board} board`)
    return space
}

export function demandRange(board: MarketBoardId, rowId: string): DemandRow {
    return BOARDS[board].demand[demandRowIndex(board, rowId)]
}

export function priceMarks(board: MarketBoardId, spaceId: string): number {
    return BOARDS[board].prices[priceSpaceIndex(board, spaceId)].marks
}

// Moves a demand marker by whole rows, stopping at either end of the chart.
export function shiftedDemand(board: MarketBoardId, rowId: string, rows: number): string {
    const chart = BOARDS[board].demand
    return chart[clampRow(chart.length, demandRowIndex(board, rowId) + rows)].id
}

export function shiftedPrice(board: MarketBoardId, spaceId: string, steps: number): string {
    const chart = BOARDS[board].prices
    return chart[clampRow(chart.length, priceSpaceIndex(board, spaceId) + steps)].id
}

// "Differenz 0 / 1 / 2–3 / 4 und mehr" moves the price 0 / 1 / 2 / 3 steps.
export function priceChangeForDemandShift(rowsMoved: number): number {
    if (rowsMoved === 0) return 0
    if (rowsMoved === 1) return 1
    if (rowsMoved <= 3) return 2
    return 3
}

function clampRow(rows: number, row: number): number {
    return Math.max(0, Math.min(rows - 1, row))
}
