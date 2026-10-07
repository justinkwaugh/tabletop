import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, MarketColor, QueueEnd } from '@tabletop/marracash'
import { backTrim, frontShift, frontTaken } from './queueShift.js'

const { Red, Blue, Green, Yellow } = MarketColor

function bring(end: QueueEnd, count: number): GameAction {
    const details = { end, count, entranceId: 1 }
    return {
        id: `${end}-${count}`,
        gameId: 'game',
        type: ActionType.BringVisitors,
        source: ActionSource.User,
        ...details
    }
}

describe('frontTaken', () => {
    it('counts only the visitors taken from the front', () => {
        expect(
            frontTaken([
                bring(QueueEnd.Front, 3),
                bring(QueueEnd.Back, 4),
                bring(QueueEnd.Front, 2)
            ])
        ).toBe(5)
        expect(frontTaken([])).toBe(0)
    })
})

describe('frontShift', () => {
    const queue = [Red, Blue, Green, Yellow, Red]

    it('moves the rest forward when visitors leave the front', () => {
        expect(frontShift(queue, queue.slice(2))).toBe(2)
    })

    it('leaves the rest in place when visitors leave the back', () => {
        expect(frontShift(queue, queue.slice(0, 3))).toBe(0)
    })

    it('moves the rest back when a front refill is undone', () => {
        expect(frontShift(queue.slice(2), queue)).toBe(-2)
    })
})

describe('backTrim', () => {
    const queue = [Red, Blue, Green, Yellow, Red]

    it('counts visitors that left the back', () => {
        expect(backTrim(queue, queue.slice(0, 3))).toBe(2)
    })

    it('ignores visitors that left the front', () => {
        expect(backTrim(queue, queue.slice(2))).toBe(0)
    })
})
