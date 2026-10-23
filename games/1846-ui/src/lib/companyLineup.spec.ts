import { describe, expect, it } from 'vitest'
import { GameEngine, PlayerStatus } from '@tabletop/common'
import { Definition, Runtime, type EighteenFortySixProjectedState } from '@tabletop/1846'
import { companyLineup } from './companyLineup.js'

function opening(count: number): EighteenFortySixProjectedState {
    const engine = new GameEngine(Runtime)
    const game = Runtime.initializer.initializeGame(
        {
            id: '1846-lineup',
            typeId: '1846',
            ownerId: 'p1',
            seed: 7,
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index + 1}`,
                userId: `p${index + 1}`,
                name: `Player ${index + 1}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    return engine.startGame(game, '7'.padStart(32, '0')).initialState
}

describe('companyLineup', () => {
    it.each([
        [5, 7, 10, 5],
        [4, 6, 8, 4],
        [3, 5, 6, 3],
        [2, 5, 8, 0]
    ])(
        'splits a %i-player setup into %i corporations, %i privates and %i Pass cards',
        (count, corporations, privates, passCards) => {
            const lineup = companyLineup(opening(count), (id) => id)
            expect(lineup.playerCount).toBe(count)
            expect(lineup.corporations).toHaveLength(corporations)
            expect(lineup.removedCorporations).toHaveLength(7 - corporations)
            expect(lineup.privateNames).toHaveLength(privates)
            expect(lineup.removedPrivateNames).toHaveLength(12 - privates)
            expect(lineup.passCards).toBe(passCards)
        }
    )
})
