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
import { AreaType } from '../components/area.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { Good } from '../definition/goods.js'

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

describe('HydratedIndonesiaGameState city demand helpers', () => {
    it('returns zero remaining demand for goods not currently produced on the board', () => {
        const state = createTestState()
        state.board.addCity({
            id: 'city-1',
            area: 'A01',
            size: 2,
            demand: {}
        })

        const city = state.board.cities[0]
        expect(state.remainingCityDemandForGood(city, Good.Rice)).toBe(0)
        expect(state.canCityAcceptGood(city, Good.Rice)).toBe(false)
    })

    it('tracks delivered demand and remaining demand for produced goods', () => {
        const state = createTestState()
        state.board.addCity({
            id: 'city-1',
            area: 'A01',
            size: 2,
            demand: {
                [Good.Rice]: 1
            }
        })
        state.board.areas['A02'] = {
            id: 'A02',
            type: AreaType.Cultivated,
            companyId: 'company-1',
            good: Good.Rice
        }

        const city = state.board.cities[0]
        expect(state.currentCityDemandForGood(city, Good.Rice)).toBe(1)
        expect(state.remainingCityDemandForGood(city, Good.Rice)).toBe(1)
        expect(state.canCityAcceptGood(city, Good.Rice)).toBe(true)
    })

    it('records city good deliveries and enforces demand caps', () => {
        const state = createTestState()
        state.board.addCity({
            id: 'city-1',
            area: 'A01',
            size: 1,
            demand: {}
        })
        state.board.areas['A02'] = {
            id: 'A02',
            type: AreaType.Cultivated,
            companyId: 'company-1',
            good: Good.Rice
        }

        state.recordCityGoodDelivery('city-1', Good.Rice, 1)

        const city = state.board.cities[0]
        expect(city.demand[Good.Rice]).toBe(1)
        expect(state.remainingCityDemandForGood(city, Good.Rice)).toBe(0)
        expect(() => state.recordCityGoodDelivery('city-1', Good.Rice, 1)).toThrow(
            /exceeds remaining demand/
        )
    })

    it('resets city demand at the start of an operations phase', () => {
        const state = createTestState()
        state.board.addCity({
            id: 'city-1',
            area: 'A01',
            size: 2,
            demand: {
                [Good.Rice]: 1,
                [Good.Spice]: 2
            }
        })

        state.resetCityDemandsForOperationsPhase()

        const city = state.board.cities[0]
        expect(city.demand).toEqual({})
    })
})
