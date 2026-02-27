import {
    GameCategory,
    GameStatus,
    GameStorage,
    MachineContext,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { AreaType } from '../components/area.js'
import { CompanyType } from '../definition/companyType.js'
import { Good } from '../definition/goods.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import { ProductionOperationsStateHandler } from './productionOperations.js'

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

function createMachineContext(state: ReturnType<typeof createTestState>) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

describe('ProductionOperationsStateHandler', () => {
    it('solves and stores a delivery plan when entering production operations', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        state.getPlayerState(playerId).research.hull = 0

        state.companies = [
            {
                id: 'prod-1',
                type: CompanyType.Production,
                owner: playerId,
                deeds: [],
                good: Good.Rice
            },
            {
                id: 'ship-1',
                type: CompanyType.Shipping,
                owner: playerId,
                deeds: []
            }
        ]

        state.board.areas['A01'] = {
            id: 'A01',
            type: AreaType.Cultivated,
            companyId: 'prod-1',
            good: Good.Rice
        }
        state.board.areas['S14'] = {
            id: 'S14',
            type: AreaType.Sea,
            ships: ['ship-1']
        }
        state.board.addCity({
            id: 'city-1',
            area: 'A04',
            size: 1,
            demand: {}
        })

        state.machineState = MachineState.ProductionOperations
        state.beginCompanyOperation('prod-1')

        const handler = new ProductionOperationsStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        expect(state.operatingCompanyDeliveryPlan).toBeDefined()
        expect(state.operatingCompanyShippedGoodsCount).toBe(0)
        expect(state.operatingCompanyDeliveryPlan).toMatchObject({
            operatingCompanyId: 'prod-1',
            good: Good.Rice,
            totalDelivered: 1,
            revenue: 20,
            shippingCost: 5,
            netIncome: 15
        })
    })
})
