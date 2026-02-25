import {
    GameCategory,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import { HydratedStartCompany } from './startCompany.js'

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

    return new IndonesiaGameInitializer().initializeGameState(game, state)
}

describe('HydratedStartCompany.canStartCompany', () => {
    it('allows starting one company when slot research is zero', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        state.machineState = MachineState.Acquisitions
        state.activePlayerIds = [playerId]

        expect(state.getPlayerState(playerId).research.slots).toBe(0)
        expect(HydratedStartCompany.canStartCompany(state, playerId)).toBe(true)
    })

    it('blocks starting another company at slot limit when slot research is zero', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        state.machineState = MachineState.Acquisitions
        state.activePlayerIds = [playerId]

        state.getPlayerState(playerId).ownedCompanies.push('company-1')

        expect(HydratedStartCompany.canStartCompany(state, playerId)).toBe(false)
    })
})
