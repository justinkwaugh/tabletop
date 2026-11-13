import { HexKind } from '../types.js'

export function danishTrackCost(hexKind: HexKind, discsBelow: number): number {
    switch (hexKind) {
        case HexKind.Countryside:
            return 2
        case HexKind.Bridge:
            return 6
        default:
            return 4 + 2 * discsBelow
    }
}

// A crossing cube costs half the hex's track cost.
export function danishCubeCost(hexKind: HexKind): number {
    return danishTrackCost(hexKind, 0) / 2
}

// The board's Wealth Taxation table; above $60 a player pays a third, rounded down.
const BRACKETS: readonly { upTo: number; tax: number }[] = [
    { upTo: 5, tax: 0 },
    { upTo: 10, tax: 1 },
    { upTo: 15, tax: 2 },
    { upTo: 20, tax: 4 },
    { upTo: 30, tax: 7 },
    { upTo: 40, tax: 10 },
    { upTo: 60, tax: 15 }
]

export function wealthTax(cash: number): number {
    return BRACKETS.find((bracket) => cash <= bracket.upTo)?.tax ?? Math.floor(cash / 3)
}
