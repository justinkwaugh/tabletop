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
import { ActionType } from '../definition/actions.js'
import { Good } from '../definition/goods.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import { GrowCity, HydratedGrowCity } from './growCity.js'

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

describe('HydratedGrowCity', () => {
    it('grows an eligible city and moves city tokens to the next size', () => {
        const state = createTestState()
        const growthDecisionPlayerId = state.turnManager.turnOrder[0]
        expect(growthDecisionPlayerId).toBeDefined()
        if (!growthDecisionPlayerId) {
            return
        }

        state.machineState = MachineState.CityGrowth
        state.board.areas['A05'] = {
            id: 'A05',
            type: AreaType.Cultivated,
            companyId: 'prod-1',
            good: Good.Rice
        }
        state.board.areas['A06'] = {
            id: 'A06',
            type: AreaType.Cultivated,
            companyId: 'prod-2',
            good: Good.Spice
        }
        state.board.addCity({
            id: 'city-1',
            area: 'A01',
            size: 1,
            demand: {
                [Good.Rice]: 1,
                [Good.Spice]: 1
            }
        })

        const initialSize1Tokens = state.availableCities.size1
        const initialSize2Tokens = state.availableCities.size2

        const action = new HydratedGrowCity(
            createAction(GrowCity, {
                id: `grow-city-${state.actionCount}`,
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: growthDecisionPlayerId,
                type: ActionType.GrowCity,
                cityId: 'city-1'
            })
        )

        action.apply(state)

        expect(state.board.cities[0].size).toBe(2)
        expect(state.availableCities.size1).toBe(initialSize1Tokens + 1)
        expect(state.availableCities.size2).toBe(initialSize2Tokens - 1)
        expect(action.metadata).toEqual({
            oldSize: 1,
            newSize: 2
        })
    })

    it('is invalid when the city has not received all produced goods', () => {
        const state = createTestState()
        const growthDecisionPlayerId = state.turnManager.turnOrder[0]
        expect(growthDecisionPlayerId).toBeDefined()
        if (!growthDecisionPlayerId) {
            return
        }

        state.machineState = MachineState.CityGrowth
        state.board.areas['A05'] = {
            id: 'A05',
            type: AreaType.Cultivated,
            companyId: 'prod-1',
            good: Good.Rice
        }
        state.board.areas['A06'] = {
            id: 'A06',
            type: AreaType.Cultivated,
            companyId: 'prod-2',
            good: Good.Spice
        }
        state.board.addCity({
            id: 'city-1',
            area: 'A01',
            size: 1,
            demand: {
                [Good.Rice]: 1
            }
        })

        const action = new HydratedGrowCity(
            createAction(GrowCity, {
                id: `grow-city-${state.actionCount}`,
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: growthDecisionPlayerId,
                type: ActionType.GrowCity,
                cityId: 'city-1'
            })
        )

        expect(action.isValidGrowCity(state)).toBe(false)
    })
})
