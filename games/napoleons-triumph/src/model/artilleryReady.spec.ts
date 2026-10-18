import { describe, expect, it } from 'vitest'
import { Side } from '../components/pieces.js'
import { TestGame } from '../testing/harness.js'
import { artilleryMayFire, artilleryReadyRound, restingArtillery } from './attackOrders.js'

const FLAT = { from: 72, to: 74 }
const DOWNHILL = { from: 25, to: 38 }

function underway(): TestGame {
    const game = new TestGame()
    game.deployBoth()
    return game
}

function approachOf(game: TestGame, between: { from: number; to: number }): number {
    return game.hydrated.map.approachBetween(between.from, between.to).id
}

function roundsUntilReady(between: { from: number; to: number }, roundsAgo: number) {
    const game = underway()
    const approach = approachOf(game, between)
    const french = game.playerOf(Side.French)
    game.arrange((state) => {
        state.getPlayerState(french).artilleryFire = { [String(approach)]: state.round - roundsAgo }
    })
    const ready = artilleryReadyRound(game.hydrated, french, approach)
    return ready === undefined ? undefined : ready - game.hydrated.round
}

describe('the round artillery may lead again from an approach it fired across', () => {
    it('is two rounds after it fired', () => {
        expect(roundsUntilReady(FLAT, 0)).toBe(2)
        expect(roundsUntilReady(FLAT, 1)).toBe(1)
        expect(roundsUntilReady(FLAT, 2)).toBeUndefined()
    })

    it('is the next round when it fires down from a hill', () => {
        expect(roundsUntilReady(DOWNHILL, 0)).toBe(1)
        expect(roundsUntilReady(DOWNHILL, 1)).toBeUndefined()
    })

    it('is not asked of guns that never fired there', () => {
        const game = underway()
        const approach = approachOf(game, FLAT)
        expect(artilleryReadyRound(game.hydrated, game.playerOf(Side.French), approach)).toBe(
            undefined
        )
    })

    it("holds back only the army whose guns fired, the other army's guns may fire from that approach", () => {
        const game = underway()
        const approach = approachOf(game, FLAT)
        const french = game.playerOf(Side.French)
        game.arrange((state) => {
            state.getPlayerState(french).artilleryFire = { [String(approach)]: state.round - 1 }
        })
        expect(artilleryMayFire(game.hydrated, french, approach)).toBe(false)
        expect(artilleryMayFire(game.hydrated, game.playerOf(Side.Allied), approach)).toBe(true)
    })

    it('holds back both armies in games that recorded the fire for both', () => {
        const game = underway()
        const approach = approachOf(game, FLAT)
        game.arrange((state) => {
            state.artilleryFire = { [String(approach)]: state.round - 1 }
        })
        for (const side of [Side.French, Side.Allied]) {
            expect(artilleryMayFire(game.hydrated, game.playerOf(side), approach)).toBe(false)
        }
    })

    it('lists each army whose guns rest, and fire recorded for both armies without one', () => {
        const game = underway()
        const flat = approachOf(game, FLAT)
        const downhill = approachOf(game, DOWNHILL)
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        game.arrange((state) => {
            state.getPlayerState(french).artilleryFire = { [String(flat)]: state.round }
            state.getPlayerState(allied).artilleryFire = {
                [String(flat)]: state.round - 1,
                [String(downhill)]: state.round - 1
            }
            state.artilleryFire = { [String(downhill)]: state.round, [String(flat)]: state.round }
        })
        const round = game.hydrated.round
        expect(restingArtillery(game.hydrated)).toHaveLength(3)
        expect(restingArtillery(game.hydrated)).toEqual(
            expect.arrayContaining([
                { attackApproach: flat, playerId: french, ready: round + 2 },
                { attackApproach: flat, playerId: allied, ready: round + 1 },
                { attackApproach: downhill, playerId: undefined, ready: round + 1 }
            ])
        )
    })
})
