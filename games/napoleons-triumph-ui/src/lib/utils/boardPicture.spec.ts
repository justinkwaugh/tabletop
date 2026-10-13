import { describe, expect, it } from 'vitest'
import { Scenario } from '@tabletop/napoleons-triumph'
import { TestGame, passTurns } from '@tabletop/napoleons-triumph/testing'
import { boardPictureName } from './boardPicture.js'

describe('the name of a saved picture of the board', () => {
    it('says the game is being set up before play begins', () => {
        expect(boardPictureName(new TestGame().hydrated, true)).toBe('napoleons-triumph-set-up.jpg')
    })

    it('gives the day and the hour of the round, in letters and digits only', () => {
        const game = new TestGame()
        game.deployBoth()
        expect(boardPictureName(game.hydrated, true)).toBe(
            'napoleons-triumph-2-december-7-00am.jpg'
        )
        passTurns(game, 2)
        expect(boardPictureName(game.hydrated, true)).toBe(
            'napoleons-triumph-2-december-8-00am.jpg'
        )
    })

    it('names the night of the two-day battle', () => {
        const game = new TestGame({ scenario: Scenario.December1 })
        game.deployBoth()
        passTurns(game, 20)
        expect(boardPictureName(game.hydrated, true)).toBe('napoleons-triumph-1-december-night.jpg')
    })

    it('says so when the picture does not tell what the units are', () => {
        const game = new TestGame()
        game.deployBoth()
        expect(boardPictureName(game.hydrated, false)).toBe(
            'napoleons-triumph-2-december-7-00am-unit-types-hidden.jpg'
        )
    })
})
