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
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import { Expand, HydratedExpand } from './expand.js'
import { IndonesiaAreaType, IndonesiaNeighborDirection } from '../utils/indonesiaNodes.js'

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

function findProductionExpansionFixture(state: ReturnType<typeof createTestState>) {
    for (const node of state.board) {
        if (node.type !== IndonesiaAreaType.Land) {
            continue
        }

        for (const candidateAreaId of node.neighbors[IndonesiaNeighborDirection.Land]) {
            const candidateNode = state.board.graph.nodeById(candidateAreaId)
            if (!candidateNode || candidateNode.type !== IndonesiaAreaType.Land) {
                continue
            }

            const conflictAreaId = candidateNode.neighbors[IndonesiaNeighborDirection.Land].find(
                (neighborId) => neighborId !== node.id
            )
            if (!conflictAreaId) {
                continue
            }

            return {
                companyCultivatedAreaId: node.id,
                candidateExpansionAreaId: candidateAreaId,
                conflictingNeighborAreaId: conflictAreaId,
                blockedNeighborAreaIds: node.neighbors[IndonesiaNeighborDirection.Land].filter(
                    (neighborId) => neighborId !== candidateAreaId
                )
            }
        }
    }

    return null
}

function findShippingExpansionFixture(state: ReturnType<typeof createTestState>) {
    const seaNodes = Array.from(state.board).filter((node) => node.type === IndonesiaAreaType.Sea)

    for (const originNode of seaNodes) {
        const adjacentAreaId = originNode.neighbors[IndonesiaNeighborDirection.Sea][0]
        if (!adjacentAreaId) {
            continue
        }

        const nonAdjacentArea = seaNodes.find(
            (node) =>
                node.id !== originNode.id &&
                node.id !== adjacentAreaId &&
                !originNode.neighbors[IndonesiaNeighborDirection.Sea].includes(node.id)
        )
        if (!nonAdjacentArea) {
            continue
        }

        return {
            originAreaId: originNode.id,
            adjacentAreaId,
            nonAdjacentAreaId: nonAdjacentArea.id
        }
    }

    return null
}

