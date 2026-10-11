import { describe, expect, it } from 'vitest'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
import { copyOf } from './stateCopy.js'

function underway() {
    const game = new TestGame()
    game.deployBoth()
    return game.hydrated
}

describe('a copy of the game to try a play on', () => {
    it('stands as the game stands', () => {
        const state = underway()
        expect(copyOf(state).dehydrate()).toEqual(state.dehydrate())
    })

    it('leaves the game alone when the copy is changed', () => {
        const state = underway()
        copyOf(state).commander('langeron').commandsThisTurn = 1
        expect(state.commander('langeron').commandsThisTurn).toBeUndefined()
    })
})
