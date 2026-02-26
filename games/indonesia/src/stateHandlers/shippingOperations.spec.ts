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
import { AreaType } from '../components/area.js'
import { CompanyType } from '../definition/companyType.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import { IndonesiaAreaType, IndonesiaNeighborDirection } from '../utils/indonesiaNodes.js'
import { Expand, HydratedExpand } from '../actions/expand.js'
import { ShippingOperationsStateHandler } from './shippingOperations.js'

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

function findShippingExpansionFixture(state: ReturnType<typeof createTestState>) {
    const seaNodes = Array.from(state.board).filter((node) => node.type === IndonesiaAreaType.Sea)

    for (const originNode of seaNodes) {
        for (const firstTargetAreaId of originNode.neighbors[IndonesiaNeighborDirection.Sea]) {
            const firstTargetNode = state.board.graph.nodeById(firstTargetAreaId)
            if (!firstTargetNode || firstTargetNode.type !== IndonesiaAreaType.Sea) {
                continue
            }

            const secondTargetAreaId = [
                ...originNode.neighbors[IndonesiaNeighborDirection.Sea],
                ...firstTargetNode.neighbors[IndonesiaNeighborDirection.Sea]
            ].find(
                (candidateAreaId) =>
                    candidateAreaId !== originNode.id &&
                    candidateAreaId !== firstTargetAreaId &&
                    state.board.graph.nodeById(candidateAreaId)?.type === IndonesiaAreaType.Sea
            )
            if (!secondTargetAreaId) {
                continue
            }

            return {
                originAreaId: originNode.id,
                firstTargetAreaId,
                secondTargetAreaId
            }
        }
    }

    return null
}

function createMachineContext(state: ReturnType<typeof createTestState>) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

function createExpandAction(
    state: ReturnType<typeof createTestState>,
    playerId: string,
    areaId: string
) {
    return new HydratedExpand(
        createAction(Expand, {
            id: `expand-${state.actionCount}`,
            gameId: state.gameId,
            source: ActionSource.User,
            playerId,
            areaId
        })
    )
}

describe('ShippingOperationsStateHandler', () => {
    it('stays in shipping operations when the operating company can still expand', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const shippingDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Shipping && (deed.sizes[state.era] ?? 0) > 2
        )
        const fixture = findShippingExpansionFixture(state)

        expect(shippingDeed).toBeDefined()
        expect(fixture).toBeDefined()
        if (!shippingDeed || shippingDeed.type !== CompanyType.Shipping || !fixture) {
            return
        }

        state.getPlayerState(playerId).research.expansion = 1
        const companyId = 'shipping-company'
        state.companies = [
            {
                id: companyId,
                type: CompanyType.Shipping,
                owner: playerId,
                deeds: [shippingDeed]
            }
        ]
        state.machineState = MachineState.ShippingOperations
        state.phaseManager.startPhase(PhaseName.Operations, state.actionCount)
        state.beginCompanyOperation(companyId)
        state.turnManager.startTurn(playerId, state.actionCount)
        state.board.areas[fixture.originAreaId] = {
            id: fixture.originAreaId,
            type: AreaType.Sea,
            ships: [companyId]
        }

        const action = createExpandAction(state, playerId, fixture.firstTargetAreaId)
        action.apply(state)

        const handler = new ShippingOperationsStateHandler()
        const context = createMachineContext(state)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.ShippingOperations)
        expect(state.operatingCompanyId).toBe(companyId)
        expect(state.operatingCompanyExpansionCount).toBe(1)
        expect(state.operatedCompanyIds).toEqual([])
    })

    it('marks the company as operated and returns to operations when it can no longer expand', () => {
        const state = createTestState()
        const playerId = state.players[0].playerId
        const otherPlayerId = state.players[1].playerId
        const shippingDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Shipping && (deed.sizes[state.era] ?? 0) > 1
        )
        const fixture = findShippingExpansionFixture(state)

        expect(shippingDeed).toBeDefined()
        expect(fixture).toBeDefined()
        if (!shippingDeed || shippingDeed.type !== CompanyType.Shipping || !fixture) {
            return
        }

        const companyId = 'shipping-company'
        state.companies = [
            {
                id: companyId,
                type: CompanyType.Shipping,
                owner: playerId,
                deeds: [shippingDeed]
            },
            {
                id: 'other-shipping-company',
                type: CompanyType.Shipping,
                owner: otherPlayerId,
                deeds: [shippingDeed]
            }
        ]
        state.machineState = MachineState.ShippingOperations
        state.phaseManager.startPhase(PhaseName.Operations, state.actionCount)
        state.beginCompanyOperation(companyId)
        state.turnManager.startTurn(playerId, state.actionCount)
        state.board.areas[fixture.originAreaId] = {
            id: fixture.originAreaId,
            type: AreaType.Sea,
            ships: [companyId]
        }

        const action = createExpandAction(state, playerId, fixture.firstTargetAreaId)
        action.apply(state)

        const handler = new ShippingOperationsStateHandler()
        const context = createMachineContext(state)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.Operations)
        expect(state.operatedCompanyIds).toEqual([companyId])
        expect(state.operatingCompanyId).toBeUndefined()
        expect(state.operatingCompanyExpansionCount).toBeUndefined()
        expect(state.phaseManager.currentPhase?.name).toBe(PhaseName.Operations)
    })
})
