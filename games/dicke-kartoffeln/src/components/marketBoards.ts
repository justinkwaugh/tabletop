import { assert } from '@tabletop/common'
import { MarketId } from './potatoes.js'

export enum MarketBoardId {
    TwoPlayers = 'TwoPlayers',
    ThreeToSixPlayers = 'ThreeToSixPlayers'
}

export type DemandRange = { min: number; max?: number }

type StartingRows = { demand: number; price: number }

type MarketBoard = {
    demand: readonly DemandRange[]
    prices: readonly number[]
    start: (playerCount: number) => Record<MarketId, StartingRows>
}

const THREE_TO_SIX_DEMAND: DemandRange[] = [
    { min: 0, max: 1 },
    { min: 2, max: 2 },
    { min: 3, max: 4 },
    { min: 5, max: 7 },
    { min: 8, max: 10 },
    { min: 11, max: 14 },
    { min: 15, max: 19 },
    { min: 20, max: 24 },
    { min: 25, max: 29 },
    { min: 30, max: 35 },
    { min: 36, max: 42 },
    { min: 43, max: 50 },
    { min: 51, max: 59 },
    { min: 60 }
]

const TWO_PLAYER_DEMAND: DemandRange[] = [
    { min: 0, max: 1 },
    { min: 2, max: 2 },
    { min: 3, max: 4 },
    { min: 5, max: 6 },
    { min: 7, max: 8 },
    { min: 9, max: 10 },
    { min: 11, max: 12 },
    { min: 13, max: 14 },
    { min: 15, max: 17 },
    { min: 18, max: 21 },
    { min: 22, max: 26 },
    { min: 27 }
]

function priceSteps(from: number, to: number): number[] {
    return Array.from({ length: (to - from) / 20 + 1 }, (_, index) => from + index * 20)
}

// Starting rows printed beside the tracks ("Startwert für Norm 3", ...), by player count.
const THREE_TO_SIX_DEMAND_START: Record<MarketId, Record<number, number>> = {
    [MarketId.AmalieNorm]: { 3: 4, 4: 5, 5: 6, 6: 6 },
    [MarketId.AmalieBio]: { 3: 0, 4: 0, 5: 1, 6: 1 },
    [MarketId.BiolaNorm]: { 3: 3, 4: 4, 5: 4, 6: 5 },
    [MarketId.BiolaBio]: { 3: 4, 4: 5, 5: 6, 6: 6 },
    [MarketId.ChrisNorm]: { 3: 2, 4: 3, 5: 3, 6: 4 },
    [MarketId.ChrisBio]: { 3: 0, 4: 0, 5: 1, 6: 1 }
}

const THREE_TO_SIX_PRICE_START: Record<MarketId, number> = {
    [MarketId.AmalieNorm]: 5,
    [MarketId.AmalieBio]: 8,
    [MarketId.BiolaNorm]: 5,
    [MarketId.BiolaBio]: 6,
    [MarketId.ChrisNorm]: 4,
    [MarketId.ChrisBio]: 5
}

const TWO_PLAYER_START: Record<MarketId, StartingRows> = {
    [MarketId.AmalieNorm]: { demand: 4, price: 4 },
    [MarketId.AmalieBio]: { demand: 0, price: 7 },
    [MarketId.BiolaNorm]: { demand: 1, price: 4 },
    [MarketId.BiolaBio]: { demand: 2, price: 5 },
    [MarketId.ChrisNorm]: { demand: 1, price: 3 },
    [MarketId.ChrisBio]: { demand: 0, price: 4 }
}

const BOARDS: Record<MarketBoardId, MarketBoard> = {
    [MarketBoardId.TwoPlayers]: {
        demand: TWO_PLAYER_DEMAND,
        prices: priceSteps(80, 300),
        start: () => TWO_PLAYER_START
    },
    [MarketBoardId.ThreeToSixPlayers]: {
        demand: THREE_TO_SIX_DEMAND,
        prices: priceSteps(60, 320),
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

function threeToSixStart(id: MarketId, playerCount: number): StartingRows {
    return {
        demand: THREE_TO_SIX_DEMAND_START[id][playerCount],
        price: THREE_TO_SIX_PRICE_START[id]
    }
}

export function marketBoardFor(playerCount: number): MarketBoardId {
    return playerCount === 2 ? MarketBoardId.TwoPlayers : MarketBoardId.ThreeToSixPlayers
}

export function demandRanges(board: MarketBoardId): readonly DemandRange[] {
    return BOARDS[board].demand
}

export function priceScale(board: MarketBoardId): readonly number[] {
    return BOARDS[board].prices
}

// A market's markers are kept as the printed values they rest on: the demand row's lower bound
// in sacks and the price in marks, so the charts can be corrected without rewriting stored games.
export type MarketPosition = { demand: number; price: number }

export function startingPosition(
    board: MarketBoardId,
    playerCount: number,
    id: MarketId
): MarketPosition {
    const start = BOARDS[board].start(playerCount)[id]
    return {
        demand: BOARDS[board].demand[start.demand].min,
        price: BOARDS[board].prices[start.price]
    }
}

export function demandRowFor(board: MarketBoardId, sacks: number): number {
    const rows = BOARDS[board].demand
    const row = rows.findIndex((range) => sacks >= range.min && (range.max ?? sacks) >= sacks)
    return row < 0 ? rows.length - 1 : row
}

export function demandRow(board: MarketBoardId, demand: number): number {
    const row = BOARDS[board].demand.findIndex((range) => range.min === demand)
    assert(row >= 0, `No demand row starts at ${demand} on the ${board} board`)
    return row
}

export function priceRow(board: MarketBoardId, price: number): number {
    const row = BOARDS[board].prices.indexOf(price)
    assert(row >= 0, `No price of ${price} on the ${board} board`)
    return row
}

export function demandRange(board: MarketBoardId, demand: number): DemandRange {
    return BOARDS[board].demand[demandRow(board, demand)]
}

// Moves a demand marker by whole rows, stopping at either end of the chart.
export function shiftedDemand(board: MarketBoardId, demand: number, rows: number): number {
    const chart = BOARDS[board].demand
    return chart[clampRow(chart.length, demandRow(board, demand) + rows)].min
}

export function shiftedPrice(board: MarketBoardId, price: number, steps: number): number {
    const chart = BOARDS[board].prices
    return chart[clampRow(chart.length, priceRow(board, price) + steps)]
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
