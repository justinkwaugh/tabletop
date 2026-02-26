import {
    GameCategory,
    GameStatus,
    GameStorage,
    PlayerStatus,
    assert,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { AreaType } from '../components/area.js'
import { CompanyType } from '../definition/companyType.js'
import { Good } from '../definition/goods.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { buildDeliveryProblem } from './deliveryProblemBuilder.js'
import { solveDeliveryProblem } from './deliverySolver.js'

type CityInput = {
    areaId: string
    size: number
}

type ProductionCompanyInput = {
    id: string
    good: Good
    owner: string
    areaIds: readonly string[]
}

const CITY_INPUTS: CityInput[] = [
    { areaId: 'A02', size: 2 },
    { areaId: 'A11', size: 2 },
    { areaId: 'A21', size: 2 },
    { areaId: 'C03', size: 2 },
    { areaId: 'C17', size: 2 },
    { areaId: 'C22', size: 1 },
    { areaId: 'C26', size: 2 },
    { areaId: 'B13', size: 1 },
    { areaId: 'B14', size: 1 },
    { areaId: 'D08', size: 1 },
    { areaId: 'E04', size: 1 }
]

const SHIPPING_COMPANIES = [
    { id: 'A', owner: 'W' },
    { id: 'B', owner: 'Y' },
    { id: 'C', owner: 'Y' }
]

const SHIPS_BY_SEA_AREA: Record<string, string[]> = {
    S14: ['A', 'B'],
    S06: ['A', 'B'],
    S03: ['A', 'C'],
    S10: ['C'],
    S09: ['B'],
    S05: ['B'],
    S16: ['A'],
    S11: ['A'],
    S13: ['A', 'B'],
    S18: ['C'],
    S02: ['B', 'C'],
    S17: ['A', 'C'],
    S07: ['A', 'C'],
    S01: ['A', 'B', 'B'],
    S20: ['B', 'C']
}

const PRODUCTION_COMPANIES: ProductionCompanyInput[] = [
    {
        id: 'J',
        good: Good.SiapSaji,
        owner: 'W',
        areaIds: ['C01', 'C02', 'C05', 'C04', 'C07', 'C06', 'E12', 'E06', 'E08', 'E09', 'E07', 'E11']
    },
    {
        id: 'K',
        good: Good.SiapSaji,
        owner: 'W',
        areaIds: ['C09', 'C21', 'E03']
    },
    {
        id: 'L',
        good: Good.Spice,
        owner: 'W',
        areaIds: ['A31', 'A32', 'A33']
    },
    {
        id: 'M',
        good: Good.Oil,
        owner: 'W',
        areaIds: ['F06']
    },
    {
        id: 'N',
        good: Good.Rubber,
        owner: 'X',
        areaIds: ['A08', 'A10', 'A16', 'A15', 'A13', 'A14', 'A17', 'A24']
    },
    {
        id: 'O',
        good: Good.Oil,
        owner: 'X',
        areaIds: ['B09', 'B19']
    },
    {
        id: 'P',
        good: Good.Rubber,
        owner: 'X',
        areaIds: ['F03', 'F05', 'F04', 'F02', 'C20', 'B01', 'B03', 'B10', 'B18', 'B20', 'B16']
    },
    {
        id: 'Q',
        good: Good.Oil,
        owner: 'X',
        areaIds: ['C18', 'C29', 'C28', 'C25', 'C24', 'B12', 'B15']
    },
    {
        id: 'R',
        good: Good.SiapSaji,
        owner: 'Y',
        areaIds: ['B02', 'B04', 'B07', 'B06', 'B08', 'B11', 'B17']
    }
]

function createScenarioState(): HydratedIndonesiaGameState {
    const players: Player[] = ['W', 'X', 'Y'].map((playerId, index) => ({
        id: playerId,
        isHuman: true,
        userId: `u${index + 1}`,
        name: playerId,
        status: PlayerStatus.Joined
    }))

    const game: Game = {
        id: 'game-1',
        typeId: 'indonesia',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'u1',
        name: 'Recorded Indonesia Scenario',
        players,
        config: {},
        hotseat: false,
        winningPlayerIds: [],
        seed: 123,
        createdAt: new Date(),
        storage: GameStorage.Local,
        category: GameCategory.Standard
    }

    const baseState: UninitializedGameState = {
        id: 'state-1',
        gameId: game.id,
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 123, invocations: 0 },
        winningPlayerIds: []
    }

    const state = new IndonesiaGameInitializer().initializeGameState(game, baseState)

    state.getPlayerState('W').research.hull = 2
    state.getPlayerState('Y').research.hull = 4

    const cityAreaIds = new Set<string>()
    for (const cityInput of CITY_INPUTS) {
        cityAreaIds.add(cityInput.areaId)
        state.board.addCity({
            id: `city-${cityInput.areaId}`,
            area: cityInput.areaId,
            size: cityInput.size,
            demand: {}
        })
    }

    for (const [seaAreaId, ships] of Object.entries(SHIPS_BY_SEA_AREA)) {
        state.board.areas[seaAreaId] = {
            id: seaAreaId,
            type: AreaType.Sea,
            ships: [...ships]
        }
    }

    const cultivatedOwnerByAreaId = new Map<string, string>()
    for (const company of PRODUCTION_COMPANIES) {
        for (const areaId of company.areaIds) {
            assert(!cityAreaIds.has(areaId), `${areaId} cannot be both city and cultivated in scenario`)
            const existingOwner = cultivatedOwnerByAreaId.get(areaId)
            assert(
                existingOwner === undefined,
                `${areaId} was already cultivated by ${existingOwner} in scenario input`
            )
            cultivatedOwnerByAreaId.set(areaId, company.id)

            state.board.areas[areaId] = {
                id: areaId,
                type: AreaType.Cultivated,
                companyId: company.id,
                good: company.good
            }
        }
    }

    const companies: HydratedIndonesiaGameState['companies'] = []
    for (const company of SHIPPING_COMPANIES) {
        companies.push({
            id: company.id,
            type: CompanyType.Shipping,
            owner: company.owner,
            deeds: []
        })
    }

    for (const company of PRODUCTION_COMPANIES) {
        companies.push({
            id: company.id,
            type: CompanyType.Production,
            owner: company.owner,
            deeds: [],
            good: company.good
        })
    }

    state.companies = companies

    return state
}

