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
import { Good } from '../definition/goods.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { IndonesiaAreaType, IndonesiaNeighborDirection } from '../utils/indonesiaNodes.js'
import { buildDeliveryProblem } from './deliveryProblemBuilder.js'

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

function findAdjacentSeaPair(state: ReturnType<typeof createTestState>) {
    for (const node of state.board) {
        if (node.type !== IndonesiaAreaType.Sea) {
            continue
        }

        const adjacentSeaAreaId = node.neighbors[IndonesiaNeighborDirection.Sea][0]
        if (!adjacentSeaAreaId) {
            continue
        }

        return {
            seaAreaId: node.id,
            adjacentSeaAreaId
        }
    }

    return null
}

describe('buildDeliveryProblem', () => {
    it('builds production zones and city demands for the operating production company', () => {
        const state = createTestState()
        state.companies = [
            {
                id: 'prod-1',
                type: CompanyType.Production,
                owner: state.players[0].playerId,
                deeds: [],
                good: Good.Rice
            }
        ]
        state.board.areas['A01'] = {
            id: 'A01',
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
        state.board.areas['C20'] = {
            id: 'C20',
            type: AreaType.Cultivated,
            companyId: 'prod-1',
            good: Good.Rice
        }
        state.board.addCity({
            id: 'city-a',
            area: 'A04',
            size: 2,
            demand: {
                [Good.Rice]: 1
            }
        })
        state.board.addCity({
            id: 'city-b',
            area: 'C19',
            size: 1,
            demand: {}
        })

        const problem = buildDeliveryProblem(state, 'prod-1')

        expect(problem.operatingCompanyId).toBe('prod-1')
        expect(problem.good).toBe(Good.Rice)
        expect(problem.zoneSupplies).toHaveLength(2)
        expect(problem.zoneSupplies[0]).toEqual({
            zoneId: 'prod-1:zone:1',
            areaIds: ['A01', 'A03'],
            adjacentSeaAreaIds: ['S14'],
            supply: 2
        })
        expect(problem.zoneSupplies[1].zoneId).toBe('prod-1:zone:2')
        expect(problem.zoneSupplies[1].areaIds).toEqual(['C20'])
        expect(problem.zoneSupplies[1].supply).toBe(1)
        expect(problem.zoneSupplies[1].adjacentSeaAreaIds.length).toBeGreaterThan(0)

        const cityDemandById = new Map(problem.cityDemands.map((demand) => [demand.cityId, demand]))
        expect(cityDemandById.get('city-a')).toBeDefined()
        expect(cityDemandById.get('city-b')).toBeDefined()
        expect(cityDemandById.get('city-a')?.cityAreaId).toBe('A04')
        expect(cityDemandById.get('city-a')?.remainingDemand).toBe(1)
        expect(cityDemandById.get('city-a')?.adjacentSeaAreaIds).toContain('S14')
        expect(cityDemandById.get('city-b')?.cityAreaId).toBe('C19')
        expect(cityDemandById.get('city-b')?.remainingDemand).toBe(1)
        expect((cityDemandById.get('city-b')?.adjacentSeaAreaIds.length ?? 0) > 0).toBe(true)
    })

    it('builds shipping networks with hull-scaled capacities and in-network sea lanes', () => {
        const state = createTestState()
        const seaPair = findAdjacentSeaPair(state)

        expect(seaPair).toBeDefined()
        if (!seaPair) {
            return
        }

        const ownerA = state.players[0].playerId
        const ownerB = state.players[1].playerId
        state.getPlayerState(ownerA).research.hull = 2
        state.getPlayerState(ownerB).research.hull = 1

        state.companies = [
            {
                id: 'prod-1',
                type: CompanyType.Production,
                owner: ownerA,
                deeds: [],
                good: Good.Rice
            },
            {
                id: 'ship-a',
                type: CompanyType.Shipping,
                owner: ownerA,
                deeds: []
            },
            {
                id: 'ship-b',
                type: CompanyType.Shipping,
                owner: ownerB,
                deeds: []
            }
        ]
        state.board.areas['A01'] = {
            id: 'A01',
            type: AreaType.Cultivated,
            companyId: 'prod-1',
            good: Good.Rice
        }
        state.board.areas[seaPair.seaAreaId] = {
            id: seaPair.seaAreaId,
            type: AreaType.Sea,
            ships: ['ship-a', 'ship-a', 'ship-b']
        }
        state.board.areas[seaPair.adjacentSeaAreaId] = {
            id: seaPair.adjacentSeaAreaId,
            type: AreaType.Sea,
            ships: ['ship-a']
        }

        const problem = buildDeliveryProblem(state, 'prod-1')
        const shipANetwork = problem.shippingCompanyNetworks.find(
            (network) => network.shippingCompanyId === 'ship-a'
        )
        const shipBNetwork = problem.shippingCompanyNetworks.find(
            (network) => network.shippingCompanyId === 'ship-b'
        )

        expect(shipANetwork).toBeDefined()
        expect(shipBNetwork).toBeDefined()
        if (!shipANetwork || !shipBNetwork) {
            return
        }

        const shipACapacityBySeaAreaId = new Map(
            shipANetwork.seaAreaCapacities.map((entry) => [entry.seaAreaId, entry.capacity])
        )
        expect(shipACapacityBySeaAreaId.get(seaPair.seaAreaId)).toBe(6)
        expect(shipACapacityBySeaAreaId.get(seaPair.adjacentSeaAreaId)).toBe(3)
        expect(shipANetwork.seaLanes).toEqual([
            {
                fromSeaAreaId:
                    seaPair.adjacentSeaAreaId.localeCompare(seaPair.seaAreaId) <= 0
                        ? seaPair.adjacentSeaAreaId
                        : seaPair.seaAreaId,
                toSeaAreaId:
                    seaPair.adjacentSeaAreaId.localeCompare(seaPair.seaAreaId) <= 0
                        ? seaPair.seaAreaId
                        : seaPair.adjacentSeaAreaId
            }
        ])

        expect(shipBNetwork.seaAreaCapacities).toEqual([
            {
                seaAreaId: seaPair.seaAreaId,
                capacity: 2
            }
        ])
        expect(shipBNetwork.seaLanes).toEqual([])
    })
})
