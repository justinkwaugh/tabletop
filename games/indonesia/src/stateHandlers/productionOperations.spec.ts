import {
    ActionSource,
    GameCategory,
    GameStatus,
    GameStorage,
    MachineContext,
    PlayerStatus,
    createAction,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { DeliverGood, HydratedDeliverGood } from '../actions/deliverGood.js'
import { HydratedPass, Pass, PassReason } from '../actions/pass.js'
import { ActionType } from '../definition/actions.js'
import { AreaType } from '../components/area.js'
import { CompanyType } from '../definition/companyType.js'
import { Good } from '../definition/goods.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { DeliveryTieBreakPolicy } from '../definition/operationsEconomy.js'
import { PhaseName } from '../definition/phases.js'
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

    it('stays in production operations after a delivery when more safe deliveries remain', () => {
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
        state.board.areas['A02'] = {
            id: 'A02',
            type: AreaType.Cultivated,
            companyId: 'prod-1',
            good: Good.Rice
        }
        state.board.areas['S14'] = {
            id: 'S14',
            type: AreaType.Sea,
            ships: ['ship-1', 'ship-1']
        }
        state.board.addCity({
            id: 'city-1',
            area: 'A04',
            size: 2,
            demand: {}
        })

        state.machineState = MachineState.ProductionOperations
        state.beginCompanyOperation('prod-1')

        const handler = new ProductionOperationsStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        const action = new HydratedDeliverGood(
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

        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.ProductionOperations)
        expect(state.operatingCompanyShippedGoodsCount).toBe(1)
    })

    it('queues skip expansion when production operation has no deliveries and no valid expansion', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId

        state.companies = [
            {
                id: 'prod-1',
                type: CompanyType.Production,
                owner: playerId,
                deeds: [],
                good: Good.Rice
            }
        ]

        state.machineState = MachineState.ProductionOperations
        state.beginCompanyOperation('prod-1')

        const handler = new ProductionOperationsStateHandler()
        const context = createMachineContext(state)
        handler.enter(context)

        const pendingActions = context.getPendingActions()
        expect(pendingActions).toHaveLength(1)
        expect(pendingActions[0]).toMatchObject({
            type: ActionType.Pass,
            playerId,
            reason: PassReason.SkipProductionExpansion
        })
    })

    it('finishes operating company when player passes optional production expansion', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const otherPlayerId = state.players[1].playerId

        state.companies = [
            {
                id: 'prod-1',
                type: CompanyType.Production,
                owner: playerId,
                deeds: [],
                good: Good.Rice
            },
            {
                id: 'prod-2',
                type: CompanyType.Production,
                owner: otherPlayerId,
                deeds: [],
                good: Good.Spice
            }
        ]
        state.board.areas['A01'] = {
            id: 'A01',
            type: AreaType.Cultivated,
            companyId: 'prod-1',
            good: Good.Rice
        }

        state.machineState = MachineState.ProductionOperations
        state.phaseManager.startPhase(PhaseName.Operations, state.actionCount)
        state.turnManager.startTurn(playerId, state.actionCount)
        state.beginCompanyOperation('prod-1')
        state.operatingCompanyDeliveryPlan = {
            operatingCompanyId: 'prod-1',
            good: Good.Rice,
            deliveries: [],
            shipUses: [],
            shippingPayments: [],
            totalDelivered: 0,
            revenue: 0,
            shippingCost: 0,
            netIncome: 0,
            tieBreakResult: {
                policy: DeliveryTieBreakPolicy.MinShippingCost,
                deliveredGoods: 0,
                shippingCost: 0
            }
        }
        state.setOperatingCompanyProducedGoodsCount(1)
        state.operatingCompanyShippedGoodsCount = 0

        const handler = new ProductionOperationsStateHandler()
        const context = createMachineContext(state)
        const action = new HydratedPass(
            createAction(Pass, {
                id: `pass-${state.actionCount}`,
                gameId: state.gameId,
                source: ActionSource.User,
                playerId,
                type: ActionType.Pass,
                reason: PassReason.FinishOptionalProductionExpansion
            })
        )

        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.Operations)
        expect(state.operatedCompanyIds).toEqual(['prod-1'])
        expect(state.operatingCompanyId).toBeUndefined()
    })
})
