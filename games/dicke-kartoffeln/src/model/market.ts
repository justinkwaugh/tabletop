import * as Type from 'typebox'
import {
    demandRanges,
    demandRow,
    demandRowFor,
    priceChangeForDemandShift,
    shiftedDemand,
    shiftedPrice
} from '../components/marketBoards.js'
import type { MarketChanges } from '../components/messages.js'
import { MarketId, Quality, marketDefinition } from '../components/potatoes.js'
import type { HydratedDickeKartoffelnGameState } from './gameState.js'
import type { FieldState } from './playerState.js'

export type MarketMove = Type.Static<typeof MarketMove>
// Demand is the lower bound of the demand row in sacks, price is in marks.
export const MarketMove = Type.Object({
    marketId: Type.Enum(MarketId),
    offered: Type.Number(),
    demandBefore: Type.Number(),
    demandAfter: Type.Number(),
    priceBefore: Type.Number(),
    priceAfter: Type.Number()
})

export function sacksOffered(field: FieldState, id: MarketId): number {
    const { variety, quality } = marketDefinition(id)
    if (field.seed !== variety || !field.sale) {
        return 0
    }
    return quality === Quality.Bio ? field.sale.bio : field.sale.norm
}

export function totalOffered(state: HydratedDickeKartoffelnGameState, id: MarketId): number {
    return state.players.reduce(
        (sum, player) =>
            sum + player.fields.reduce((fieldSum, field) => fieldSum + sacksOffered(field, id), 0),
        0
    )
}

// The offered sacks become the new demand; the rows the demand marker moves set how far the
// price moves: down when more was offered than demanded, up when less was.
export function recalculateMarket(
    state: HydratedDickeKartoffelnGameState,
    id: MarketId
): MarketMove {
    const board = state.marketBoard()
    const market = state.market(id)
    const offered = totalOffered(state, id)
    const demandBefore = market.demand
    const priceBefore = market.price
    const rowBefore = demandRow(board, demandBefore)
    const rowAfter = demandRowFor(board, offered)
    const steps = priceChangeForDemandShift(Math.abs(rowAfter - rowBefore))
    const direction = Math.sign(rowBefore - rowAfter)
    const demandAfter = demandRanges(board)[rowAfter].min
    market.demand = demandAfter
    market.price = shiftedPrice(board, priceBefore, direction * steps)
    return {
        marketId: id,
        offered,
        demandBefore,
        demandAfter,
        priceBefore,
        priceAfter: market.price
    }
}

export function shiftDemand(state: HydratedDickeKartoffelnGameState, changes: MarketChanges) {
    const board = state.marketBoard()
    for (const market of state.markets) {
        market.demand = shiftedDemand(board, market.demand, changes[market.id] ?? 0)
    }
}

export function shiftPrices(state: HydratedDickeKartoffelnGameState, steps: number) {
    const board = state.marketBoard()
    for (const market of state.markets) {
        market.price = shiftedPrice(board, market.price, steps)
    }
}
