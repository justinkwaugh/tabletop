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
import { CompanyType } from '../definition/companyType.js'
import { DeliveryTieBreakPolicy } from '../definition/operationsEconomy.js'
import { Good } from '../definition/goods.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import {
    isSafeAtomicDeliveryChoiceForPlayer,
    isValidAtomicDeliveryChoiceForPlayer,
    listAtomicDeliveryCandidatesForPlayer,
    listSafeAtomicDeliveryCandidatesForPlayer
} from './deliveryCandidates.js'

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

function setupSafePrefixScenario(state: ReturnType<typeof createTestState>) {
    const productionOwnerId = state.players[0]?.playerId
    const shippingOwnerId = state.players[1]?.playerId
    expect(productionOwnerId).toBeDefined()
    expect(shippingOwnerId).toBeDefined()
    if (!productionOwnerId || !shippingOwnerId) {
        throw Error('Expected two players in test state')
    }

    state.getPlayerState(shippingOwnerId).research.hull = 0
    state.companies = [
        {
            id: 'prod-1',
            type: CompanyType.Production,
            owner: productionOwnerId,
            deeds: [],
            good: Good.Rice
        },
        {
            id: 'ship-a',
            type: CompanyType.Shipping,
            owner: shippingOwnerId,
            deeds: []
        },
        {
            id: 'ship-b',
            type: CompanyType.Shipping,
            owner: shippingOwnerId,
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
    state.board.areas['A03'] = {
        id: 'A03',
        type: AreaType.Cultivated,
        companyId: 'prod-1',
        good: Good.Rice
    }
    state.board.areas['S14'] = {
        id: 'S14',
        type: AreaType.Sea,
        ships: ['ship-a', 'ship-b', 'ship-b']
    }
    state.board.areas['S06'] = {
        id: 'S06',
        type: AreaType.Sea,
        ships: ['ship-a']
    }

    state.board.addCity({
        id: 'city-main',
        area: 'A04',
        size: 2,
        demand: {}
    })
    state.board.addCity({
        id: 'city-remote',
        area: 'A11',
        size: 1,
        demand: {}
    })

    state.machineState = MachineState.ProductionOperations
    state.beginCompanyOperation('prod-1')
    state.setOperatingCompanyDeliveryPlan({
        operatingCompanyId: 'prod-1',
        good: Good.Rice,
        deliveries: [],
        shipUses: [],
        shippingPayments: [],
        totalDelivered: 3,
        revenue: 60,
        shippingCost: 20,
        netIncome: 40,
        tieBreakResult: {
            policy: DeliveryTieBreakPolicy.MinShippingCost,
            deliveredGoods: 3,
            shippingCost: 20
        }
    })

    return {
        productionOwnerId
    }
}

describe('deliveryCandidates', () => {
    it('filters unsafe first deliveries while keeping safe options', () => {
        const state = createTestState()
        const { productionOwnerId } = setupSafePrefixScenario(state)

        const candidates = listAtomicDeliveryCandidatesForPlayer(state, productionOwnerId)
        const safeCandidates = listSafeAtomicDeliveryCandidatesForPlayer(state, productionOwnerId)

        const routeKey = (candidate: { shippingCompanyId: string; cityId: string; seaAreaIds: string[] }) =>
            `${candidate.shippingCompanyId}|${candidate.cityId}|${candidate.seaAreaIds.join('>')}`

        const allRouteKeys = new Set(candidates.map(routeKey))
        const safeRouteKeys = new Set(safeCandidates.map(routeKey))

        expect(allRouteKeys).toEqual(
            new Set([
                'ship-a|city-main|S14',
                'ship-a|city-remote|S14>S06',
                'ship-b|city-main|S14'
            ])
        )
        expect(safeRouteKeys).toEqual(
            new Set([
                'ship-a|city-remote|S14>S06',
                'ship-b|city-main|S14'
            ])
        )
    })

    it('treats a valid-but-unsafe choice as invalid for the safe-prefix rule', () => {
        const state = createTestState()
        const { productionOwnerId } = setupSafePrefixScenario(state)

        const unsafeChoice = {
            cultivatedAreaId: 'A01',
            shippingCompanyId: 'ship-a',
            seaAreaIds: ['S14'],
            cityId: 'city-main'
        }
        const safeChoice = {
            cultivatedAreaId: 'A01',
            shippingCompanyId: 'ship-a',
            seaAreaIds: ['S14', 'S06'],
            cityId: 'city-remote'
        }

        expect(isValidAtomicDeliveryChoiceForPlayer(state, productionOwnerId, unsafeChoice)).toBe(true)
        expect(isSafeAtomicDeliveryChoiceForPlayer(state, productionOwnerId, unsafeChoice)).toBe(
            false
        )
        expect(isSafeAtomicDeliveryChoiceForPlayer(state, productionOwnerId, safeChoice)).toBe(true)
    })
})
