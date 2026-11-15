import type { StockMarketChart, StockTurnOrder } from '@tabletop/18xx'
import { offTheRails } from './state.js'
import { OffTheRailsMarketChesapeake, StandardMarketChesapeake } from './stockMarket.js'

/** The train supply each edition draws from the depot. */
export const StandardSupplyChesapeake = 'standard'
export const OffTheRailsSupplyChesapeake = 'off-the-rails'
/** Off the Rails replaces the D-train with its own at $1,100. */
export const OffTheRailsDieselId = 'D1100'

/** What the printed game and the Off the Rails expansion each play with. */
export type EditionChesapeake = {
    bank: number
    market: StockMarketChart
    turnOrder: StockTurnOrder
    floatPercent: number
    supplyId: string
    dieselId: string
    dieselCredit: number
    exportsTrains: boolean
    /** A price reaching the market's game-end space ends the game. */
    endsAtMarketTop: boolean
}

/** The rulebook's game (§3, §10, §11.7, §11.9, §12). */
export const StandardEditionChesapeake: EditionChesapeake = {
    bank: 8000,
    market: StandardMarketChesapeake,
    turnOrder: 'sell-buy',
    floatPercent: 60,
    supplyId: StandardSupplyChesapeake,
    dieselId: 'D',
    dieselCredit: 200,
    exportsTrains: true,
    endsAtMarketTop: false
}

/** The Off the Rails expansion's game (OTR rule sheet). */
export const OffTheRailsEditionChesapeake: EditionChesapeake = {
    bank: 12000,
    market: OffTheRailsMarketChesapeake,
    turnOrder: 'sell-buy-sell',
    floatPercent: 50,
    supplyId: OffTheRailsSupplyChesapeake,
    dieselId: OffTheRailsDieselId,
    dieselCredit: 300,
    exportsTrains: false,
    endsAtMarketTop: true
}

export function editionChesapeake(state: object): EditionChesapeake {
    return offTheRails(state) ? OffTheRailsEditionChesapeake : StandardEditionChesapeake
}
