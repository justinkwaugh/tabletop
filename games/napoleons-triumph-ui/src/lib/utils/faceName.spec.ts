import { describe, expect, it } from 'vitest'
import { Side, STARTING_ARMIES } from '@tabletop/napoleons-triumph'
import { faceName } from './faceName.js'

describe('the name of a unit face', () => {
    it('tells apart every kind of unit an army starts with', () => {
        for (const side of [Side.French, Side.Allied]) {
            const names = new Set(STARTING_ARMIES[side].map(faceName))
            const kinds = new Set(STARTING_ARMIES[side].map((face) => JSON.stringify(face)))
            expect(names.size).toBe(kinds.size)
        }
    })

    it('uses the rulebook’s words for the guard, heavy cavalry and artillery', () => {
        expect(new Set(STARTING_ARMIES[Side.Allied].map(faceName))).toEqual(
            new Set([
                'artillery',
                '1-strength cavalry',
                '2-strength cavalry',
                'heavy cavalry',
                '1-strength infantry',
                '2-strength infantry',
                '3-strength infantry',
                'guard infantry'
            ])
        )
    })
})
