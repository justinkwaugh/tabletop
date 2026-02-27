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
import { CompanyType } from '../definition/companyType.js'
import { ActionType } from '../definition/actions.js'
import { DeliveryTieBreakPolicy } from '../definition/operationsEconomy.js'
import { Good } from '../definition/goods.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import { DeliverGood, HydratedDeliverGood } from './deliverGood.js'

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

function createDeliverGoodAction(state: ReturnType<typeof createTestState>, playerId: string) {
    return new HydratedDeliverGood(
        createAction(DeliverGood, {
            id: `deliver-good-${state.actionCount}`,
            gameId: state.gameId,
            source: ActionSource.User,
            playerId,
            type: ActionType.DeliverGood
        })
    )
}

function setupProductionOperationWithPlan(
    state: ReturnType<typeof createTestState>,
    playerId: string,
    totalDelivered: number
): void {
    const companyId = 'prod-1'
    state.companies = [
        {
            id: companyId,
            type: CompanyType.Production,
            owner: playerId,
            deeds: [],
            good: Good.Rice
        }
    ]

    state.machineState = MachineState.ProductionOperations
    state.beginCompanyOperation(companyId)
    state.setOperatingCompanyDeliveryPlan({
        operatingCompanyId: companyId,
        good: Good.Rice,
        deliveries: [],
        shipUses: [],
        shippingPayments: [],
        totalDelivered,
        revenue: totalDelivered * 20,
        shippingCost: 0,
        netIncome: totalDelivered * 20,
        tieBreakResult: {
            policy: DeliveryTieBreakPolicy.MinShippingCost,
            deliveredGoods: totalDelivered,
            shippingCost: 0
        }
    })
}

describe('HydratedDeliverGood', () => {
    it('increments shipped goods count when applied', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        setupProductionOperationWithPlan(state, playerId, 2)
        const action = createDeliverGoodAction(state, playerId)

        expect(state.operatingCompanyShippedGoodsCount).toBe(0)

        action.apply(state)

        expect(state.operatingCompanyShippedGoodsCount).toBe(1)
        expect(action.metadata).toEqual({})
    })

    it('cannot deliver more goods than the delivery plan allows', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        setupProductionOperationWithPlan(state, playerId, 1)
        const action = createDeliverGoodAction(state, playerId)

        action.apply(state)

        expect(HydratedDeliverGood.canDeliverGood(state, playerId)).toBe(false)
        expect(() => action.apply(state)).toThrow('Invalid DeliverGood action')
    })
})