describe('Recorded Scenario Delivery Solver', () => {
    it('builds delivery plans for all production companies in the recorded scenario', () => {
        const state = createScenarioState()
        const byCompany = Object.fromEntries(
            PRODUCTION_COMPANIES.map((company) => {
                const problem = buildDeliveryProblem(state, company.id)
                const plan = solveDeliveryProblem(problem)
                return [
                    company.id,
                    {
                        delivered: plan.totalDelivered,
                        shippingCost: plan.shippingCost,
                        netIncome: plan.netIncome,
                        deliveries: plan.deliveries.length
                    }
                ]
            })
        )

        expect(byCompany).toEqual({
            J: {
                delivered: 12,
                shippingCost: 130,
                netIncome: 350,
                deliveries: 10
            },
            K: {
                delivered: 3,
                shippingCost: 15,
                netIncome: 105,
                deliveries: 3
            },
            L: {
                delivered: 3,
                shippingCost: 30,
                netIncome: 45,
                deliveries: 2
            },
            M: {
                delivered: 1,
                shippingCost: 10,
                netIncome: 25,
                deliveries: 1
            },
            N: {
                delivered: 8,
                shippingCost: 55,
                netIncome: 185,
                deliveries: 6
            },
            O: {
                delivered: 2,
                shippingCost: 10,
                netIncome: 60,
                deliveries: 2
            },
            P: {
                delivered: 11,
                shippingCost: 145,
                netIncome: 185,
                deliveries: 9
            },
            Q: {
                delivered: 7,
                shippingCost: 55,
                netIncome: 190,
                deliveries: 6
            },
            R: {
                delivered: 7,
                shippingCost: 75,
                netIncome: 205,
                deliveries: 6
            }
        })
    })

})
