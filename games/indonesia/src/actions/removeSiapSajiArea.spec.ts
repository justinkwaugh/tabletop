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
import { AreaType } from '../components/area.js'
import { Good } from '../definition/goods.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import { HydratedRemoveSiapSajiArea, RemoveSiapSajiArea } from './removeSiapSajiArea.js'

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
    initialized.machineState = MachineState.Mergers
    return initialized
}

describe('HydratedRemoveSiapSajiArea', () => {
    it('converts remaining company areas to siap saji after the final required removal', () => {
        const state = createTestState()
        state.activePlayerIds = ['p1']

        state.board.areas.A01 = {
            id: 'A01',
            type: AreaType.Cultivated,
            companyId: 'merged-company',
            good: Good.Spice
        }
        state.board.areas.A02 = {
            id: 'A02',
            type: AreaType.Cultivated,
            companyId: 'merged-company',
            good: Good.Rice
        }

        state.pendingSiapSajiReduction = {
            companyId: 'merged-company',
            winnerId: 'p1',
            removalsRemaining: 1,
            totalRemovals: 1
        }

        const action = new HydratedRemoveSiapSajiArea(
            createAction(RemoveSiapSajiArea, {
                id: 'remove-siap-saji-area',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: 'p1',
                areaId: 'A01'
            })
        )

        action.apply(state)

        expect(state.board.areas.A01).toEqual({
            id: 'A01',
            type: AreaType.EmptyLand
        })
        expect(state.board.areas.A02).toEqual({
            id: 'A02',
            type: AreaType.Cultivated,
            companyId: 'merged-company',
            good: Good.SiapSaji
        })
        expect(state.pendingSiapSajiReduction).toBeUndefined()
    })
})
