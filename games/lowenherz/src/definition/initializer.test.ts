import { describe, expect, it } from 'vitest'
import { Game, GameStatus, GameStorage, PlayerStatus } from '@tabletop/common'
import { LowenherzGameInitializer } from './initializer.js'

function buildGame(playerCount: number): Game {
    return {
        id: 'game-1',
        typeId: 'lowenherz',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'p1',
        name: 'Test Game',
        players: Array.from({ length: playerCount }, (_, i) => ({
            id: `p${i + 1}`,
            isHuman: true,
            name: `Player ${i + 1}`,
            status: PlayerStatus.Joined
        })),
        config: {},
        hotseat: true,
        createdAt: new Date(),
        winningPlayerIds: [],
        storage: GameStorage.Local
    }
}

describe('LowenherzGameInitializer', () => {
    it('keeps turnOrder stable even after turnManager.turnOrder is rotated in place', () => {
        const initializer = new LowenherzGameInitializer()
        const game = buildGame(4)

        const state = initializer.initializeGameState(game, {
            id: 'game-1',
            gameId: 'game-1',
            activePlayerIds: [],
            actionCount: 0,
            actionChecksum: 0,
            prng: { seed: 1, invocations: 0 },
            winningPlayerIds: []
        })

        const originalTurnOrder = [...state.turnOrder]
        expect(state.turnOrder.length).toBe(4)

        // Regression check: this is the kind of in-place rotation the generic engine
        // performs on turnManager.turnOrder as part of its own bookkeeping. Our own
        // turnOrder field must not be the same array reference, or it'd get scrambled
        // too - which is exactly the bug that made every 2nd-lap placement fail.
        state.turnManager.newFirstPlayer(state.turnOrder[2])

        expect(state.turnOrder).toEqual(originalTurnOrder)
        expect(state.turnManager.turnOrder).not.toEqual(originalTurnOrder)
    })
})
