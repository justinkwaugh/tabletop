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
            type: ActionType.DeliverGood,
            cultivatedAreaId: 'A01',
            shippingCompanyId: 'ship-1',
            seaAreaIds: ['S14'],
            cityId: 'city-1'
        })
    )
}

function setupProductionOperationWithPlan(
    state: ReturnType<typeof createTestState>,
    playerId: string,
    totalDelivered: number
): void {
    const companyId = 'prod-1'
    const shippingCompanyId = 'ship-1'
    const shippingOwnerId = state.players.find((player) => player.playerId !== playerId)?.playerId
    if (!shippingOwnerId) {
        throw Error('Expected at least one non-operating player to own the shipping company')
    }

    state.getPlayerState(shippingOwnerId).research.hull = 0

    state.companies = [
        {
            id: companyId,
            type: CompanyType.Production,
            owner: playerId,
            deeds: [],
            good: Good.Rice
        },
        {
            id: shippingCompanyId,
            type: CompanyType.Shipping,
            owner: shippingOwnerId,
            deeds: []
        }
    ]
    state.board.areas['A01'] = {
        id: 'A01',
        type: AreaType.Cultivated,
        companyId,
        good: Good.Rice
    }
    state.board.areas['S14'] = {
        id: 'S14',
        type: AreaType.Sea,
        ships: Array.from({ length: totalDelivered }, () => shippingCompanyId)
    }
    state.board.addCity({
        id: 'city-1',
        area: 'A04',
        size: totalDelivered,
        demand: {}
    })

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
        const shippingOwnerId = state.players[1].playerId
        const productionOwnerCashBefore = state.getPlayerState(playerId).cash
        const shippingOwnerCashBefore = state.getPlayerState(shippingOwnerId).cash
        setupProductionOperationWithPlan(state, playerId, 1)
        const action = createDeliverGoodAction(state, playerId)

        expect(state.operatingCompanyShippedGoodsCount).toBe(0)

        action.apply(state)

        expect(state.operatingCompanyShippedGoodsCount).toBe(1)
        expect(state.operatingCompanyDeliveredCultivatedAreaIds).toEqual(['A01'])
        expect(state.operatingCompanyShipUseCount('ship-1', 'S14')).toBe(1)
        expect(state.board.cities[0]?.demand[Good.Rice]).toBe(1)
        expect(action.metadata).toEqual({
            revenue: 20,
            shippingCost: 5,
            netProfit: 15,
            shippingPayments: [
                {
                    shippingCompanyId: 'ship-1',
                    ownerPlayerId: shippingOwnerId,
                    amount: 5
                }
            ]
        })
        expect(state.operationsIncomeByCompanyId).toEqual({
            'prod-1': 15,
            'ship-1': 5
        })
        expect(state.operationsEarningsByPlayerId).toEqual({
            [playerId]: 15,
            [shippingOwnerId]: 5
        })
        expect(state.operationsDeliveredCultivatedAreaIdsByCompanyId).toEqual({
            'prod-1': ['A01']
        })
        expect(state.getPlayerState(playerId).cash).toBe(productionOwnerCashBefore)
        expect(state.getPlayerState(shippingOwnerId).cash).toBe(shippingOwnerCashBefore)
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

    it('can deliver even when the production owner cash is below shipping cost', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        setupProductionOperationWithPlan(state, playerId, 1)
        state.getPlayerState(playerId).cash = 4
        const action = createDeliverGoodAction(state, playerId)

        expect(HydratedDeliverGood.canDeliverGood(state, playerId)).toBe(true)
        expect(() => action.apply(state)).not.toThrow()
    })
})
