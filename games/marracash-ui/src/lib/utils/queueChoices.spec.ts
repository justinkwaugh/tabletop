import { describe, expect, it } from 'vitest'
import { QueueEnd } from '@tabletop/marracash'
import { queuePawnChoices, type QueuePawnChoice } from './queueChoices.js'

const { Front, Back } = QueueEnd

function choice(end: QueueEnd, count: number): QueuePawnChoice {
    return { kind: 'choice', choice: { end, count } }
}

const none: QueuePawnChoice = { kind: 'none' }
const ambiguous: QueuePawnChoice = { kind: 'ambiguous' }

describe('MarraCash queue pawn choices', () => {
    it('reads the first five pawns from each end of a long queue', () => {
        const choices = queuePawnChoices(12)
        expect(choices.slice(0, 6)).toEqual([
            choice(Front, 2),
            choice(Front, 2),
            choice(Front, 3),
            choice(Front, 4),
            choice(Front, 4),
            none
        ])
        expect(choices.slice(6)).toEqual([
            none,
            choice(Back, 4),
            choice(Back, 4),
            choice(Back, 3),
            choice(Back, 2),
            choice(Back, 2)
        ])
    })

    it('drops the fifth-pawn shortcut first when a pawn could be read from both ends', () => {
        expect(queuePawnChoices(9)).toEqual([
            choice(Front, 2),
            choice(Front, 2),
            choice(Front, 3),
            choice(Front, 4),
            none,
            choice(Back, 4),
            choice(Back, 3),
            choice(Back, 2),
            choice(Back, 2)
        ])
    })

    it('leaves pawns that both ends still reach to the buttons', () => {
        expect(queuePawnChoices(6)).toEqual([
            choice(Front, 2),
            choice(Front, 2),
            ambiguous,
            ambiguous,
            choice(Back, 2),
            choice(Back, 2)
        ])
    })

    it('takes the whole queue from the front when both ends bring the same pawns', () => {
        expect(queuePawnChoices(2)).toEqual([choice(Front, 2), choice(Front, 2)])
        expect(queuePawnChoices(1)).toEqual([choice(Front, 1)])
    })
})
