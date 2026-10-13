import { describe, expect, it } from 'vitest'
import { AUSTERLITZ, Side, commandersOf } from '@tabletop/napoleons-triumph'
import { leftToRightFromOwnLines } from './seatOrder.js'

function seats(side: Side): string[] {
    const alphabetical = commandersOf(side)
        .map((commander) => commander.id)
        .toSorted()
    return leftToRightFromOwnLines(AUSTERLITZ, side, alphabetical)
}

describe('the order of the corps in set-up', () => {
    it('runs from the French left in the north to their right in the south, with the corps that come on later last', () => {
        expect(seats(Side.French)).toEqual([
            'bessieres',
            'lannes',
            'murat',
            'vandamme',
            'st-hilaire',
            'legrand',
            'bernadotte',
            'davout'
        ])
    })

    it('runs from the Allied left in the south to their right in the north', () => {
        expect(seats(Side.Allied)).toEqual([
            'kienmayer',
            'dokhturov',
            'langeron',
            'liechtenstein',
            'prebyshevsky',
            'miloradovich',
            'kollowrath',
            'constantine',
            'bagration'
        ])
    })
})
