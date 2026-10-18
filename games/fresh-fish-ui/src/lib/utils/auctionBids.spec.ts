import { describe, expect, it } from 'vitest'
import { createAction } from '@tabletop/common'
import { EndAuction, MachineState, PlaceStall, GoodsType } from '@tabletop/fresh-fish'
import { wonStallPrice } from './auctionBids.js'

const auctionWonFor3 = createAction(EndAuction, {
    id: 'e',
    winnerId: 'p1',
    highBid: 3,
    metadata: { participants: [] }
})
const stallPlaced = createAction(PlaceStall, {
    id: 's',
    playerId: 'p1',
    goodsType: GoodsType.Cheese,
    coords: [0, 0]
})

describe('wonStallPrice', () => {
    it('is the high bid of the auction just won', () => {
        expect(wonStallPrice(MachineState.AuctionEnded, [auctionWonFor3])).toBe(3)
    })

    it('is undefined for a final stall, which no auction sold', () => {
        expect(
            wonStallPrice(MachineState.TileBagEmptied, [auctionWonFor3, stallPlaced])
        ).toBeUndefined()
    })
})
