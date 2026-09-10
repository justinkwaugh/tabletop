import { expect, it } from 'vitest'
import { committedBidAmount, availableBidAmount } from './bidCommitment.js'
const bids = [
    { lotId: 'a', playerId: 'one', amount: 30 },
    { lotId: 'b', playerId: 'one', amount: 50 },
    { lotId: 'a', playerId: 'two', amount: 40 }
]
it('counts commitments by player across lots, including losing bids', () => {
    expect(committedBidAmount(bids, 'one')).toBe(80)
    expect(committedBidAmount(bids, 'two')).toBe(40)
    expect(availableBidAmount(100, bids, 'one')).toBe(20)
})
it('releases only the same player’s replaced lot when calculating a new bid', () => {
    expect(availableBidAmount(100, bids, 'one', 'a')).toBe(50)
    expect(availableBidAmount(100, bids, 'two', 'a')).toBe(100)
    expect(availableBidAmount(100, bids, 'one', 'c')).toBe(20)
    expect(availableBidAmount(100, [], 'one')).toBe(100)
})
