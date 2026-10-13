import { describe, expect, it } from 'vitest'
import { Side, type Face } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    guard,
    infantry
} from '@tabletop/napoleons-triumph/testing'
import { inReadingOrder } from './unitTypeOrder.js'

const AS_DEALT: Face[] = [
    cavalry(2),
    artillery(),
    infantry(1),
    cavalry(3),
    guard(),
    infantry(3),
    infantry(2)
]

function corps() {
    const game = new TestGame()
    game.deployBoth()
    arrangeBattlefield(
        game,
        AS_DEALT.map((face, index) => ({
            id: `unit-${index}`,
            side: Side.French,
            face,
            locale: 94,
            commanderId: 'lannes'
        }))
    )
    return game.hydrated.units
}

describe('the order a player reads their own units in', () => {
    it('is Guard, infantry, cavalry, artillery, and the strongest first within each', () => {
        expect(inReadingOrder(corps()).map((unit) => unit.face)).toEqual([
            guard(),
            infantry(3),
            infantry(2),
            infantry(1),
            cavalry(3),
            cavalry(2),
            artillery()
        ])
    })

    it('leaves units as they are given when a face among them is not known', () => {
        const [hidden, ...rest] = corps()
        const partlyKnown = [{ ...hidden, face: undefined }, ...rest]
        expect(inReadingOrder(partlyKnown)).toEqual(partlyKnown)
    })
})
