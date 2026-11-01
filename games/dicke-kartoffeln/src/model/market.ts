import * as Type from 'typebox'
import {
    DemandRange,
    demandRowIndex,
    demandRowIndexFor,
    demandRows,
    priceChangeForDemandShift,
    priceMarks,
    shiftedDemand,
    shiftedPrice
} from '../components/marketBoards.js'
import type { MarketChanges } from '../components/messages.js'
import { MarketId, Quality, marketDefinition } from '../components/potatoes.js'
import type { HydratedDickeKartoffelnGameState } from './gameState.js'
import type { FieldState } from './playerState.js'

export type MarketMove = Type.Static<typeof MarketMove>
// The demand rows' ranges in sacks and the prices in marks, as they stood.
export const MarketMove = Type.Object({
    marketId: Type.Enum(MarketId),
    offered: Type.Number(),
    demandBefore: DemandRange,
    demandAfter: DemandRange,
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
    const rows = demandRows(board)
    const rowBefore = demandRowIndex(board, market.demandRowId)
    const rowAfter = demandRowIndexFor(board, offered)
    const priceBefore = priceMarks(board, market.priceSpaceId)
    const steps = priceChangeForDemandShift(Math.abs(rowAfter - rowBefore))
    const direction = Math.sign(rowBefore - rowAfter)
    market.demandRowId = rows[rowAfter].id
    market.priceSpaceId = shiftedPrice(board, market.priceSpaceId, direction * steps)
    return {
        marketId: id,
        offered,
        demandBefore: { ...rows[rowBefore].range },
        demandAfter: { ...rows[rowAfter].range },
        priceBefore,
        priceAfter: priceMarks(board, market.priceSpaceId)
    }
}

export function shiftDemand(state: HydratedDickeKartoffelnGameState, changes: MarketChanges) {
    const board = state.marketBoard()
    for (const market of state.markets) {
        market.demandRowId = shiftedDemand(board, market.demandRowId, changes[market.id] ?? 0)
    }
}

export function shiftPrices(state: HydratedDickeKartoffelnGameState, steps: number) {
    const board = state.marketBoard()
    for (const market of state.markets) {
        market.priceSpaceId = shiftedPrice(board, market.priceSpaceId, steps)
    }
}
