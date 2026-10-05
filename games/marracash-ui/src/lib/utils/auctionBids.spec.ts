import { describe, expect, it } from 'vitest'
import type { AuctionResult } from '@tabletop/marracash'
import { bidsInTableOrder } from './auctionBids.js'

const result: AuctionResult = {
    shopId: 'Y1',
    bids: [
        { playerId: 'chadia', amount: 100 },
        { playerId: 'amira', amount: 0 },
        { playerId: 'bashir', amount: 200 },
        { playerId: 'dalia', amount: 100 }
    ],
    winnerId: 'bashir',
    price: 200,
    auctioneerCut: 100,
    pullIns: []
}

describe('auction bid table', () => {
    it('lists the highest bid first and equal bids in seating order', () => {
        const order = bidsInTableOrder(result, ['amira', 'bashir', 'dalia', 'chadia'])
        expect(order.map((bid) => bid.playerId)).toEqual(['bashir', 'dalia', 'chadia', 'amira'])
    })
})
