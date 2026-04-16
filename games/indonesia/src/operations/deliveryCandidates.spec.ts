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
import { Era } from '../definition/eras.js'
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

function createThreePlayerTestState() {
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
        },
        {
            id: 'p3',
            isHuman: true,
            userId: 'u3',
            name: 'Player 3',
            status: PlayerStatus.Joined
        }
    ]

    const game: Game = {
        id: 'game-3p',
        typeId: 'indonesia',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'u2',
        name: 'Indonesia Three Player Test',
        players,
        config: {},
        hotseat: false,
        winningPlayerIds: [],
        seed: 456,
        createdAt: new Date(),
        storage: GameStorage.Local,
        category: GameCategory.Standard
    }

    const state: UninitializedGameState = {
        id: 'state-3p',
        gameId: game.id,
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 456, invocations: 0 },
        winningPlayerIds: []
    }

    return new IndonesiaGameInitializer().initializeGameState(game, state)
}

function setupLongRouteCandidateScenario(state: ReturnType<typeof createThreePlayerTestState>) {
    const bluePlayerId = state.players[1]?.playerId
    const orangePlayerId = state.players[2]?.playerId
    expect(bluePlayerId).toBeDefined()
    expect(orangePlayerId).toBeDefined()
    if (!bluePlayerId || !orangePlayerId) {
        throw Error('Expected three players in test state')
    }

    state.activePlayerIds = [bluePlayerId]
    state.machineState = MachineState.ProductionOperations
    state.era = Era.B
    state.getPlayerState(bluePlayerId).research.hull = 1
    state.getPlayerState(orangePlayerId).research.hull = 2

    state.companies = [
        {
            id: 'blue-rubber',
            type: CompanyType.Production,
            owner: bluePlayerId,
            deeds: [
                {
                    id: 'D13',
                    type: CompanyType.Production,
                    era: Era.B,
                    region: 'R10',
                    good: Good.Rubber
                }
            ],
            good: Good.Rubber
        },
        {
            id: 'blue-ship',
            type: CompanyType.Shipping,
            owner: bluePlayerId,
            deeds: [
                {
                    id: 'D08',
                    type: CompanyType.Shipping,
                    era: Era.A,
                    region: 'R26',
                    sizes: {
                        A: 3,
                        B: 4,
                        C: 5
                    }
                },
                {
                    id: 'D06',
                    type: CompanyType.Shipping,
                    era: Era.A,
                    region: 'R08',
                    sizes: {
                        A: 2,
                        B: 3,
                        C: 4
                    }
                },
                {
                    id: 'D16',
                    type: CompanyType.Shipping,
                    era: Era.B,
                    region: 'R02',
                    sizes: {
                        B: 4,
                        C: 5
                    }
                }
            ]
        },
        {
            id: 'orange-ship',
            type: CompanyType.Shipping,
            owner: orangePlayerId,
            deeds: [
                {
                    id: 'D07',
                    type: CompanyType.Shipping,
                    era: Era.A,
                    region: 'R14',
                    sizes: {
                        A: 3,
                        B: 3,
                        C: 4
                    }
                },
                {
                    id: 'D05',
                    type: CompanyType.Shipping,
                    era: Era.A,
                    region: 'R20',
                    sizes: {
                        A: 2,
                        B: 3,
                        C: 3
                    }
                }
            ]
        }
    ]

    for (const areaId of ['B01', 'B02', 'B03', 'B05', 'B09']) {
        state.board.areas[areaId] = {
            id: areaId,
            type: AreaType.Cultivated,
            companyId: 'blue-rubber',
            good: Good.Rubber
        }
    }

    for (const [areaId, ships] of Object.entries({
        S01: ['orange-ship', 'blue-ship'],
        S02: ['orange-ship', 'blue-ship'],
        S03: ['blue-ship'],
        S05: ['blue-ship'],
        S06: ['blue-ship'],
        S10: ['blue-ship'],
        S11: ['blue-ship'],
        S13: ['orange-ship'],
        S14: ['blue-ship'],
        S15: ['orange-ship'],
        S16: ['orange-ship', 'blue-ship'],
        S17: ['blue-ship', 'orange-ship'],
        S18: ['blue-ship']
    })) {
        state.board.areas[areaId] = {
            id: areaId,
            type: AreaType.Sea,
            ships
        }
    }

    state.board.addCity({
        id: 'city-d02',
        area: 'D02',
        size: 2,
        demand: {
            Rubber: 1,
            Rice: 2,
            SiapSaji: 2
        }
    })
    state.board.addCity({
        id: 'city-d11',
        area: 'D11',
        size: 3,
        demand: {
            Rice: 3,
            SiapSaji: 2
        }
    })
    state.board.addCity({
        id: 'city-e06',
        area: 'E06',
        size: 1,
        demand: {
            Rice: 1,
            SiapSaji: 1
        }
    })

    state.beginCompanyOperation('blue-rubber')
    state.setOperatingCompanyProducedGoodsCount(5)
    state.setOperatingCompanyDeliveryPlan({
        operatingCompanyId: 'blue-rubber',
        good: Good.Rubber,
        deliveries: [
            {
                zoneId: 'blue-rubber:zone:1',
                cityId: 'city-d02',
                shippingCompanyId: 'blue-ship',
                quantity: 1,
                seaPathAreaIds: ['S05', 'S02']
            },
            {
                zoneId: 'blue-rubber:zone:1',
                cityId: 'city-d11',
                shippingCompanyId: 'blue-ship',
                quantity: 2,
                seaPathAreaIds: ['S11', 'S16', 'S03', 'S10', 'S18', 'S17']
            },
            {
                zoneId: 'blue-rubber:zone:1',
                cityId: 'city-e06',
                shippingCompanyId: 'blue-ship',
                quantity: 1,
                seaPathAreaIds: ['S05', 'S02', 'S01']
            }
        ],
        shipUses: [
            {
                shippingCompanyId: 'blue-ship',
                seaAreaId: 'S01',
                uses: 1
            },
            {
                shippingCompanyId: 'blue-ship',
                seaAreaId: 'S02',
                uses: 2
            },
            {
                shippingCompanyId: 'blue-ship',
                seaAreaId: 'S03',
                uses: 2
            },
            {
                shippingCompanyId: 'blue-ship',
                seaAreaId: 'S05',
                uses: 2
            },
            {
                shippingCompanyId: 'blue-ship',
                seaAreaId: 'S10',
                uses: 2
            },
            {
                shippingCompanyId: 'blue-ship',
                seaAreaId: 'S11',
                uses: 2
            },
            {
                shippingCompanyId: 'blue-ship',
                seaAreaId: 'S16',
                uses: 2
            },
            {
                shippingCompanyId: 'blue-ship',
                seaAreaId: 'S17',
                uses: 2
            },
            {
                shippingCompanyId: 'blue-ship',
                seaAreaId: 'S18',
                uses: 2
            }
        ],
        shippingPayments: [
            {
                shippingCompanyId: 'blue-ship',
                amount: 85
            }
        ],
        totalDelivered: 4,
        revenue: 120,
        shippingCost: 85,
        netIncome: 35,
        tieBreakResult: {
            policy: DeliveryTieBreakPolicy.MinShippingCost,
            deliveredGoods: 4,
            shippingCost: 85
        }
    })

    return {
        bluePlayerId
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
        expect(safeCandidates).toHaveLength(6)
        expect(new Set(safeCandidates.map((candidate) => candidate.cultivatedAreaId))).toEqual(
            new Set(['A01', 'A02', 'A03'])
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

    it('keeps solver-required longer routes as safe delivery candidates', () => {
        const state = createThreePlayerTestState()
        const { bluePlayerId } = setupLongRouteCandidateScenario(state)

        const safeCandidates = listSafeAtomicDeliveryCandidatesForPlayer(state, bluePlayerId)
        const safeRouteKeys = new Set(
            safeCandidates.map(
                (candidate) =>
                    `${candidate.shippingCompanyId}|${candidate.cityId}|${candidate.seaAreaIds.join('>')}`
            )
        )

        expect(safeRouteKeys).toEqual(
            new Set([
                'blue-ship|city-d02|S05>S02',
                'blue-ship|city-d11|S11>S16>S03>S10>S18>S17',
                'blue-ship|city-e06|S05>S02>S01'
            ])
        )
    })
})
