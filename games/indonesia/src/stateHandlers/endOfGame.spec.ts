import {
    GameCategory,
    GameResult,
    GameStatus,
    GameStorage,
    MachineContext,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import { EndOfGameStateHandler } from './endOfGame.js'

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
    initialized.machineState = MachineState.EndOfGame
    return initialized
}

describe('EndOfGameStateHandler', () => {
    it('scores winner by cash+bank', () => {
        const state = createTestState()
        const [firstPlayerId, secondPlayerId] = state.turnManager.turnOrder
        expect(firstPlayerId).toBeDefined()
        expect(secondPlayerId).toBeDefined()
        if (!firstPlayerId || !secondPlayerId) {
            return
        }

        state.getPlayerState(firstPlayerId).cash = 100
        state.getPlayerState(firstPlayerId).bank = 5
        state.getPlayerState(secondPlayerId).cash = 120
        state.getPlayerState(secondPlayerId).bank = 10

        const handler = new EndOfGameStateHandler()
        const context = new MachineContext({
            gameConfig: {},
            gameState: state
        })
        handler.enter(context)

        expect(state.getPlayerState(firstPlayerId).cash).toBe(100)
        expect(state.getPlayerState(secondPlayerId).cash).toBe(120)
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toEqual([secondPlayerId])
        expect(state.activePlayerIds).toEqual([])
    })

    it('uses turn order as the tie-breaker', () => {
        const state = createTestState()
        const [firstPlayerId, secondPlayerId] = state.turnManager.turnOrder
        expect(firstPlayerId).toBeDefined()
        expect(secondPlayerId).toBeDefined()
        if (!firstPlayerId || !secondPlayerId) {
            return
        }

        state.getPlayerState(firstPlayerId).cash = 100
        state.getPlayerState(firstPlayerId).bank = 5
        state.getPlayerState(secondPlayerId).cash = 105
        state.getPlayerState(secondPlayerId).bank = 0

        const handler = new EndOfGameStateHandler()
        const context = new MachineContext({
            gameConfig: {},
            gameState: state
        })
        handler.enter(context)

        expect(state.winningPlayerIds).toEqual([firstPlayerId])
    })

    it('does not mutate operations earnings stack in end-of-game handler', () => {
        const state = createTestState()
        const [firstPlayerId, secondPlayerId] = state.turnManager.turnOrder
        expect(firstPlayerId).toBeDefined()
        expect(secondPlayerId).toBeDefined()
        if (!firstPlayerId || !secondPlayerId) {
            return
        }

        state.getPlayerState(firstPlayerId).cash = 150
        state.getPlayerState(firstPlayerId).bank = 0
        state.getPlayerState(secondPlayerId).cash = 120
        state.getPlayerState(secondPlayerId).bank = 20
        state.operationsEarningsByPlayerId = {
            [firstPlayerId]: -20,
            [secondPlayerId]: 0
        }

        const handler = new EndOfGameStateHandler()
        const context = new MachineContext({
            gameConfig: {},
            gameState: state
        })
        handler.enter(context)

        expect(state.getPlayerState(firstPlayerId).cash).toBe(150)
        expect(state.getPlayerState(secondPlayerId).cash).toBe(120)
        expect(state.operationsEarningsByPlayerId).toEqual({
            [firstPlayerId]: -20,
            [secondPlayerId]: 0
        })
    })
})
