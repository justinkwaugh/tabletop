import { describe, expect, it } from 'vitest'
import type { AuctionResult } from '@tabletop/marracash'
import { bidsInTableOrder } from './auctionBids.js'

// Seating order amira, bashir, chadia, dalia; chadia auctions, so bids are recorded from chadia.
const result: AuctionResult = {
    shopId: 'Y1',
    bids: [
        { playerId: 'chadia', amount: 100 },
        { playerId: 'dalia', amount: 200 },
        { playerId: 'amira', amount: 0 },
        { playerId: 'bashir', amount: 200 }
    ],
    winnerId: 'dalia',
    price: 200,
    auctioneerCut: 100,
    pullIns: []
}

describe('auction bid table', () => {
    it('lists the highest bid first and breaks ties clockwise from the auctioneer', () => {
        const order = bidsInTableOrder(result)
        expect(order.map((bid) => bid.playerId)).toEqual(['dalia', 'bashir', 'chadia', 'amira'])
    })
})