describe('HydratedExpand.canExpand', () => {
    it('allows shipping expansion when ship count is below era capacity', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const shippingDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Shipping && (deed.sizes[state.era] ?? 0) > 0
        )
        const fixture = findShippingExpansionFixture(state)

        expect(shippingDeed).toBeDefined()
        expect(fixture).toBeDefined()
        if (!shippingDeed || shippingDeed.type !== CompanyType.Shipping || !fixture) {
            return
        }

        const companyId = 'company-shipping'
        const allowedShipCount = shippingDeed.sizes[state.era] ?? 0
        state.companies = [
            {
                id: companyId,
                type: CompanyType.Shipping,
                owner: playerId,
                deeds: [shippingDeed]
            }
        ]
        state.operatingCompanyId = companyId
        state.machineState = MachineState.ShippingOperations
        state.board.areas[fixture.originAreaId] = {
            id: fixture.originAreaId,
            type: AreaType.Sea,
            ships: Array.from({ length: allowedShipCount - 1 }, () => companyId)
        }

        expect(HydratedExpand.canExpand(state, playerId)).toBe(true)
        expect(HydratedExpand.canExpand(state, playerId, fixture.adjacentAreaId)).toBe(true)
    })

    it('blocks shipping expansion when ship count is at era capacity', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const shippingDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Shipping && (deed.sizes[state.era] ?? 0) > 0
        )
        const fixture = findShippingExpansionFixture(state)

        expect(shippingDeed).toBeDefined()
        expect(fixture).toBeDefined()
        if (!shippingDeed || shippingDeed.type !== CompanyType.Shipping || !fixture) {
            return
        }

        const companyId = 'company-shipping'
        const allowedShipCount = shippingDeed.sizes[state.era] ?? 0
        state.companies = [
            {
                id: companyId,
                type: CompanyType.Shipping,
                owner: playerId,
                deeds: [shippingDeed]
            }
        ]
        state.operatingCompanyId = companyId
        state.machineState = MachineState.ShippingOperations
        state.board.areas[fixture.originAreaId] = {
            id: fixture.originAreaId,
            type: AreaType.Sea,
            ships: Array.from({ length: allowedShipCount }, () => companyId)
        }

        expect(HydratedExpand.canExpand(state, playerId)).toBe(false)
        expect(HydratedExpand.canExpand(state, playerId, fixture.adjacentAreaId)).toBe(false)
    })

    it('blocks shipping expansion when target sea area is not connected to company ships', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const shippingDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Shipping && (deed.sizes[state.era] ?? 0) > 0
        )
        const fixture = findShippingExpansionFixture(state)

        expect(shippingDeed).toBeDefined()
        expect(fixture).toBeDefined()
        if (!shippingDeed || shippingDeed.type !== CompanyType.Shipping || !fixture) {
            return
        }

        const companyId = 'company-shipping'
        const allowedShipCount = shippingDeed.sizes[state.era] ?? 0
        state.companies = [
            {
                id: companyId,
                type: CompanyType.Shipping,
                owner: playerId,
                deeds: [shippingDeed]
            }
        ]
        state.operatingCompanyId = companyId
        state.machineState = MachineState.ShippingOperations
        state.board.areas[fixture.originAreaId] = {
            id: fixture.originAreaId,
            type: AreaType.Sea,
            ships: Array.from({ length: allowedShipCount - 1 }, () => companyId)
        }

        expect(HydratedExpand.canExpand(state, playerId)).toBe(true)
        expect(HydratedExpand.canExpand(state, playerId, fixture.nonAdjacentAreaId)).toBe(false)
    })

    it('blocks shipping expansion when target sea area already has the company ship', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const shippingDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Shipping && (deed.sizes[state.era] ?? 0) > 1
        )
        const fixture = findShippingExpansionFixture(state)

        expect(shippingDeed).toBeDefined()
        expect(fixture).toBeDefined()
        if (!shippingDeed || shippingDeed.type !== CompanyType.Shipping || !fixture) {
            return
        }

        const companyId = 'company-shipping'
        state.companies = [
            {
                id: companyId,
                type: CompanyType.Shipping,
                owner: playerId,
                deeds: [shippingDeed]
            }
        ]
        state.operatingCompanyId = companyId
        state.machineState = MachineState.ShippingOperations
        state.board.areas[fixture.originAreaId] = {
            id: fixture.originAreaId,
            type: AreaType.Sea,
            ships: [companyId]
        }

        expect(HydratedExpand.canExpand(state, playerId)).toBe(true)
        expect(HydratedExpand.canExpand(state, playerId, fixture.originAreaId)).toBe(false)
        expect(HydratedExpand.canExpand(state, playerId, fixture.adjacentAreaId)).toBe(true)
    })

    it('blocks shipping expansion when current operation reached the player expansion research limit', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const shippingDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Shipping && (deed.sizes[state.era] ?? 0) > 1
        )
        const fixture = findShippingExpansionFixture(state)

        expect(shippingDeed).toBeDefined()
        expect(fixture).toBeDefined()
        if (!shippingDeed || shippingDeed.type !== CompanyType.Shipping || !fixture) {
            return
        }

        const companyId = 'company-shipping'
        state.companies = [
            {
                id: companyId,
                type: CompanyType.Shipping,
                owner: playerId,
                deeds: [shippingDeed]
            }
        ]
        state.operatingCompanyId = companyId
        state.operatingCompanyExpansionCount = 1
        state.machineState = MachineState.ShippingOperations
        state.board.areas[fixture.originAreaId] = {
            id: fixture.originAreaId,
            type: AreaType.Sea,
            ships: [companyId]
        }

        expect(HydratedExpand.canExpand(state, playerId)).toBe(false)
        expect(HydratedExpand.canExpand(state, playerId, fixture.adjacentAreaId)).toBe(false)
    })

    it('throws when expansion target area id is invalid', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const shippingDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Shipping && (deed.sizes[state.era] ?? 0) > 0
        )
        const fixture = findShippingExpansionFixture(state)

        expect(shippingDeed).toBeDefined()
        expect(fixture).toBeDefined()
        if (!shippingDeed || shippingDeed.type !== CompanyType.Shipping || !fixture) {
            return
        }

        const companyId = 'company-shipping'
        state.companies = [
            {
                id: companyId,
                type: CompanyType.Shipping,
                owner: playerId,
                deeds: [shippingDeed]
            }
        ]
        state.operatingCompanyId = companyId
        state.machineState = MachineState.ShippingOperations
        state.board.areas[fixture.originAreaId] = {
            id: fixture.originAreaId,
            type: AreaType.Sea,
            ships: [companyId]
        }

        expect(() => HydratedExpand.canExpand(state, playerId, 'NOT_A_REAL_AREA')).toThrow(
            /Invalid area id/
        )
    })

    it('allows production expansion when an adjacent empty land area is valid', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const productionDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Production
        )
        const fixture = findProductionExpansionFixture(state)

        expect(productionDeed).toBeDefined()
        expect(fixture).toBeDefined()
        if (!productionDeed || productionDeed.type !== CompanyType.Production || !fixture) {
            return
        }

        const companyId = 'company-production'
        state.companies = [
            {
                id: companyId,
                type: CompanyType.Production,
                owner: playerId,
                deeds: [productionDeed],
                good: productionDeed.good
            }
        ]
        state.operatingCompanyId = companyId
        state.machineState = MachineState.ProductionOperations

        state.board.areas[fixture.companyCultivatedAreaId] = {
            id: fixture.companyCultivatedAreaId,
            type: AreaType.Cultivated,
            companyId,
            good: productionDeed.good
        }
        for (const blockedNeighborAreaId of fixture.blockedNeighborAreaIds) {
            state.board.areas[blockedNeighborAreaId] = {
                id: blockedNeighborAreaId,
                type: AreaType.City,
                cityId: `city-${blockedNeighborAreaId}`
            }
        }

        expect(HydratedExpand.canExpand(state, playerId)).toBe(true)
        expect(HydratedExpand.canExpand(state, playerId, fixture.candidateExpansionAreaId)).toBe(
            true
        )
    })

    it('blocks production expansion when adjacent empty land touches same-good cultivated area from another company', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const productionDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Production
        )
        const fixture = findProductionExpansionFixture(state)

        expect(productionDeed).toBeDefined()
        expect(fixture).toBeDefined()
        if (!productionDeed || productionDeed.type !== CompanyType.Production || !fixture) {
            return
        }

        const companyId = 'company-production'
        state.companies = [
            {
                id: companyId,
                type: CompanyType.Production,
                owner: playerId,
                deeds: [productionDeed],
                good: productionDeed.good
            }
        ]
        state.operatingCompanyId = companyId
        state.machineState = MachineState.ProductionOperations

        state.board.areas[fixture.companyCultivatedAreaId] = {
            id: fixture.companyCultivatedAreaId,
            type: AreaType.Cultivated,
            companyId,
            good: productionDeed.good
        }
        for (const blockedNeighborAreaId of fixture.blockedNeighborAreaIds) {
            state.board.areas[blockedNeighborAreaId] = {
                id: blockedNeighborAreaId,
                type: AreaType.City,
                cityId: `city-${blockedNeighborAreaId}`
            }
        }
        state.board.areas[fixture.conflictingNeighborAreaId] = {
            id: fixture.conflictingNeighborAreaId,
            type: AreaType.Cultivated,
            companyId: 'other-company',
            good: productionDeed.good
        }

        expect(HydratedExpand.canExpand(state, playerId)).toBe(false)
        expect(HydratedExpand.canExpand(state, playerId, fixture.candidateExpansionAreaId)).toBe(
            false
        )
    })

    it('apply places a ship for shipping expansion', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const shippingDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Shipping && (deed.sizes[state.era] ?? 0) > 1
        )
        const fixture = findShippingExpansionFixture(state)

        expect(shippingDeed).toBeDefined()
        expect(fixture).toBeDefined()
        if (!shippingDeed || shippingDeed.type !== CompanyType.Shipping || !fixture) {
            return
        }

        const companyId = 'company-shipping'
        state.companies = [
            {
                id: companyId,
                type: CompanyType.Shipping,
                owner: playerId,
                deeds: [shippingDeed]
            }
        ]
        state.operatingCompanyId = companyId
        state.machineState = MachineState.ShippingOperations
        state.board.areas[fixture.originAreaId] = {
            id: fixture.originAreaId,
            type: AreaType.Sea,
            ships: [companyId]
        }

        expect(HydratedExpand.canExpand(state, playerId, fixture.adjacentAreaId)).toBe(true)

        const action = new HydratedExpand(
            createAction(Expand, {
                id: 'action-expand-1',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId,
                areaId: fixture.adjacentAreaId
            })
        )
        action.apply(state)

        const expandedArea = state.board.getArea(fixture.adjacentAreaId)
        if (!('ships' in expandedArea)) {
            return
        }
        expect(expandedArea.ships).toContain(companyId)
        expect(
            expandedArea.ships.filter((shipCompanyId: string) => shipCompanyId === companyId)
        ).toHaveLength(1)
    })
})
