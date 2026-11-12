import { assert } from '@tabletop/common'
import {
    demandRows,
    priceChangeForDemandShift,
    priceSpaces,
    type MarketBoardId,
    type MarketPosition
} from '@tabletop/dicke-kartoffeln'

export type MarketTrack = 'demand' | 'price'

export const MARKET_TRACKS = ['demand', 'price'] as const satisfies readonly MarketTrack[]

export function trackSpaces(board: MarketBoardId, track: MarketTrack): readonly { id: string }[] {
    return track === 'demand' ? demandRows(board) : priceSpaces(board)
}

export function markerSpaceId(position: MarketPosition, track: MarketTrack): string {
    return track === 'demand' ? position.demandRowId : position.priceSpaceId
}

export function markerRow(
    board: MarketBoardId,
    position: MarketPosition,
    track: MarketTrack
): number {
    const spaceId = markerSpaceId(position, track)
    const row = trackSpaces(board, track).findIndex((space) => space.id === spaceId)
    assert(row >= 0, `No ${track} space ${spaceId} on the ${board} board`)
    return row
}

export type PriceChange = { rowsMoved: string; priceSteps: number }

export const PRICE_CHANGES: readonly PriceChange[] = [
    { rowsMoved: '0', priceSteps: priceChangeForDemandShift(0) },
    { rowsMoved: '1', priceSteps: priceChangeForDemandShift(1) },
    { rowsMoved: '2–3', priceSteps: priceChangeForDemandShift(2) },
    { rowsMoved: '4+', priceSteps: priceChangeForDemandShift(4) }
]
