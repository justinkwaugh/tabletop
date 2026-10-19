import { expect, it } from 'vitest'
import { PassableBidding } from './passableBidding.js'

it('opens without a bid from the first player and goes unsold when everyone passes', () => {
    let bidding = new PassableBidding(PassableBidding.openWithoutBid('sale', ['b', 'c', 'a']))
    expect(bidding.hasBid).toBe(false)
    expect(bidding.currentBidderId).toBe('b')
    bidding = new PassableBidding(bidding.pass('b'))
    expect(bidding.currentBidderId).toBe('c')
    bidding = new PassableBidding(bidding.withdrawBelow(10, (id) => (id === 'c' ? 0 : 100)))
    // The last bidder left must still bid or pass.
    expect(bidding.winner).toBeUndefined()
    expect(bidding.currentBidderId).toBe('a')
    expect(new PassableBidding(bidding.pass('a')).unsold).toBe(true)
    bidding = new PassableBidding(bidding.bid('a', 10))
    expect(bidding.winner).toEqual({ playerId: 'a', amount: 10 })
})
