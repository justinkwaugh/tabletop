import {
    ActionSource,
    GameCategory,
    GameStatus,
    GameStorage,
    PlayerStatus,
    createAction,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { PlaceTurnOrderBid, HydratedPlaceTurnOrderBid } from './placeTurnOrderBid.js'

function createTestState() {
    const players: Player[] = [
        {
            id: 'p1',
            isHuman: true,
            userId: 'u1',
            name: 'Player 1',
            status: PlayerStatus.Joined
        },
        {
            id: 'p2',
            isHuman: true,
            userId: 'u2',
            name: 'Player 2',
            status: PlayerStatus.Joined
        }
    ]

    const game: Game = {
        id: 'game-1',
        typeId: 'indonesia',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'u1',
        name: 'Indonesia Test',
        players,
        config: {},
        hotseat: false,
        winningPlayerIds: [],
        seed: 123,
        createdAt: new Date(),
        storage: GameStorage.Local,
        category: GameCategory.Standard
    }

    const state: UninitializedGameState = {
        id: 'state-1',
        gameId: game.id,
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 123, invocations: 0 },
        winningPlayerIds: []
    }

    const initialized = new IndonesiaGameInitializer().initializeGameState(game, state)
    initialized.turnOrderBids = {}
    return initialized
}

describe('HydratedPlaceTurnOrderBid', () => {
    it('rejects fractional bids', () => {
        const state = createTestState()
        const playerId = state.turnManager.turnOrder[0]
        expect(playerId).toBeDefined()
        if (!playerId) {
            return
        }

        const action = new HydratedPlaceTurnOrderBid(
            createAction(PlaceTurnOrderBid, {
                id: 'fractional-bid',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId,
                amount: 1.5
            })
        )

        expect(action.isValidPlaceTurnOrderBid(state)).toBe(false)
        expect(() => action.apply(state)).toThrow(/Invalid PlaceTurnOrderBid action/)
    })

    it('accepts integer bids within cash', () => {
        const state = createTestState()
        const playerId = state.turnManager.turnOrder[0]
        expect(playerId).toBeDefined()
        if (!playerId) {
            return
        }

        const action = new HydratedPlaceTurnOrderBid(
            createAction(PlaceTurnOrderBid, {
                id: 'integer-bid',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId,
                amount: 2
            })
        )

        expect(action.isValidPlaceTurnOrderBid(state)).toBe(true)
    })

    it('applies integer bids and records totals plus player cash/bank deltas', () => {
        const state = createTestState()
        const playerId = state.turnManager.turnOrder[0]
        expect(playerId).toBeDefined()
        if (!playerId) {
            return
        }

        const playerState = state.getPlayerState(playerId)
        const cashBefore = playerState.cash
        const bankBefore = playerState.bank

        const action = new HydratedPlaceTurnOrderBid(
            createAction(PlaceTurnOrderBid, {
                id: 'apply-integer-bid',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId,
                amount: 3
            })
        )

        action.apply(state)

        expect(state.turnOrderBids?.[playerId]).toEqual({
            bid: 3,
            multiplier: 1,
            total: 3
        })
        expect(action.metadata).toEqual({
            multipliedAmount: 3
        })
        expect(playerState.cash).toBe(cashBefore - 3)
        expect(playerState.bank).toBe(bankBefore + 3)
    })
})
